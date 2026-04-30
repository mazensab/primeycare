"use client";

/* ============================================================
   📂 app/system/whatsapp/page.tsx
   🧠 Primey Care | WhatsApp Dashboard Page
   ------------------------------------------------------------
   ✅ المسار:
      /system/whatsapp

   ✅ العمل:
      لوحة إدارة WhatsApp داخل مساحة النظام.

   ✅ يعتمد على:
      GET  /api/whatsapp/status/
      GET  /api/whatsapp/settings/
      GET  /api/whatsapp/logs/
      GET  /api/whatsapp/templates/
      GET  /api/whatsapp/broadcasts/
      GET  /api/whatsapp/inbox/summary/
      POST /api/whatsapp/session/create-qr/
      POST /api/whatsapp/session/create-pairing-code/
      POST /api/whatsapp/session/disconnect/

   ✅ الوظائف:
      - عرض حالة اتصال WhatsApp Web Session
      - عرض ملخص الرسائل والقوالب والسجلات والمحادثات
      - عرض أحدث سجلات الإرسال
      - عرض قوالب WhatsApp المختصرة
      - إجراءات سريعة للربط، الإعدادات، السجلات، القوالب، والبث
      - دعم عربي / إنجليزي عبر primey-locale
      - استخدام toast من sonner
      - بدون localhost hardcoded
      - استخدام UI الداخلي فقط
      - الأرقام تبقى بالإنجليزية
============================================================ */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  BellRing,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Inbox,
  Loader2,
  Megaphone,
  MessageCircle,
  QrCode,
  RefreshCcw,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Wifi,
  WifiOff,
  XCircle,
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
  phone_number_id?: string | null;
  last_check_at?: string | null;
  last_error_message?: string;
  webhook_verified?: boolean;
  session_name?: string;
  session_mode?: string;
  session_status?: string;
  connected?: boolean;
  qr_code?: string | null;
  pairing_code?: string | null;
  connected_phone?: string | null;
  last_connected_at?: string | null;
  device_label?: string | null;
  gateway_message?: string;
  message?: string;
  data?: Record<string, unknown>;
};

type WhatsAppSettingsPayload = {
  ok?: boolean;
  success?: boolean;
  config?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

type WhatsAppLog = {
  id: number | string;
  status?: string;
  delivery_status?: string;
  provider_status?: string;
  event_code?: string;
  trigger_source?: string;
  recipient_phone?: string;
  recipient_name?: string;
  message_body?: string;
  payload_summary?: string;
  template_name?: string;
  company_reference?: string;
  company_name?: string;
  created_at?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  failed_at?: string | null;
  error_message?: string;
  failure_reason?: string;
};

type WhatsAppTemplate = {
  id: number | string;
  event_code?: string;
  template_key?: string;
  template_name?: string;
  language_code?: string;
  message_type?: string;
  approval_status?: string;
  provider_status?: string;
  is_active?: boolean;
  is_default?: boolean;
  version?: number;
  body_preview?: string;
  body_text?: string;
  created_at?: string | null;
};

type WhatsAppBroadcast = {
  id?: number | string;
  event_code?: string;
  recipient_phone?: string;
  recipient_name?: string;
  delivery_status?: string;
  provider_status?: string;
  message_body?: string;
  created_at?: string | null;
};

type WhatsAppInboxSummary = {
  total_conversations?: number;
  unread_conversations?: number;
  open_conversations?: number;
  resolved_conversations?: number;
  unread_messages?: number;
  total_messages?: number;
  [key: string]: unknown;
};

/* ============================================================
   API Paths
============================================================ */

const API_PATHS = {
  status: "/api/whatsapp/status/",
  settings: "/api/whatsapp/settings/",
  logs: "/api/whatsapp/logs/",
  templates: "/api/whatsapp/templates/",
  broadcasts: "/api/whatsapp/broadcasts/",
  inboxSummary: "/api/whatsapp/inbox/summary/",
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
   Generic Helpers
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

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function getResults<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.logs)) return payload.logs;
  if (Array.isArray(payload?.templates)) return payload.templates;
  if (Array.isArray(payload?.broadcasts)) return payload.broadcasts;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
}

