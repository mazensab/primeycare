"use client";

/* ============================================================
   📂 app/system/whatsapp/broadcasts/page.tsx
   🧠 Primey Care | WhatsApp Broadcasts Page
   ------------------------------------------------------------
   ✅ إرسال رسائل WhatsApp مباشرة / جماعية
   ✅ عرض آخر عمليات البث
   ✅ بحث + فلترة + تصدير CSV
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ يستخدم sonner
   ✅ بدون localhost
   ✅ أرقام إنجليزية
============================================================ */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  Loader2,
  Megaphone,
  MessageCircle,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Settings,
  Smartphone,
  Trash2,
  TriangleAlert,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";

type WhatsAppBroadcast = {
  id: number | string;
  event_code?: string;
  trigger_source?: string;
  recipient_phone?: string;
  recipient_name?: string;
  recipient_role?: string;
  delivery_status?: string;
  provider_status?: string;
  external_message_id?: string;
  provider_message_id?: string;
  message_body?: string;
  payload_summary?: string;
  failure_reason?: string;
  error_message?: string;
  company_reference?: string;
  company_name?: string;
  language_code?: string;
  created_at?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  failed_at?: string | null;
};

type BroadcastsPayload = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  count?: number;
  results?: WhatsAppBroadcast[];
  data?: WhatsAppBroadcast[];
  logs?: WhatsAppBroadcast[];
};

type BroadcastForm = {
  recipient_phone: string;
  recipient_name: string;
  recipient_role: string;
  event_code: string;
  message_body: string;
  language_code: string;
};

/* ============================================================
   API Paths
============================================================ */

const API_PATHS = {
  dashboard: "/system/whatsapp",
  settings: "/system/whatsapp/settings",
  logs: "/system/whatsapp/logs",
  templates: "/system/whatsapp/templates",
  inbox: "/system/whatsapp/inbox",

  broadcasts: "/api/whatsapp/broadcasts/",
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

function getResults(payload: BroadcastsPayload | null): WhatsAppBroadcast[] {
  if (!payload) return [];
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.logs)) return payload.logs;
  return [];
}

