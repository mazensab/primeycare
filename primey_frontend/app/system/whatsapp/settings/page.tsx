"use client";

/* ============================================================
   📂 app/system/whatsapp/settings/page.tsx
   🧠 Primey Care | WhatsApp Settings Page
   ------------------------------------------------------------
   ✅ إعدادات WhatsApp Web Session
   ✅ يدعم عربي / إنجليزي عبر primey-locale
   ✅ يستخدم sonner
   ✅ بدون localhost
   ✅ أرقام إنجليزية
============================================================ */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCcw,
  Save,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Wifi,
  WifiOff,
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

type WhatsAppStatusPayload = {
  ok?: boolean;
  success?: boolean;
  configured?: boolean;
  is_enabled?: boolean;
  is_active?: boolean;
  provider?: string;
  session_name?: string;
  session_mode?: string;
  session_status?: string;
  connected?: boolean;
  qr_code?: string | null;
  pairing_code?: string | null;
  connected_phone?: string | null;
  device_label?: string | null;
  last_connected_at?: string | null;
  webhook_verified?: boolean;
  gateway_message?: string;
  last_error_message?: string;
};

type WhatsAppSettingsPayload = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  config?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

/* ============================================================
   API Paths
============================================================ */

const API_PATHS = {
  dashboard: "/system/whatsapp",
  logs: "/system/whatsapp/logs",
  templates: "/system/whatsapp/templates",
  broadcasts: "/system/whatsapp/broadcasts",

  status: "/api/whatsapp/status/",
  settings: "/api/whatsapp/settings/",
  createQr: "/api/whatsapp/session/create-qr/",
  createPairingCode: "/api/whatsapp/session/create-pairing-code/",
  disconnect: "/api/whatsapp/session/disconnect/",
} as const;

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

/* ============================================================
   Helpers
============================================================ */

function getCookie(name: string) {
  if (typeof document === "undefined") return "";

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  return parts.length === 2 ? parts.pop()?.split(";").shift() || "" : "";
}

function getCSRFToken() {
  return getCookie("csrftoken") || getCookie("csrf_token") || "";
}