function getConfigObject(payload: WhatsAppSettingsPayload): Record<string, unknown> {
  if (payload?.config && typeof payload.config === "object") return payload.config;
  if (payload?.data && typeof payload.data === "object") return payload.data;
  return {};
}

function deliveryStatusClass(status: string) {
  const normalized = status.toUpperCase();

  if (["SENT", "DELIVERED", "READ"].includes(normalized)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  if (["QUEUED", "PENDING"].includes(normalized)) {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300";
  }

  if (["FAILED", "CANCELLED", "ERROR"].includes(normalized)) {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300";
  }

  return "border-muted bg-muted text-muted-foreground";
}

function approvalStatusClass(status: string) {
  const normalized = status.toUpperCase();

  if (normalized === "APPROVED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  if (normalized === "PENDING") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300";
  }

  if (normalized === "REJECTED") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300";
  }

  return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300";
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "إدارة واتساب" : "WhatsApp Management",
    pageSubtitle: isArabic
      ? "متابعة اتصال واتساب، السجلات، القوالب، المحادثات، والبث من لوحة واحدة."
      : "Monitor WhatsApp connection, logs, templates, conversations, and broadcasts from one place.",

    refresh: isArabic ? "تحديث" : "Refresh",
    settings: isArabic ? "الإعدادات" : "Settings",
    logs: isArabic ? "السجلات" : "Logs",
    templates: isArabic ? "القوالب" : "Templates",
    broadcasts: isArabic ? "البث" : "Broadcasts",
    inbox: isArabic ? "المحادثات" : "Inbox",

    createQr: isArabic ? "إنشاء QR" : "Create QR",
    createPairing: isArabic ? "رمز الربط" : "Pairing Code",
    disconnect: isArabic ? "قطع الاتصال" : "Disconnect",

    connected: isArabic ? "متصل" : "Connected",
    disconnected: isArabic ? "غير متصل" : "Disconnected",
    active: isArabic ? "فعال" : "Active",
    inactive: isArabic ? "غير فعال" : "Inactive",
    enabled: isArabic ? "مفعل" : "Enabled",
    disabled: isArabic ? "معطل" : "Disabled",
    verified: isArabic ? "موثق" : "Verified",
    notVerified: isArabic ? "غير موثق" : "Not Verified",

    statusTitle: isArabic ? "حالة الاتصال" : "Connection Status",
    statusSubtitle: isArabic
      ? "حالة جلسة WhatsApp Web الحالية ومعلومات الجهاز."
      : "Current WhatsApp Web session status and device information.",
    provider: isArabic ? "المزود" : "Provider",
    sessionName: isArabic ? "اسم الجلسة" : "Session Name",
    sessionStatus: isArabic ? "حالة الجلسة" : "Session Status",
    connectedPhone: isArabic ? "الرقم المتصل" : "Connected Phone",
    deviceLabel: isArabic ? "الجهاز" : "Device",
    lastConnectedAt: isArabic ? "آخر اتصال" : "Last Connected",
    gatewayMessage: isArabic ? "رسالة البوابة" : "Gateway Message",
    qrCode: isArabic ? "رمز QR" : "QR Code",
    pairingCode: isArabic ? "رمز الربط" : "Pairing Code",

    totalLogs: isArabic ? "إجمالي السجلات" : "Total Logs",
    sent: isArabic ? "مرسلة" : "Sent",
    failed: isArabic ? "فاشلة" : "Failed",
    read: isArabic ? "مقروءة" : "Read",
    templatesCount: isArabic ? "القوالب" : "Templates",
    approvedTemplates: isArabic ? "المعتمدة" : "Approved",
    activeTemplates: isArabic ? "النشطة" : "Active Templates",
    broadcastsCount: isArabic ? "البث" : "Broadcasts",
    conversations: isArabic ? "المحادثات" : "Conversations",
    unreadConversations: isArabic ? "غير المقروءة" : "Unread",

    recentLogs: isArabic ? "آخر سجلات الإرسال" : "Recent Message Logs",
    recentLogsSubtitle: isArabic
      ? "أحدث رسائل واتساب الخارجة من النظام."
      : "Latest outbound WhatsApp messages from the system.",
    recentTemplates: isArabic ? "قوالب واتساب" : "WhatsApp Templates",
    recentTemplatesSubtitle: isArabic
      ? "عرض مختصر للقوالب المستخدمة في أحداث النظام."
      : "Compact view of templates used by system events.",

    noLogsTitle: isArabic ? "لا توجد سجلات" : "No Logs",
    noLogsText: isArabic
      ? "لم يتم تسجيل أي رسائل واتساب حتى الآن."
      : "No WhatsApp message logs have been recorded yet.",
    noTemplatesTitle: isArabic ? "لا توجد قوالب" : "No Templates",
    noTemplatesText: isArabic
      ? "لم يتم إنشاء قوالب واتساب بعد."
      : "No WhatsApp templates have been created yet.",

    filterPlaceholder: isArabic ? "ابحث في السجلات..." : "Filter logs...",
    quickAccessTitle: isArabic ? "الوصول السريع" : "Quick Access",
    quickAccessSubtitle: isArabic
      ? "اختصارات لإدارة واتساب وتشغيل القنوات."
      : "Shortcuts for managing WhatsApp and communication channels.",
    open: isArabic ? "فتح" : "Open",
    loading: isArabic ? "جاري تحميل بيانات واتساب..." : "Loading WhatsApp data...",
    apiError: isArabic
      ? "تعذر تحميل بيانات واتساب"
      : "Failed to load WhatsApp data",
    actionDone: isArabic ? "تم تنفيذ العملية" : "Action completed",
    actionFailed: isArabic ? "تعذر تنفيذ العملية" : "Action failed",

    logEvent: isArabic ? "الحدث" : "Event",
    logRecipient: isArabic ? "المستلم" : "Recipient",
    logStatus: isArabic ? "الحالة" : "Status",
    logDate: isArabic ? "التاريخ" : "Date",
    templateEvent: isArabic ? "الحدث" : "Event",
    templateStatus: isArabic ? "الاعتماد" : "Approval",
    templateLang: isArabic ? "اللغة" : "Language",
    templateType: isArabic ? "النوع" : "Type",
  };
}