function deliveryStatusClass(status: string) {
  const normalized = status.toUpperCase();

  if (["SENT", "DELIVERED", "READ"].includes(normalized)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  if (["QUEUED", "PENDING", "RETRYING"].includes(normalized)) {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300";
  }

  if (["FAILED", "CANCELLED", "ERROR"].includes(normalized)) {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300";
  }

  return "border-muted bg-muted text-muted-foreground";
}

function emptyForm(): BroadcastForm {
  return {
    recipient_phone: "",
    recipient_name: "",
    recipient_role: "customer",
    event_code: "manual_broadcast",
    message_body: "",
    language_code: "ar",
  };
}

function splitRecipients(value: string) {
  return value
    .split(/[\n,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function exportBroadcastsCsv(items: WhatsAppBroadcast[]) {
  const headers = [
    "id",
    "event_code",
    "recipient_phone",
    "recipient_name",
    "recipient_role",
    "delivery_status",
    "provider_status",
    "external_message_id",
    "message_body",
    "failure_reason",
    "created_at",
    "sent_at",
    "delivered_at",
    "read_at",
  ];

  const rows = items.map((item) => [
    item.id,
    item.event_code || "",
    item.recipient_phone || "",
    item.recipient_name || "",
    item.recipient_role || "",
    item.delivery_status || "",
    item.provider_status || "",
    item.external_message_id || item.provider_message_id || "",
    item.message_body || item.payload_summary || "",
    item.failure_reason || item.error_message || "",
    item.created_at || "",
    item.sent_at || "",
    item.delivered_at || "",
    item.read_at || "",
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `primey-whatsapp-broadcasts-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  anchor.click();

  URL.revokeObjectURL(url);
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    pageTitle: ar ? "بث واتساب" : "WhatsApp Broadcasts",
    pageSubtitle: ar
      ? "إرسال رسائل واتساب مباشرة ومتابعة آخر عمليات البث من النظام."
      : "Send direct WhatsApp messages and monitor the latest broadcast operations.",

    back: ar ? "لوحة واتساب" : "WhatsApp Dashboard",
    settings: ar ? "الإعدادات" : "Settings",
    logs: ar ? "السجلات" : "Logs",
    templates: ar ? "القوالب" : "Templates",

    refresh: ar ? "تحديث" : "Refresh",
    export: ar ? "تصدير" : "Export",
    send: ar ? "إرسال" : "Send",
    clear: ar ? "مسح" : "Clear",

    totalBroadcasts: ar ? "إجمالي الرسائل" : "Total Messages",
    sent: ar ? "مرسلة" : "Sent",
    delivered: ar ? "تم التسليم" : "Delivered",
    read: ar ? "مقروءة" : "Read",
    failed: ar ? "فاشلة" : "Failed",
    pending: ar ? "معلقة" : "Pending",

    composeTitle: ar ? "إرسال رسالة واتساب" : "Send WhatsApp Message",
    composeDesc: ar
      ? "يمكن إدخال رقم واحد أو عدة أرقام مفصولة بسطر جديد أو فاصلة."
      : "Enter one or multiple phone numbers separated by new lines or commas.",
    recipientPhone: ar ? "رقم / أرقام المستلمين" : "Recipient phone(s)",
    recipientPhonePlaceholder: ar
      ? "+966500000000 أو عدة أرقام كل رقم في سطر"
      : "+966500000000 or multiple numbers, one per line",
    recipientName: ar ? "اسم المستلم" : "Recipient Name",
    recipientRole: ar ? "نوع المستلم" : "Recipient Role",
    eventCode: ar ? "كود الحدث" : "Event Code",
    languageCode: ar ? "اللغة" : "Language",
    messageBody: ar ? "نص الرسالة" : "Message Body",
    messagePlaceholder: ar
      ? "اكتب رسالة واتساب هنا..."
      : "Write your WhatsApp message here...",

    filters: ar ? "الفلاتر" : "Filters",
    search: ar ? "ابحث في عمليات البث..." : "Search broadcasts...",
    all: ar ? "الكل" : "All",
    status: ar ? "الحالة" : "Status",

    tableTitle: ar ? "آخر عمليات البث" : "Recent Broadcasts",
    tableDesc: ar
      ? "قائمة الرسائل المرسلة من واجهة البث أو من النظام."
      : "Messages sent from broadcast tools or system events.",
    recipient: ar ? "المستلم" : "Recipient",
    event: ar ? "الحدث" : "Event",
    message: ar ? "الرسالة" : "Message",
    provider: ar ? "المزود" : "Provider",
    date: ar ? "التاريخ" : "Date",
    reference: ar ? "المرجع" : "Reference",
    error: ar ? "الخطأ" : "Error",

    noData: ar ? "لا توجد عمليات بث مطابقة." : "No matching broadcasts.",
    loading: ar ? "جاري تحميل بث واتساب..." : "Loading WhatsApp broadcasts...",
    loadFailed: ar ? "تعذر تحميل بث واتساب" : "Could not load broadcasts",
    sentOk: ar ? "تم إرسال رسالة واتساب" : "WhatsApp message sent",
    sendFailed: ar ? "تعذر إرسال رسالة واتساب" : "Could not send WhatsApp message",
    actionDone: ar ? "تم تحديث البيانات" : "Data refreshed",

    quickAccess: ar ? "الوصول السريع" : "Quick Access",
    quickAccessDesc: ar
      ? "روابط مباشرة لباقي صفحات واتساب."
      : "Direct links to other WhatsApp pages.",
    open: ar ? "فتح" : "Open",

    noteTitle: ar ? "ملاحظات مهمة" : "Important Notes",
    note1: ar
      ? "هذه الصفحة تستخدم قناة واتساب الرسمية في النظام، ويجب ضبط الإعدادات قبل الإرسال."
      : "This page uses the system WhatsApp channel; settings must be configured before sending.",
    note2: ar
      ? "للبث الكبير لاحقًا يمكن ربط قائمة العملاء أو المندوبين بدل إدخال الأرقام يدويًا."
      : "Large broadcasts can later be linked to customer or agent lists instead of manual numbers.",
    note3: ar
      ? "كل رسالة يتم تسجيلها في سجلات واتساب ويمكن تتبع حالتها لاحقًا."
      : "Every message is recorded in WhatsApp logs and can be tracked later.",
  };
}

/* ============================================================
   Page
============================================================ */

export default function SystemWhatsAppBroadcastsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [broadcasts, setBroadcasts] = useState<WhatsAppBroadcast[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [form, setForm] = useState<BroadcastForm>(() => emptyForm());

  const t = useMemo(() => dictionary(locale), [locale]);
  const dir = locale === "ar" ? "rtl" : "ltr";

  const filteredBroadcasts = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return broadcasts.filter((item) => {
      const status = safeString(item.delivery_status).toUpperCase();

      const statusMatches =
        statusFilter === "ALL" || status === statusFilter.toUpperCase();

      if (!statusMatches) return false;

      if (!cleanQuery) return true;

      return (
        safeString(item.event_code).toLowerCase().includes(cleanQuery) ||
        safeString(item.recipient_phone).toLowerCase().includes(cleanQuery) ||
        safeString(item.recipient_name).toLowerCase().includes(cleanQuery) ||
        safeString(item.message_body || item.payload_summary)
          .toLowerCase()
          .includes(cleanQuery) ||
        safeString(item.external_message_id || item.provider_message_id)
          .toLowerCase()
          .includes(cleanQuery)
      );
    });
  }, [broadcasts, query, statusFilter]);

  const stats = useMemo(() => {
    const total = broadcasts.length;

    const sent = broadcasts.filter((item) =>
      ["SENT", "DELIVERED", "READ"].includes(
        safeString(item.delivery_status).toUpperCase(),
      ),
    ).length;

    const delivered = broadcasts.filter(
      (item) => safeString(item.delivery_status).toUpperCase() === "DELIVERED",
    ).length;

    const read = broadcasts.filter(
      (item) => safeString(item.delivery_status).toUpperCase() === "READ",
    ).length;

    const failed = broadcasts.filter(
      (item) => safeString(item.delivery_status).toUpperCase() === "FAILED",
    ).length;

    const pending = broadcasts.filter((item) =>
      ["PENDING", "QUEUED", "RETRYING"].includes(
        safeString(item.delivery_status).toUpperCase(),
      ),
    ).length;

    return {
      total,
      sent,
      delivered,
      read,
      failed,
      pending,
    };
  }, [broadcasts]);

  const recipientCount = useMemo(
    () => splitRecipients(form.recipient_phone).length,
    [form.recipient_phone],
  );

  const quickLinks = useMemo(
    () => [
      {
        href: API_PATHS.dashboard,
        icon: MessageCircle,
        title: t.back,
        description:
          locale === "ar"
            ? "الرجوع إلى لوحة واتساب الرئيسية."
            : "Return to WhatsApp dashboard.",
      },
      {
        href: API_PATHS.settings,
        icon: Settings,
        title: t.settings,
        description:
          locale === "ar"
            ? "إعداد الاتصال والتوكن والجلسة."
            : "Configure connection, tokens, and session.",
      },
      {
        href: API_PATHS.logs,
        icon: FileText,
        title: t.logs,
        description:
          locale === "ar"
            ? "متابعة سجلات الإرسال."
            : "Review delivery logs.",
      },
      {
        href: API_PATHS.templates,
        icon: FileText,
        title: t.templates,
        description:
          locale === "ar"
            ? "إدارة قوالب الرسائل."
            : "Manage message templates.",
      },
    ],
    [locale, t],
  );

  async function loadBroadcasts(showToast = false) {
    try {
      setLoading(true);

      const response = await fetch(API_PATHS.broadcasts, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = (await response.json().catch(() => null)) as BroadcastsPayload | null;

      if (!response.ok) {
        toast.error(payload?.message || t.loadFailed);
        setBroadcasts([]);
        return;
      }

      setBroadcasts(getResults(payload));

      if (showToast) {
        toast.success(t.actionDone);
      }
    } catch (error) {
      console.error("WhatsApp broadcasts load failed:", error);
      toast.error(t.loadFailed);
      setBroadcasts([]);
    } finally {
      setLoading(false);
    }
  }

  async function sendBroadcast() {
    const phones = splitRecipients(form.recipient_phone);

    if (phones.length === 0) {
      toast.error(
        locale === "ar"
          ? "أدخل رقم مستلم واحد على الأقل"
          : "Enter at least one recipient phone number",
      );
      return;
    }

    if (!form.message_body.trim()) {
      toast.error(
        locale === "ar" ? "اكتب نص الرسالة" : "Write the message body",
      );
      return;
    }

    try {
      setSending(true);

      const csrfToken = getCSRFToken();

      const response = await fetch(API_PATHS.broadcasts, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
        body: JSON.stringify({
          recipient_phone: form.recipient_phone,
          recipient_phones: phones,
          recipient_name: form.recipient_name,
          recipient_role: form.recipient_role,
          event_code: form.event_code,
          message_body: form.message_body,
          message: form.message_body,
          language_code: form.language_code,
        }),
      });

      const payload = (await response.json().catch(() => null)) as BroadcastsPayload | null;

      if (!response.ok) {
        toast.error(payload?.message || t.sendFailed);
        return;
      }

      toast.success(payload?.message || t.sentOk);
      setForm(emptyForm());
      await loadBroadcasts(false);
    } catch (error) {
      console.error("WhatsApp broadcast send failed:", error);
      toast.error(t.sendFailed);
    } finally {
      setSending(false);
    }
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("ALL");
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
    void loadBroadcasts(false);
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

          <Button variant="outline" onClick={() => loadBroadcasts(true)}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
            {t.refresh}
          </Button>

          <Button
            variant="outline"
            onClick={() => exportBroadcastsCsv(filteredBroadcasts)}
            disabled={filteredBroadcasts.length === 0}
          >
            <Download className="size-4" />
            {t.export}
          </Button>

          <Button asChild>
            <Link href={API_PATHS.settings}>
              <Settings className="size-4" />
              {t.settings}
            </Link>
          </Button>
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title={t.totalBroadcasts} value={stats.total} icon={Megaphone} />
        <StatCard title={t.sent} value={stats.sent} icon={CheckCircle2} />
        <StatCard title={t.delivered} value={stats.delivered} icon={Send} />
        <StatCard title={t.read} value={stats.read} icon={MessageCircle} />
        <StatCard title={t.failed} value={stats.failed} icon={XCircle} />
        <StatCard title={t.pending} value={stats.pending} icon={Clock} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.72fr_1.35fr]">
        {/* Compose */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.composeTitle}</CardTitle>
              <CardDescription>{t.composeDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <Field label={t.recipientPhone}>
                <textarea
                  value={form.recipient_phone}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      recipient_phone: event.target.value,
                    }))
                  }
                  rows={4}
                  className="bg-background w-full rounded-md border px-3 py-2 text-sm"
                  placeholder={t.recipientPhonePlaceholder}
                />
              </Field>

              <div className="rounded-2xl border bg-background p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {locale === "ar" ? "عدد المستلمين" : "Recipients count"}
                  </span>
                  <Badge variant="secondary">{recipientCount}</Badge>
                </div>
              </div>

              <Field label={t.recipientName}>
                <Input
                  value={form.recipient_name}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      recipient_name: event.target.value,
                    }))
                  }
                  placeholder={locale === "ar" ? "اختياري" : "Optional"}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t.recipientRole}>
                  <select
                    value={form.recipient_role}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        recipient_role: event.target.value,
                      }))
                    }
                    className="bg-background h-10 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="customer">customer</option>
                    <option value="agent">agent</option>
                    <option value="provider">provider</option>
                    <option value="user">user</option>
                  </select>
                </Field>

                <Field label={t.languageCode}>
                  <select
                    value={form.language_code}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        language_code: event.target.value,
                      }))
                    }
                    className="bg-background h-10 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="ar">ar</option>
                    <option value="en">en</option>
                  </select>
                </Field>
              </div>

              <Field label={t.eventCode}>
                <Input
                  value={form.event_code}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      event_code: event.target.value,
                    }))
                  }
                  placeholder="manual_broadcast"
                />
              </Field>

              <Field label={t.messageBody}>
                <textarea
                  value={form.message_body}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      message_body: event.target.value,
                    }))
                  }
                  rows={8}
                  className="bg-background w-full rounded-md border px-3 py-2 text-sm"
                  placeholder={t.messagePlaceholder}
                />
              </Field>

              <div className="grid gap-2">
                <Button onClick={sendBroadcast} disabled={sending}>
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {t.send}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setForm(emptyForm())}
                  disabled={sending}
                >
                  <Trash2 className="size-4" />
                  {t.clear}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.noteTitle}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
              <div className="flex gap-2">
                <TriangleAlert className="mt-1 size-4 text-amber-600" />
                <span>{t.note1}</span>
              </div>
              <div className="flex gap-2">
                <Plus className="mt-1 size-4 text-emerald-600" />
                <span>{t.note2}</span>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="mt-1 size-4 text-emerald-600" />
                <span>{t.note3}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* List */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.filters}</CardTitle>
              <CardDescription>
                {locale === "ar"
                  ? "فلترة عمليات البث حسب الحالة أو النص أو المستلم."
                  : "Filter broadcasts by status, text, or recipient."}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
                <div className="relative">
                  <Search className="text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t.search}
                    className="ps-10"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="bg-background h-10 rounded-md border px-3 text-sm"
                >
                  <option value="ALL">{t.all}</option>
                  <option value="PENDING">PENDING</option>
                  <option value="QUEUED">QUEUED</option>
                  <option value="SENT">SENT</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="READ">READ</option>
                  <option value="FAILED">FAILED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>

                <Button variant="outline" onClick={resetFilters}>
                  <Filter className="size-4" />
                  {t.all}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>{t.tableTitle}</CardTitle>
                  <CardDescription>{t.tableDesc}</CardDescription>
                </div>

                <Badge variant="secondary">
                  {t.totalBroadcasts}: {filteredBroadcasts.length}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-hidden rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.recipient}</TableHead>
                      <TableHead>{t.event}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead>{t.message}</TableHead>
                      <TableHead>{t.date}</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
                            <Loader2 className="size-4 animate-spin" />
                            {t.loading}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredBroadcasts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <div className="text-muted-foreground py-12 text-center text-sm">
                            {t.noData}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredBroadcasts.map((item) => {
                        const statusValue = safeString(
                          item.delivery_status,
                          "PENDING",
                        );

                        const messageText = safeString(
                          item.message_body || item.payload_summary,
                          "-",
                        );

                        const reference = safeString(
                          item.external_message_id || item.provider_message_id,
                          "",
                        );

                        const errorText = safeString(
                          item.failure_reason || item.error_message,
                          "",
                        );

                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Smartphone className="text-muted-foreground size-4" />
                                  <span className="font-medium">
                                    {safeString(item.recipient_phone, "-")}
                                  </span>
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  {safeString(item.recipient_name, "-")}
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="space-y-1">
                                <Badge variant="secondary">
                                  {safeString(item.event_code, "manual_broadcast")}
                                </Badge>
                                <div className="text-muted-foreground text-xs">
                                  {safeString(item.trigger_source, "-")}
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="space-y-2">
                                <Badge className={deliveryStatusClass(statusValue)}>
                                  {statusValue}
                                </Badge>
                                <div className="text-muted-foreground text-xs">
                                  {safeString(item.provider_status, "-")}
                                </div>
                                {errorText ? (
                                  <div className="text-red-600 line-clamp-2 text-xs">
                                    {errorText}
                                  </div>
                                ) : null}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="max-w-[420px] space-y-1">
                                <p className="line-clamp-2 text-sm leading-6">
                                  {messageText}
                                </p>

                                {reference ? (
                                  <p className="text-muted-foreground line-clamp-1 text-xs">
                                    {t.reference}: {reference}
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="text-muted-foreground flex items-center gap-1 text-xs">
                                <Clock className="size-3.5" />
                                {formatDate(item.created_at)}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.quickAccess}</CardTitle>
              <CardDescription>{t.quickAccessDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-3 md:grid-cols-2">
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
        </div>
      </section>
    </main>
  );
}

/* ============================================================
   Small Components
============================================================ */

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-5">
        <div>
          <p className="text-muted-foreground text-sm">{title}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
        </div>

        <div className="rounded-2xl border bg-background/70 p-3">
          <Icon className="text-muted-foreground size-6" />
        </div>
      </CardContent>
    </Card>
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
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}