function safeString(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function safeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }

  if (typeof value === "number") return value === 1;

  return fallback;
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getConfigObject(payload: WhatsAppSettingsPayload | null) {
  if (!payload) return {};
  if (payload.config && typeof payload.config === "object") return payload.config;
  if (payload.data && typeof payload.data === "object") return payload.data;
  return {};
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    pageTitle: ar ? "إعدادات واتساب" : "WhatsApp Settings",
    pageSubtitle: ar
      ? "إدارة إعدادات اتصال واتساب، الجلسة، التوكن، حالة الربط، وخيارات التشغيل."
      : "Manage WhatsApp connection settings, session, token, linking status, and runtime options.",

    back: ar ? "لوحة واتساب" : "WhatsApp Dashboard",
    logs: ar ? "السجلات" : "Logs",
    templates: ar ? "القوالب" : "Templates",
    broadcasts: ar ? "البث" : "Broadcasts",

    refresh: ar ? "تحديث" : "Refresh",
    save: ar ? "حفظ الإعدادات" : "Save Settings",
    createQr: ar ? "إنشاء QR" : "Create QR",
    createPairing: ar ? "رمز الربط" : "Pairing Code",
    disconnect: ar ? "قطع الاتصال" : "Disconnect",

    connectionStatus: ar ? "حالة الاتصال" : "Connection Status",
    connectionStatusDesc: ar
      ? "ملخص حالة جلسة واتساب الحالية."
      : "Current WhatsApp session status summary.",

    connected: ar ? "متصل" : "Connected",
    disconnected: ar ? "غير متصل" : "Disconnected",
    active: ar ? "فعال" : "Active",
    inactive: ar ? "غير فعال" : "Inactive",
    enabled: ar ? "مفعل" : "Enabled",
    disabled: ar ? "معطل" : "Disabled",
    verified: ar ? "موثق" : "Verified",
    notVerified: ar ? "غير موثق" : "Not Verified",

    providerSettings: ar ? "إعدادات المزود" : "Provider Settings",
    providerSettingsDesc: ar
      ? "بيانات تشغيل قناة واتساب الأساسية."
      : "Core WhatsApp provider configuration.",

    provider: ar ? "المزود" : "Provider",
    sessionName: ar ? "اسم الجلسة" : "Session Name",
    sessionMode: ar ? "طريقة الربط" : "Session Mode",
    sessionStatus: ar ? "حالة الجلسة" : "Session Status",
    phoneNumberId: ar ? "Phone Number ID" : "Phone Number ID",
    businessAccountId: ar ? "Business Account ID" : "Business Account ID",
    accessToken: ar ? "Access Token" : "Access Token",
    verifyToken: ar ? "Webhook Verify Token" : "Webhook Verify Token",
    backendWebhookToken: ar
      ? "Backend Webhook Token"
      : "Backend Webhook Token",

    defaultLanguage: ar ? "اللغة الافتراضية" : "Default Language",
    apiVersion: ar ? "إصدار API" : "API Version",
    deviceLabel: ar ? "اسم الجهاز" : "Device Label",
    connectedPhone: ar ? "الرقم المتصل" : "Connected Phone",
    lastConnected: ar ? "آخر اتصال" : "Last Connected",
    gatewayMessage: ar ? "رسالة البوابة" : "Gateway Message",

    sendingOptions: ar ? "خيارات الإرسال" : "Sending Options",
    sendingOptionsDesc: ar
      ? "إعدادات تشغيل القناة والتحكم في الإرسال."
      : "Runtime channel controls and sending options.",
    isEnabled: ar ? "تفعيل قناة واتساب" : "Enable WhatsApp Channel",
    isActive: ar ? "تفعيل الاتصال" : "Activate Connection",
    webhookVerified: ar ? "Webhook موثق" : "Webhook Verified",

    qrTitle: ar ? "بيانات الربط" : "Linking Data",
    qrDesc: ar
      ? "اعرض QR أو رمز الربط عند إنشائه من البوابة."
      : "Show QR or pairing code when generated by the gateway.",
    qrCode: ar ? "رمز QR" : "QR Code",
    pairingCode: ar ? "رمز الربط" : "Pairing Code",

    securityTitle: ar ? "الأمان والتوكن" : "Security & Tokens",
    securityDesc: ar
      ? "إخفاء القيم الحساسة عند العرض مع إمكانية التعديل."
      : "Hide sensitive values while allowing updates.",

    loading: ar ? "جاري تحميل إعدادات واتساب..." : "Loading WhatsApp settings...",
    loadFailed: ar ? "تعذر تحميل إعدادات واتساب" : "Could not load WhatsApp settings",
    saved: ar ? "تم حفظ إعدادات واتساب" : "WhatsApp settings saved",
    saveFailed: ar ? "تعذر حفظ إعدادات واتساب" : "Could not save WhatsApp settings",
    actionDone: ar ? "تم تنفيذ العملية" : "Action completed",
    actionFailed: ar ? "تعذر تنفيذ العملية" : "Action failed",

    quickAccess: ar ? "الوصول السريع" : "Quick Access",
    quickAccessDesc: ar
      ? "انتقل إلى ملفات واتساب التشغيلية."
      : "Open operational WhatsApp sections.",
    open: ar ? "فتح" : "Open",

    notes: ar ? "ملاحظات تشغيلية" : "Operational Notes",
    note1: ar
      ? "لا تضع localhost داخل الإعدادات، استخدم متغيرات البيئة أو روابط الإنتاج."
      : "Do not hardcode localhost in settings; use environment variables or production URLs.",
    note2: ar
      ? "توكنات الربط يجب أن تبقى سرية ولا تظهر للمستخدمين غير المخولين."
      : "Webhook and access tokens must remain private and restricted.",
    note3: ar
      ? "إرسال واتساب من الإشعارات يتم عبر notification_center ثم whatsapp_center."
      : "WhatsApp sending from notifications flows through notification_center then whatsapp_center.",
  };
}

/* ============================================================
   Page
============================================================ */

export default function SystemWhatsAppSettingsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  const [status, setStatus] = useState<WhatsAppStatusPayload>({});

  const [provider, setProvider] = useState("whatsapp_web_session");
  const [sessionName, setSessionName] = useState("primey-system-session");
  const [sessionMode, setSessionMode] = useState("qr");
  const [apiVersion, setApiVersion] = useState("v22.0");
  const [defaultLanguage, setDefaultLanguage] = useState("ar");

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [webhookVerifyToken, setWebhookVerifyToken] = useState("");
  const [backendWebhookToken, setBackendWebhookToken] = useState("");

  const [isEnabled, setIsEnabled] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [webhookVerified, setWebhookVerified] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const dir = locale === "ar" ? "rtl" : "ltr";

  const connected = Boolean(status.connected);
  const sessionStatus = safeString(status.session_status, "disconnected");

  const quickLinks = useMemo(
    () => [
      {
        href: API_PATHS.dashboard,
        icon: MessageCircle,
        title: t.back,
        description:
          locale === "ar"
            ? "الرجوع إلى لوحة واتساب الرئيسية."
            : "Return to the WhatsApp dashboard.",
      },
      {
        href: API_PATHS.logs,
        icon: ClipboardList,
        title: t.logs,
        description:
          locale === "ar"
            ? "متابعة السجلات وحالات الإرسال."
            : "Review logs and delivery statuses.",
      },
      {
        href: API_PATHS.templates,
        icon: FileText,
        title: t.templates,
        description:
          locale === "ar"
            ? "إدارة قوالب رسائل واتساب."
            : "Manage WhatsApp message templates.",
      },
      {
        href: API_PATHS.broadcasts,
        icon: Send,
        title: t.broadcasts,
        description:
          locale === "ar"
            ? "إرسال رسائل واتساب جماعية."
            : "Send WhatsApp broadcast messages.",
      },
    ],
    [locale, t],
  );

  function applyConfig(config: Record<string, unknown>) {
    setProvider(safeString(config.provider, "whatsapp_web_session"));
    setSessionName(safeString(config.session_name, "primey-system-session"));
    setSessionMode(safeString(config.session_mode, "qr"));
    setApiVersion(safeString(config.api_version, "v22.0"));
    setDefaultLanguage(safeString(config.default_language_code, "ar"));

    setPhoneNumberId(safeString(config.phone_number_id));
    setBusinessAccountId(safeString(config.business_account_id));
    setAccessToken(safeString(config.access_token));
    setWebhookVerifyToken(safeString(config.webhook_verify_token));
    setBackendWebhookToken(safeString(config.backend_webhook_token));

    setIsEnabled(safeBoolean(config.is_enabled, true));
    setIsActive(safeBoolean(config.is_active, true));
    setWebhookVerified(safeBoolean(config.webhook_verified, false));
  }

  async function fetchJson<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return null;

      return (await response.json()) as T;
    } catch (error) {
      console.error(`WhatsApp settings load error: ${url}`, error);
      return null;
    }
  }

  async function loadSettings(showToast = false) {
    try {
      setLoading(true);

      const [settingsPayload, statusPayload] = await Promise.all([
        fetchJson<WhatsAppSettingsPayload>(API_PATHS.settings),
        fetchJson<WhatsAppStatusPayload>(API_PATHS.status),
      ]);

      setStatus(statusPayload || {});

      const config = getConfigObject(settingsPayload);
      applyConfig(config);

      if (statusPayload) {
        setProvider((prev) => safeString(statusPayload.provider, prev));
        setSessionName((prev) => safeString(statusPayload.session_name, prev));
        setSessionMode((prev) => safeString(statusPayload.session_mode, prev));
        setIsEnabled((prev) => safeBoolean(statusPayload.is_enabled, prev));
        setIsActive((prev) => safeBoolean(statusPayload.is_active, prev));
        setWebhookVerified((prev) =>
          safeBoolean(statusPayload.webhook_verified, prev),
        );
      }

      if (showToast) toast.success(t.actionDone);
    } catch (error) {
      console.error("Failed to load WhatsApp settings:", error);
      toast.error(t.loadFailed);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    try {
      setSaving(true);

      const csrfToken = getCSRFToken();

      const response = await fetch(API_PATHS.settings, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
        body: JSON.stringify({
          provider,
          session_name: sessionName,
          session_mode: sessionMode,
          api_version: apiVersion,
          default_language_code: defaultLanguage,
          phone_number_id: phoneNumberId,
          business_account_id: businessAccountId,
          access_token: accessToken,
          webhook_verify_token: webhookVerifyToken,
          backend_webhook_token: backendWebhookToken,
          is_enabled: isEnabled,
          is_active: isActive,
          webhook_verified: webhookVerified,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(payload?.message || t.saveFailed);
        return;
      }

      toast.success(payload?.message || t.saved);
      await loadSettings(false);
    } catch (error) {
      console.error("WhatsApp settings save failed:", error);
      toast.error(t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function postSessionAction(
    url: string,
    body: Record<string, unknown> = {},
  ) {
    try {
      setActionLoading(true);

      const csrfToken = getCSRFToken();

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
        body: JSON.stringify({
          session_name: sessionName,
          session_mode: sessionMode,
          ...body,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(payload?.message || payload?.error || t.actionFailed);
        return;
      }

      toast.success(payload?.message || t.actionDone);
      await loadSettings(false);
    } catch (error) {
      console.error("WhatsApp session action failed:", error);
      toast.error(t.actionFailed);
    } finally {
      setActionLoading(false);
    }
  }

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

  useEffect(() => {
    void loadSettings(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  return (
    <main dir={dir} className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.pageTitle}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-7">
            {t.pageSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href={API_PATHS.dashboard}>
              <ArrowRight className="size-4" />
              {t.back}
            </Link>
          </Button>

          <Button variant="outline" onClick={() => loadSettings(true)}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
            {t.refresh}
          </Button>

          <Button onClick={saveSettings} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {t.save}
          </Button>
        </div>
      </section>

      {/* Status */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="text-muted-foreground text-sm">
                {t.connectionStatus}
              </p>
              <p className="mt-2 text-2xl font-bold">
                {connected ? t.connected : t.disconnected}
              </p>
            </div>
            <div className="rounded-2xl border bg-background/70 p-3">
              {connected ? (
                <Wifi className="size-6 text-emerald-600" />
              ) : (
                <WifiOff className="text-muted-foreground size-6" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="text-muted-foreground text-sm">
                {t.sessionStatus}
              </p>
              <p className="mt-2 text-2xl font-bold">{sessionStatus}</p>
            </div>
            <div className="rounded-2xl border bg-background/70 p-3">
              <Smartphone className="text-muted-foreground size-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="text-muted-foreground text-sm">{t.isEnabled}</p>
              <p className="mt-2 text-2xl font-bold">
                {isEnabled ? t.enabled : t.disabled}
              </p>
            </div>
            <Badge variant={isEnabled ? "default" : "outline"}>
              {isEnabled ? t.enabled : t.disabled}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="text-muted-foreground text-sm">
                {t.webhookVerified}
              </p>
              <p className="mt-2 text-2xl font-bold">
                {webhookVerified ? t.verified : t.notVerified}
              </p>
            </div>
            <Badge variant={webhookVerified ? "default" : "outline"}>
              {webhookVerified ? t.verified : t.notVerified}
            </Badge>
          </CardContent>
        </Card>
      </section>

      {loading ? (
        <Card>
          <CardContent className="text-muted-foreground flex items-center justify-center gap-2 py-20 text-sm">
            <Loader2 className="size-4 animate-spin" />
            {t.loading}
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[1.35fr_0.8fr]">
          {/* Settings Form */}
          <Card>
            <CardHeader>
              <CardTitle>{t.providerSettings}</CardTitle>
              <CardDescription>{t.providerSettingsDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t.provider}>
                  <select
                    value={provider}
                    onChange={(event) => setProvider(event.target.value)}
                    className="bg-background h-10 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="whatsapp_web_session">
                      whatsapp_web_session
                    </option>
                    <option value="META">META</option>
                  </select>
                </Field>

                <Field label={t.sessionName}>
                  <Input
                    value={sessionName}
                    onChange={(event) => setSessionName(event.target.value)}
                    placeholder="primey-system-session"
                  />
                </Field>

                <Field label={t.sessionMode}>
                  <select
                    value={sessionMode}
                    onChange={(event) => setSessionMode(event.target.value)}
                    className="bg-background h-10 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="qr">QR</option>
                    <option value="pairing_code">Pairing Code</option>
                  </select>
                </Field>

                <Field label={t.defaultLanguage}>
                  <select
                    value={defaultLanguage}
                    onChange={(event) => setDefaultLanguage(event.target.value)}
                    className="bg-background h-10 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="ar">ar</option>
                    <option value="en">en</option>
                  </select>
                </Field>

                <Field label={t.apiVersion}>
                  <Input
                    value={apiVersion}
                    onChange={(event) => setApiVersion(event.target.value)}
                    placeholder="v22.0"
                  />
                </Field>

                <Field label={t.phoneNumberId}>
                  <Input
                    value={phoneNumberId}
                    onChange={(event) => setPhoneNumberId(event.target.value)}
                    placeholder="Phone number id"
                  />
                </Field>

                <Field label={t.businessAccountId}>
                  <Input
                    value={businessAccountId}
                    onChange={(event) =>
                      setBusinessAccountId(event.target.value)
                    }
                    placeholder="Business account id"
                  />
                </Field>

                <Field label={t.connectedPhone}>
                  <Input
                    value={safeString(status.connected_phone)}
                    readOnly
                    placeholder="-"
                  />
                </Field>

                <Field label={t.deviceLabel}>
                  <Input
                    value={safeString(status.device_label)}
                    readOnly
                    placeholder="-"
                  />
                </Field>

                <Field label={t.lastConnected}>
                  <Input
                    value={formatDate(status.last_connected_at)}
                    readOnly
                  />
                </Field>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{t.securityTitle}</h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {t.securityDesc}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowSecrets((prev) => !prev)}
                  >
                    {showSecrets ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                    {showSecrets ? "Hide" : "Show"}
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={t.accessToken}>
                    <Input
                      type={showSecrets ? "text" : "password"}
                      value={accessToken}
                      onChange={(event) => setAccessToken(event.target.value)}
                    />
                  </Field>

                  <Field label={t.verifyToken}>
                    <Input
                      type={showSecrets ? "text" : "password"}
                      value={webhookVerifyToken}
                      onChange={(event) =>
                        setWebhookVerifyToken(event.target.value)
                      }
                    />
                  </Field>

                  <Field label={t.backendWebhookToken}>
                    <Input
                      type={showSecrets ? "text" : "password"}
                      value={backendWebhookToken}
                      onChange={(event) =>
                        setBackendWebhookToken(event.target.value)
                      }
                    />
                  </Field>
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <h3 className="mb-4 font-semibold">{t.sendingOptions}</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  {t.sendingOptionsDesc}
                </p>

                <div className="grid gap-3 md:grid-cols-3">
                  <ToggleCard
                    label={t.isEnabled}
                    checked={isEnabled}
                    onChange={setIsEnabled}
                    activeLabel={t.enabled}
                    inactiveLabel={t.disabled}
                  />

                  <ToggleCard
                    label={t.isActive}
                    checked={isActive}
                    onChange={setIsActive}
                    activeLabel={t.active}
                    inactiveLabel={t.inactive}
                  />

                  <ToggleCard
                    label={t.webhookVerified}
                    checked={webhookVerified}
                    onChange={setWebhookVerified}
                    activeLabel={t.verified}
                    inactiveLabel={t.notVerified}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Side Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t.qrTitle}</CardTitle>
                <CardDescription>{t.qrDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    disabled={actionLoading}
                    onClick={() =>
                      postSessionAction(API_PATHS.createQr, {
                        session_mode: "qr",
                      })
                    }
                  >
                    {actionLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <QrCode className="size-4" />
                    )}
                    {t.createQr}
                  </Button>

                  <Button
                    variant="outline"
                    disabled={actionLoading}
                    onClick={() =>
                      postSessionAction(API_PATHS.createPairingCode, {
                        session_mode: "pairing_code",
                      })
                    }
                  >
                    {actionLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Smartphone className="size-4" />
                    )}
                    {t.createPairing}
                  </Button>

                  <Button
                    variant="outline"
                    disabled={actionLoading}
                    onClick={() => postSessionAction(API_PATHS.disconnect)}
                  >
                    {actionLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <WifiOff className="size-4" />
                    )}
                    {t.disconnect}
                  </Button>
                </div>

                {status.qr_code ? (
                  <div className="rounded-2xl border bg-background p-3">
                    <p className="mb-2 text-sm font-medium">{t.qrCode}</p>
                    <p className="text-muted-foreground line-clamp-6 break-all text-xs leading-6">
                      {status.qr_code}
                    </p>
                  </div>
                ) : null}

                {status.pairing_code ? (
                  <div className="rounded-2xl border bg-background p-3">
                    <p className="mb-2 text-sm font-medium">{t.pairingCode}</p>
                    <p className="text-2xl font-bold tracking-widest">
                      {status.pairing_code}
                    </p>
                  </div>
                ) : null}

                {status.gateway_message || status.last_error_message ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-7 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                    {safeString(status.gateway_message || status.last_error_message)}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.quickAccess}</CardTitle>
                <CardDescription>{t.quickAccessDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-3">
                {quickLinks.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-2xl border p-4 transition hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl border bg-background p-2">
                            <Icon className="text-muted-foreground size-5" />
                          </div>

                          <div>
                            <p className="font-medium">{item.title}</p>
                            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-6">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        <Badge variant="secondary">{t.open}</Badge>
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.notes}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
                <div className="flex gap-2">
                  <CheckCircle2 className="mt-1 size-4 text-emerald-600" />
                  <span>{t.note1}</span>
                </div>
                <div className="flex gap-2">
                  <ShieldCheck className="mt-1 size-4 text-emerald-600" />
                  <span>{t.note2}</span>
                </div>
                <div className="flex gap-2">
                  <Settings className="mt-1 size-4 text-emerald-600" />
                  <span>{t.note3}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </main>
  );
}

/* ============================================================
   Small Components
============================================================ */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function ToggleCard({
  label,
  checked,
  onChange,
  activeLabel,
  inactiveLabel,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition hover:bg-muted/50">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {checked ? activeLabel : inactiveLabel}
        </p>
      </div>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4"
      />
    </label>
  );
}