/* ============================================================
   Page
============================================================ */

export default function SystemWhatsAppPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [query, setQuery] = useState("");

  const [status, setStatus] = useState<WhatsAppStatusPayload>({});
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [broadcasts, setBroadcasts] = useState<WhatsAppBroadcast[]>([]);
  const [inboxSummary, setInboxSummary] = useState<WhatsAppInboxSummary>({});

  const t = useMemo(() => dictionary(locale), [locale]);

  const filteredLogs = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return logs;

    return logs.filter((log) => {
      return (
        safeString(log.event_code).toLowerCase().includes(cleanQuery) ||
        safeString(log.recipient_phone).toLowerCase().includes(cleanQuery) ||
        safeString(log.recipient_name).toLowerCase().includes(cleanQuery) ||
        safeString(log.message_body).toLowerCase().includes(cleanQuery) ||
        safeString(log.payload_summary).toLowerCase().includes(cleanQuery) ||
        safeString(log.delivery_status || log.status)
          .toLowerCase()
          .includes(cleanQuery)
      );
    });
  }, [logs, query]);

  const stats = useMemo(() => {
    const totalLogs = logs.length;
    const sent = logs.filter((item) =>
      ["SENT", "DELIVERED", "READ"].includes(
        safeString(item.delivery_status || item.status).toUpperCase(),
      ),
    ).length;
    const failed = logs.filter(
      (item) =>
        safeString(item.delivery_status || item.status).toUpperCase() ===
        "FAILED",
    ).length;
    const read = logs.filter(
      (item) =>
        safeString(item.delivery_status || item.status).toUpperCase() ===
        "READ",
    ).length;

    const templatesCount = templates.length;
    const approvedTemplates = templates.filter(
      (item) => safeString(item.approval_status).toUpperCase() === "APPROVED",
    ).length;
    const activeTemplates = templates.filter((item) => item.is_active).length;

    const conversations = safeNumber(
      inboxSummary.total_conversations ??
        inboxSummary.open_conversations ??
        inboxSummary.total_messages,
      0,
    );
    const unreadConversations = safeNumber(
      inboxSummary.unread_conversations ?? inboxSummary.unread_messages,
      0,
    );

    return {
      totalLogs,
      sent,
      failed,
      read,
      templatesCount,
      approvedTemplates,
      activeTemplates,
      broadcastsCount: broadcasts.length,
      conversations,
      unreadConversations,
    };
  }, [logs, templates, broadcasts, inboxSummary]);

  const statusCards = useMemo(
    () => [
      {
        title: t.totalLogs,
        value: stats.totalLogs,
        helper: t.sent,
        helperValue: `${percent(stats.sent, stats.totalLogs)}%`,
        icon: MessageCircle,
        percent: percent(stats.sent, stats.totalLogs),
      },
      {
        title: t.failed,
        value: stats.failed,
        helper: t.failed,
        helperValue: `${percent(stats.failed, stats.totalLogs)}%`,
        icon: XCircle,
        percent: percent(stats.failed, stats.totalLogs),
      },
      {
        title: t.templatesCount,
        value: stats.templatesCount,
        helper: t.approvedTemplates,
        helperValue: `${percent(stats.approvedTemplates, stats.templatesCount)}%`,
        icon: FileText,
        percent: percent(stats.approvedTemplates, stats.templatesCount),
      },
      {
        title: t.conversations,
        value: stats.conversations,
        helper: t.unreadConversations,
        helperValue: String(stats.unreadConversations),
        icon: Inbox,
        percent: percent(stats.unreadConversations, stats.conversations),
      },
    ],
    [stats, t],
  );

  const recentLogs = useMemo(() => filteredLogs.slice(0, 6), [filteredLogs]);
  const recentTemplates = useMemo(() => templates.slice(0, 6), [templates]);

  const moduleActions = useMemo(
    () => [
      {
        href: "/system/whatsapp/settings",
        icon: Settings,
        title: t.settings,
        description:
          locale === "ar"
            ? "إعداد المزود، الجلسة، التوكن، اللغة الافتراضية، وخيارات الإرسال."
            : "Configure provider, session, token, default language, and sending options.",
        badge: t.settings,
        cta: t.open,
      },
      {
        href: "/system/whatsapp/logs",
        icon: ClipboardList,
        title: t.logs,
        description:
          locale === "ar"
            ? "متابعة سجلات الرسائل، حالات الإرسال، الأخطاء، ومراجع المزود."
            : "Review message logs, delivery states, errors, and provider references.",
        badge: t.logs,
        cta: t.open,
      },
      {
        href: "/system/whatsapp/templates",
        icon: FileText,
        title: t.templates,
        description:
          locale === "ar"
            ? "إدارة قوالب الرسائل وربطها بأحداث الطلبات والمدفوعات والفواتير."
            : "Manage message templates linked to orders, payments, and invoices.",
        badge: t.templates,
        cta: t.open,
      },
      {
        href: "/system/whatsapp/broadcasts",
        icon: Megaphone,
        title: t.broadcasts,
        description:
          locale === "ar"
            ? "إرسال رسائل جماعية مباشرة للأرقام أو مستخدمي النظام عند الحاجة."
            : "Send direct bulk messages to raw numbers or system users when needed.",
        badge: t.broadcasts,
        cta: t.open,
      },
      {
        href: "/system/whatsapp/inbox",
        icon: Inbox,
        title: t.inbox,
        description:
          locale === "ar"
            ? "متابعة محادثات العملاء الواردة من بوابة واتساب."
            : "Monitor inbound customer conversations from the WhatsApp gateway.",
        badge: t.inbox,
        cta: t.open,
      },
    ],
    [locale, t],
  );

  async function fetchJson<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        console.warn(`WhatsApp API unavailable: ${url} | ${response.status}`);
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      console.error(`WhatsApp API load error: ${url}`, error);
      return null;
    }
  }

  async function loadWhatsAppData(showToast = false) {
    try {
      setIsLoading(true);

      const [
        statusPayload,
        settingsPayload,
        logsPayload,
        templatesPayload,
        broadcastsPayload,
        inboxPayload,
      ] = await Promise.all([
        fetchJson<WhatsAppStatusPayload>(API_PATHS.status),
        fetchJson<WhatsAppSettingsPayload>(API_PATHS.settings),
        fetchJson<any>(`${API_PATHS.logs}?limit=100`),
        fetchJson<any>(API_PATHS.templates),
        fetchJson<any>(API_PATHS.broadcasts),
        fetchJson<any>(API_PATHS.inboxSummary),
      ]);

      setStatus(statusPayload || {});
      setSettings(settingsPayload ? getConfigObject(settingsPayload) : {});
      setLogs(getResults<WhatsAppLog>(logsPayload));
      setTemplates(getResults<WhatsAppTemplate>(templatesPayload));
      setBroadcasts(getResults<WhatsAppBroadcast>(broadcastsPayload));

      const summary =
        inboxPayload?.summary ||
        inboxPayload?.data ||
        inboxPayload?.results ||
        {};
      setInboxSummary(
        summary && typeof summary === "object" && !Array.isArray(summary)
          ? summary
          : {},
      );

      if (showToast) {
        toast.success(t.actionDone);
      }
    } catch (error) {
      console.error("Failed to load WhatsApp dashboard:", error);
      toast.error(t.apiError);
      setStatus({});
      setSettings({});
      setLogs([]);
      setTemplates([]);
      setBroadcasts([]);
      setInboxSummary({});
    } finally {
      setIsLoading(false);
    }
  }

  async function postSessionAction(
    url: string,
    successMessage: string,
    body: Record<string, unknown> = {},
  ) {
    try {
      setIsActionLoading(true);

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
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload?.message ||
          payload?.error ||
          payload?.details ||
          t.actionFailed;

        toast.error(message);
        return;
      }

      toast.success(payload?.message || successMessage);
      await loadWhatsAppData(false);
    } catch (error) {
      console.error("WhatsApp session action failed:", error);
      toast.error(t.actionFailed);
    } finally {
      setIsActionLoading(false);
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

      window.setTimeout(() => {
        syncLocale();
      }, 0);
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
    void loadWhatsAppData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const connected = Boolean(status.connected);
  const active = Boolean(status.is_active ?? settings.is_active);
  const enabled = Boolean(status.is_enabled ?? settings.is_enabled);
  const verified = Boolean(status.webhook_verified ?? settings.webhook_verified);
  const sessionStatus = safeString(status.session_status, "disconnected");

  return (
    <div className="space-y-4">
      {/* =====================================================
          Header
      ====================================================== */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.pageTitle}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t.pageSubtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadWhatsAppData(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          <Link href="/system/whatsapp/logs">
            <Button variant="outline" className="h-10 w-full rounded-xl sm:w-auto">
              <ClipboardList className="h-4 w-4" />
              <span>{t.logs}</span>
            </Button>
          </Link>

          <Link href="/system/whatsapp/settings">
            <Button className="h-10 w-full rounded-xl sm:w-auto">
              <Settings className="h-4 w-4" />
              <span>{t.settings}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* =====================================================
          Main Layout
      ====================================================== */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Connection Status */}
        <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-1">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-bold">
                {t.statusTitle}
              </CardTitle>
              <CardDescription className="mt-1 text-sm">
                {t.statusSubtitle}
              </CardDescription>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              {connected ? (
                <Wifi className="h-5 w-5 text-emerald-600" />
              ) : (
                <WifiOff className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t.loading}</span>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {connected ? t.connected : t.disconnected}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {safeString(status.connected_phone, "-")}
                      </p>
                    </div>

                    <Badge
                      className={
                        connected
                          ? "rounded-full border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "rounded-full"
                      }
                      variant={connected ? "outline" : "secondary"}
                    >
                      {sessionStatus}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-2 rounded-xl border bg-background p-3">
                    <span className="text-muted-foreground">{t.provider}</span>
                    <span className="font-medium">
                      {safeString(status.provider, "whatsapp_web_session")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-xl border bg-background p-3">
                    <span className="text-muted-foreground">{t.sessionName}</span>
                    <span className="max-w-[160px] truncate font-medium">
                      {safeString(status.session_name, "-")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-xl border bg-background p-3">
                    <span className="text-muted-foreground">{t.deviceLabel}</span>
                    <span className="max-w-[160px] truncate font-medium">
                      {safeString(status.device_label, "-")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-xl border bg-background p-3">
                    <span className="text-muted-foreground">
                      {t.lastConnectedAt}
                    </span>
                    <span className="font-medium">
                      {formatDate(status.last_connected_at)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border bg-background p-3 text-center">
                    <Badge variant={active ? "default" : "outline"}>
                      {active ? t.active : t.inactive}
                    </Badge>
                    <p className="text-muted-foreground mt-2 text-xs">
                      {t.active}
                    </p>
                  </div>

                  <div className="rounded-xl border bg-background p-3 text-center">
                    <Badge variant={enabled ? "default" : "outline"}>
                      {enabled ? t.enabled : t.disabled}
                    </Badge>
                    <p className="text-muted-foreground mt-2 text-xs">
                      {t.enabled}
                    </p>
                  </div>

                  <div className="rounded-xl border bg-background p-3 text-center">
                    <Badge variant={verified ? "default" : "outline"}>
                      {verified ? t.verified : t.notVerified}
                    </Badge>
                    <p className="text-muted-foreground mt-2 text-xs">
                      Webhook
                    </p>
                  </div>
                </div>

                {status.gateway_message || status.last_error_message ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                    {safeString(status.gateway_message || status.last_error_message)}
                  </div>
                ) : null}

                {status.qr_code ? (
                  <div className="rounded-xl border bg-background p-3">
                    <p className="mb-2 text-sm font-medium">{t.qrCode}</p>
                    <div className="text-muted-foreground line-clamp-4 break-all text-xs">
                      {safeString(status.qr_code)}
                    </div>
                  </div>
                ) : null}

                {status.pairing_code ? (
                  <div className="rounded-xl border bg-background p-3">
                    <p className="mb-2 text-sm font-medium">{t.pairingCode}</p>
                    <div className="text-xl font-bold tracking-widest">
                      {safeString(status.pairing_code)}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-3">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={isActionLoading}
                    onClick={() =>
                      postSessionAction(API_PATHS.createQr, t.actionDone, {
                        session_name: status.session_name,
                        session_mode: "qr",
                      })
                    }
                  >
                    {isActionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode className="h-4 w-4" />
                    )}
                    {t.createQr}
                  </Button>

                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={isActionLoading}
                    onClick={() =>
                      postSessionAction(API_PATHS.createPairingCode, t.actionDone, {
                        session_name: status.session_name,
                        session_mode: "pairing_code",
                      })
                    }
                  >
                    {isActionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Smartphone className="h-4 w-4" />
                    )}
                    {t.createPairing}
                  </Button>

                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={isActionLoading}
                    onClick={() =>
                      postSessionAction(API_PATHS.disconnect, t.actionDone, {
                        session_name: status.session_name,
                      })
                    }
                  >
                    {isActionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <WifiOff className="h-4 w-4" />
                    )}
                    {t.disconnect}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Stats + Recent Logs */}
        <div className="space-y-4 xl:col-span-2">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statusCards.map((item) => {
              const Icon = item.icon;

              return (
                <Card key={item.title} className="rounded-2xl border bg-card shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-muted-foreground text-sm">
                          {item.title}
                        </p>
                        <p className="mt-2 text-2xl font-bold">{item.value}</p>
                      </div>

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {item.helper}
                      </span>
                      <span className="font-semibold">{item.helperValue}</span>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(item.percent, 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.recentLogs}
                  </CardTitle>
                  <CardDescription>{t.recentLogsSubtitle}</CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t.filterPlaceholder}
                    className="h-10 rounded-xl lg:w-64"
                  />

                  <Link href="/system/whatsapp/logs">
                    <Button variant="outline" size="sm" className="rounded-xl">
                      <ClipboardList className="h-4 w-4" />
                      {t.open}
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t.loading}</span>
                </div>
              ) : recentLogs.length === 0 ? (
                <div className="rounded-xl border border-dashed p-5 text-center">
                  <p className="font-semibold">{t.noLogsTitle}</p>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">
                    {t.noLogsText}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentLogs.map((log) => {
                    const statusValue = safeString(
                      log.delivery_status || log.status,
                      "QUEUED",
                    );

                    return (
                      <div
                        key={log.id}
                        className="flex flex-col gap-3 rounded-xl border bg-background p-3 transition hover:bg-muted/50 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">
                              {safeString(log.event_code, "system_message")}
                            </p>
                            <Badge className={deliveryStatusClass(statusValue)}>
                              {statusValue}
                            </Badge>
                          </div>

                          <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
                            {safeString(
                              log.message_body || log.payload_summary,
                              "-",
                            )}
                          </p>
                        </div>

                        <div className="grid gap-1 text-xs text-muted-foreground lg:min-w-[260px]">
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-3.5 w-3.5" />
                            <span>{safeString(log.recipient_phone, "-")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{formatDate(log.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* =====================================================
          Templates + Operational Status
      ====================================================== */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-bold">
                {t.recentTemplates}
              </CardTitle>
              <CardDescription>{t.recentTemplatesSubtitle}</CardDescription>
            </div>

            <Link href="/system/whatsapp/templates">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl">
                <FileText className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t.loading}</span>
              </div>
            ) : recentTemplates.length === 0 ? (
              <div className="rounded-xl border border-dashed p-5 text-center">
                <p className="font-semibold">{t.noTemplatesTitle}</p>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {t.noTemplatesText}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {recentTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-xl border bg-background p-4 transition hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {safeString(
                            template.template_name || template.template_key,
                            `Template #${template.id}`,
                          )}
                        </p>
                        <p className="text-muted-foreground mt-1 truncate text-xs">
                          {safeString(template.event_code, "-")}
                        </p>
                      </div>

                      <Badge
                        className={approvalStatusClass(
                          safeString(template.approval_status, "DRAFT"),
                        )}
                      >
                        {safeString(template.approval_status, "DRAFT")}
                      </Badge>
                    </div>

                    <p className="text-muted-foreground mt-3 line-clamp-2 text-sm leading-6">
                      {safeString(
                        template.body_preview || template.body_text,
                        "-",
                      )}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {safeString(template.language_code, "ar")}
                      </Badge>
                      <Badge variant="outline">
                        {safeString(template.message_type, "TEXT")}
                      </Badge>
                      {template.is_default ? (
                        <Badge variant="outline">
                          <BadgeCheck className="me-1 h-3 w-3" />
                          Default
                        </Badge>
                      ) : null}
                      {template.is_active ? (
                        <Badge variant="outline">
                          <CheckCircle2 className="me-1 h-3 w-3" />
                          Active
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">
              {locale === "ar" ? "جاهزية القناة" : "Channel Readiness"}
            </CardTitle>
            <CardDescription>
              {locale === "ar"
                ? "ملخص سريع لحالة واتساب التشغيلية."
                : "A quick summary of WhatsApp operational readiness."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border bg-background p-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="text-sm">{t.sessionStatus}</span>
              </div>
              <Badge variant={connected ? "default" : "outline"}>
                {connected ? t.connected : t.disconnected}
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-background p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-sm">Webhook</span>
              </div>
              <Badge variant={verified ? "default" : "outline"}>
                {verified ? t.verified : t.notVerified}
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-background p-3">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                <span className="text-sm">{t.sent}</span>
              </div>
              <Badge variant="secondary">{stats.sent}</Badge>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-background p-3">
              <div className="flex items-center gap-2">
                <BellRing className="h-4 w-4" />
                <span className="text-sm">{t.unreadConversations}</span>
              </div>
              <Badge variant="secondary">{stats.unreadConversations}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* =====================================================
          Professional Action Cards
      ====================================================== */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">
            {t.quickAccessTitle}
          </CardTitle>
          <CardDescription>{t.quickAccessSubtitle}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            {moduleActions.map((item) => {
              const Icon = item.icon;

              return (
                <Link key={item.href} href={item.href} className="block">
                  <Card className="h-full rounded-2xl border bg-background shadow-none transition hover:bg-muted/40 hover:shadow-sm">
                    <CardContent className="flex h-full items-start justify-between gap-4 p-4">
                      <div className="min-w-0 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                            <Icon className="h-5 w-5" />
                          </div>

                          <Badge variant="secondary" className="rounded-full">
                            {item.badge}
                          </Badge>
                        </div>

                        <div>
                          <p className="font-semibold">{item.title}</p>
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-6">
                            {item.description}
                          </p>
                        </div>

                        <Button variant="outline" size="sm" className="rounded-xl">
                          {item.cta}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}