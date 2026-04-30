"use client";

/* ============================================================
   📂 app/system/whatsapp/inbox/page.tsx
   🧠 Primey Care | WhatsApp Inbox Page
   ------------------------------------------------------------
   ✅ صندوق محادثات WhatsApp الواردة
   ✅ عرض المحادثات + الرسائل
   ✅ تعليم كمقروء + تغيير الحالة + تثبيت + حل المحادثة
   ✅ بحث + فلاتر + ملخصات
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
  FileText,
  Filter,
  Inbox,
  Loader2,
  MessageCircle,
  MessageSquareText,
  Pin,
  PinOff,
  RefreshCcw,
  Search,
  Send,
  Settings,
  Smartphone,
  UserRound,
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

type WhatsAppContact = {
  id?: number | string;
  phone_number?: string;
  display_name?: string;
  push_name?: string;
  profile_name?: string;
  wa_jid?: string;
  is_blocked?: boolean;
  is_business?: boolean;
};

type WhatsAppConversation = {
  id: number | string;
  scope_type?: string;
  company_reference?: string;
  company_name?: string;
  status?: string;
  subject?: string;
  assigned_to_id?: number | string | null;
  assigned_to_name?: string;
  session_name?: string;
  unread_count?: number;
  last_message_preview?: string;
  last_message_at?: string | null;
  is_pinned?: boolean;
  is_muted?: boolean;
  is_resolved?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  contact?: WhatsAppContact;
};

type WhatsAppMessage = {
  id: number | string;
  conversation_id?: number | string;
  direction?: string;
  message_type?: string;
  external_message_id?: string;
  provider?: string;
  provider_status?: string;
  delivery_status?: string;
  sender_phone?: string;
  sender_name?: string;
  body_text?: string;
  caption?: string;
  attachment_url?: string;
  attachment_name?: string;
  mime_type?: string;
  media_type?: string;
  is_read?: boolean;
  is_from_me?: boolean;
  message_created_at?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  failed_at?: string | null;
  created_at?: string | null;
};

type InboxSummary = {
  total_conversations?: number;
  open_conversations?: number;
  closed_conversations?: number;
  archived_conversations?: number;
  spam_conversations?: number;
  resolved_conversations?: number;
  unread_conversations?: number;
  unread_messages?: number;
  total_messages?: number;
  [key: string]: unknown;
};

type ConversationsPayload = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  count?: number;
  results?: WhatsAppConversation[];
  data?: WhatsAppConversation[];
  summary?: InboxSummary;
};

type MessagesPayload = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  count?: number;
  results?: WhatsAppMessage[];
  data?: WhatsAppMessage[];
  conversation?: WhatsAppConversation;
};

type SummaryPayload = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  summary?: InboxSummary;
  data?: InboxSummary;
};

/* ============================================================
   API Paths
============================================================ */

const API_PATHS = {
  dashboard: "/system/whatsapp",
  settings: "/system/whatsapp/settings",
  logs: "/system/whatsapp/logs",
  templates: "/system/whatsapp/templates",
  broadcasts: "/system/whatsapp/broadcasts",

  summary: "/api/whatsapp/inbox/summary/",
  conversations: "/api/whatsapp/inbox/",
  detail: (id: number | string) => `/api/whatsapp/inbox/${id}/`,
  messages: (id: number | string) => `/api/whatsapp/inbox/${id}/messages/`,
  markRead: (id: number | string) => `/api/whatsapp/inbox/${id}/mark-read/`,
  updateStatus: (id: number | string) => `/api/whatsapp/inbox/${id}/status/`,
  toggleResolved: (id: number | string) =>
    `/api/whatsapp/inbox/${id}/toggle-resolved/`,
  togglePinned: (id: number | string) =>
    `/api/whatsapp/inbox/${id}/toggle-pinned/`,
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

function getConversationResults(
  payload: ConversationsPayload | null,
): WhatsAppConversation[] {
  if (!payload) return [];
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function getMessageResults(payload: MessagesPayload | null): WhatsAppMessage[] {
  if (!payload) return [];
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function statusClass(status: string) {
  const normalized = status.toUpperCase();

  if (normalized === "OPEN") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300";
  }

  if (normalized === "CLOSED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  if (normalized === "ARCHIVED") {
    return "border-muted bg-muted text-muted-foreground";
  }

  if (normalized === "SPAM") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300";
  }

  return "border-muted bg-muted text-muted-foreground";
}

function directionClass(direction: string) {
  const normalized = direction.toUpperCase();

  if (normalized === "OUTBOUND") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300";
}

function contactName(conversation: WhatsAppConversation) {
  return (
    safeString(conversation.contact?.display_name) ||
    safeString(conversation.contact?.push_name) ||
    safeString(conversation.contact?.profile_name) ||
    safeString(conversation.contact?.phone_number) ||
    `Conversation #${conversation.id}`
  );
}

function contactPhone(conversation: WhatsAppConversation) {
  return safeString(conversation.contact?.phone_number, "-");
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    pageTitle: ar ? "صندوق واتساب" : "WhatsApp Inbox",
    pageSubtitle: ar
      ? "متابعة محادثات واتساب الواردة، الرسائل، الحالات، والتعيين التشغيلي."
      : "Monitor inbound WhatsApp conversations, messages, status, and operational handling.",

    back: ar ? "لوحة واتساب" : "WhatsApp Dashboard",
    settings: ar ? "الإعدادات" : "Settings",
    logs: ar ? "السجلات" : "Logs",
    templates: ar ? "القوالب" : "Templates",
    broadcasts: ar ? "البث" : "Broadcasts",

    refresh: ar ? "تحديث" : "Refresh",
    filters: ar ? "الفلاتر" : "Filters",
    search: ar ? "ابحث في المحادثات..." : "Search conversations...",
    all: ar ? "الكل" : "All",
    status: ar ? "الحالة" : "Status",
    assignedTo: ar ? "المسند إلى" : "Assigned To",
    onlyUnread: ar ? "غير المقروءة فقط" : "Unread Only",
    resolved: ar ? "تم الحل" : "Resolved",
    unresolved: ar ? "غير محلولة" : "Unresolved",

    totalConversations: ar ? "إجمالي المحادثات" : "Total Conversations",
    openConversations: ar ? "المفتوحة" : "Open",
    unreadConversations: ar ? "غير المقروءة" : "Unread",
    resolvedConversations: ar ? "المحلولة" : "Resolved",
    unreadMessages: ar ? "رسائل غير مقروءة" : "Unread Messages",
    totalMessages: ar ? "إجمالي الرسائل" : "Total Messages",

    conversationsTitle: ar ? "المحادثات" : "Conversations",
    conversationsDesc: ar
      ? "قائمة المحادثات الواردة من بوابة واتساب."
      : "Inbound conversations received from the WhatsApp gateway.",
    messagesTitle: ar ? "الرسائل" : "Messages",
    messagesDesc: ar
      ? "اختر محادثة من القائمة لعرض الرسائل."
      : "Select a conversation to view messages.",

    markRead: ar ? "تعليم كمقروء" : "Mark Read",
    markResolved: ar ? "حل المحادثة" : "Mark Resolved",
    reopen: ar ? "إعادة فتح" : "Reopen",
    pin: ar ? "تثبيت" : "Pin",
    unpin: ar ? "إلغاء التثبيت" : "Unpin",
    changeStatus: ar ? "تغيير الحالة" : "Change Status",

    contact: ar ? "جهة الاتصال" : "Contact",
    lastMessage: ar ? "آخر رسالة" : "Last Message",
    lastActivity: ar ? "آخر نشاط" : "Last Activity",
    sessionName: ar ? "الجلسة" : "Session",
    messageType: ar ? "نوع الرسالة" : "Message Type",
    direction: ar ? "الاتجاه" : "Direction",
    provider: ar ? "المزود" : "Provider",
    delivered: ar ? "تم التسليم" : "Delivered",
    read: ar ? "مقروءة" : "Read",

    noConversations: ar
      ? "لا توجد محادثات مطابقة."
      : "No matching conversations.",
    noMessages: ar ? "لا توجد رسائل في هذه المحادثة." : "No messages in this conversation.",
    selectConversation: ar
      ? "اختر محادثة لعرض تفاصيلها."
      : "Select a conversation to view details.",
    loading: ar ? "جاري تحميل صندوق واتساب..." : "Loading WhatsApp inbox...",
    loadFailed: ar ? "تعذر تحميل صندوق واتساب" : "Could not load WhatsApp inbox",
    messagesLoadFailed: ar ? "تعذر تحميل الرسائل" : "Could not load messages",
    actionDone: ar ? "تم تنفيذ العملية" : "Action completed",
    actionFailed: ar ? "تعذر تنفيذ العملية" : "Action failed",

    quickAccess: ar ? "الوصول السريع" : "Quick Access",
    quickAccessDesc: ar
      ? "روابط مباشرة لباقي صفحات واتساب."
      : "Direct links to other WhatsApp pages.",
    open: ar ? "فتح" : "Open",

    noteTitle: ar ? "ملاحظات تشغيلية" : "Operational Notes",
    note1: ar
      ? "الصندوق يعرض الرسائل الواردة من Webhook فقط."
      : "The inbox displays inbound messages received through webhook.",
    note2: ar
      ? "سجلات الرسائل الخارجة تظهر في صفحة السجلات."
      : "Outbound message logs are available in the logs page.",
    note3: ar
      ? "الرد المباشر من داخل الصندوق يمكن إضافته لاحقًا بعد اعتماد endpoint الإرسال داخل المحادثة."
      : "Direct replies can be added later after approving a conversation reply endpoint.",
  };
}

/* ============================================================
   Page
============================================================ */

export default function SystemWhatsAppInboxPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [summary, setSummary] = useState<InboxSummary>({});
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<WhatsAppConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [isResolvedFilter, setIsResolvedFilter] = useState("ALL");
  const [assignedToId, setAssignedToId] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const dir = locale === "ar" ? "rtl" : "ltr";

  const stats = useMemo(
    () => ({
      total: safeNumber(summary.total_conversations, conversations.length),
      open: safeNumber(summary.open_conversations),
      unread: safeNumber(summary.unread_conversations),
      resolved: safeNumber(summary.resolved_conversations),
      unreadMessages: safeNumber(summary.unread_messages),
      totalMessages: safeNumber(summary.total_messages),
    }),
    [summary, conversations.length],
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
            ? "متابعة سجلات الرسائل الخارجة."
            : "Review outbound message logs.",
      },
      {
        href: API_PATHS.broadcasts,
        icon: Send,
        title: t.broadcasts,
        description:
          locale === "ar"
            ? "إرسال رسائل واتساب مباشرة."
            : "Send direct WhatsApp messages.",
      },
    ],
    [locale, t],
  );

  async function fetchSummary() {
    const params = new URLSearchParams();

    if (query.trim()) params.set("search", query.trim());
    if (assignedToId.trim()) params.set("assigned_to_id", assignedToId.trim());

    const url = params.toString()
      ? `${API_PATHS.summary}?${params.toString()}`
      : API_PATHS.summary;

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    const payload = (await response.json().catch(() => null)) as SummaryPayload | null;

    if (!response.ok) {
      throw new Error(payload?.message || t.loadFailed);
    }

    setSummary(payload?.summary || payload?.data || {});
  }

  async function fetchConversations() {
    const params = new URLSearchParams();

    params.set("limit", "200");

    if (query.trim()) params.set("search", query.trim());
    if (statusFilter.trim()) params.set("status", statusFilter.trim());
    if (assignedToId.trim()) params.set("assigned_to_id", assignedToId.trim());
    if (onlyUnread) params.set("only_unread", "true");
    if (isResolvedFilter !== "ALL") {
      params.set("is_resolved", isResolvedFilter === "RESOLVED" ? "true" : "false");
    }

    const response = await fetch(
      `${API_PATHS.conversations}?${params.toString()}`,
      {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    );

    const payload = (await response.json().catch(() => null)) as ConversationsPayload | null;

    if (!response.ok) {
      throw new Error(payload?.message || t.loadFailed);
    }

    const results = getConversationResults(payload);
    setConversations(results);

    if (selectedConversation) {
      const updatedSelected = results.find(
        (item) => String(item.id) === String(selectedConversation.id),
      );

      if (updatedSelected) {
        setSelectedConversation(updatedSelected);
      }
    }
  }

  async function loadInbox(showToast = false) {
    try {
      setLoading(true);

      await Promise.all([fetchSummary(), fetchConversations()]);

      if (showToast) toast.success(t.actionDone);
    } catch (error) {
      console.error("WhatsApp inbox load failed:", error);
      toast.error(error instanceof Error ? error.message : t.loadFailed);
      setSummary({});
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(conversation: WhatsAppConversation) {
    try {
      setMessagesLoading(true);
      setSelectedConversation(conversation);

      const response = await fetch(API_PATHS.messages(conversation.id), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const payload = (await response.json().catch(() => null)) as MessagesPayload | null;

      if (!response.ok) {
        toast.error(payload?.message || t.messagesLoadFailed);
        setMessages([]);
        return;
      }

      setMessages(getMessageResults(payload));
      if (payload?.conversation) setSelectedConversation(payload.conversation);
    } catch (error) {
      console.error("WhatsApp messages load failed:", error);
      toast.error(t.messagesLoadFailed);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function postConversationAction(
    url: string,
    body: Record<string, unknown> = {},
    reloadMessages = true,
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
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(payload?.message || t.actionFailed);
        return;
      }

      toast.success(payload?.message || t.actionDone);

      await Promise.all([fetchSummary(), fetchConversations()]);

      if (reloadMessages && selectedConversation) {
        await loadMessages(selectedConversation);
      }
    } catch (error) {
      console.error("WhatsApp inbox action failed:", error);
      toast.error(t.actionFailed);
    } finally {
      setActionLoading(false);
    }
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("");
    setOnlyUnread(false);
    setIsResolvedFilter("ALL");
    setAssignedToId("");

    window.setTimeout(() => {
      void loadInbox(false);
    }, 0);
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
    void loadInbox(false);
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

          <Button variant="outline" onClick={() => loadInbox(true)}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
            {t.refresh}
          </Button>

          <Button asChild>
            <Link href={API_PATHS.logs}>
              <FileText className="size-4" />
              {t.logs}
            </Link>
          </Button>
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title={t.totalConversations} value={stats.total} icon={Inbox} />
        <StatCard title={t.openConversations} value={stats.open} icon={MessageCircle} />
        <StatCard title={t.unreadConversations} value={stats.unread} icon={MessageSquareText} />
        <StatCard title={t.resolvedConversations} value={stats.resolved} icon={CheckCircle2} />
        <StatCard title={t.unreadMessages} value={stats.unreadMessages} icon={Smartphone} />
        <StatCard title={t.totalMessages} value={stats.totalMessages} icon={FileText} />
      </section>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t.filters}</CardTitle>
          <CardDescription>
            {locale === "ar"
              ? "فلترة المحادثات حسب الحالة والبحث والمقروءة والحل."
              : "Filter conversations by status, search, unread, and resolved state."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 xl:grid-cols-[1.4fr_0.8fr_0.9fr_0.9fr_0.9fr_auto]">
            <div className="relative">
              <Search className="text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.search}
                className="ps-10"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void loadInbox(false);
                }}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="bg-background h-10 rounded-md border px-3 text-sm"
            >
              <option value="">{t.all}</option>
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
              <option value="ARCHIVED">ARCHIVED</option>
              <option value="SPAM">SPAM</option>
            </select>

            <select
              value={isResolvedFilter}
              onChange={(event) => setIsResolvedFilter(event.target.value)}
              className="bg-background h-10 rounded-md border px-3 text-sm"
            >
              <option value="ALL">{t.all}</option>
              <option value="RESOLVED">{t.resolved}</option>
              <option value="UNRESOLVED">{t.unresolved}</option>
            </select>

            <Input
              value={assignedToId}
              onChange={(event) => setAssignedToId(event.target.value)}
              placeholder={t.assignedTo}
            />

            <label className="flex h-10 cursor-pointer items-center justify-between gap-3 rounded-md border px-3 text-sm">
              <span>{t.onlyUnread}</span>
              <input
                type="checkbox"
                checked={onlyUnread}
                onChange={(event) => setOnlyUnread(event.target.checked)}
                className="size-4"
              />
            </label>

            <div className="flex gap-2">
              <Button onClick={() => loadInbox(false)} disabled={loading}>
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Filter className="size-4" />
                )}
                {t.filters}
              </Button>

              <Button variant="outline" onClick={resetFilters}>
                {t.all}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.25fr_0.55fr]">
        {/* Conversations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>{t.conversationsTitle}</CardTitle>
                <CardDescription>{t.conversationsDesc}</CardDescription>
              </div>
              <Badge variant="secondary">{conversations.length}</Badge>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
                <Loader2 className="size-4 animate-spin" />
                {t.loading}
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-muted-foreground rounded-2xl border border-dashed py-12 text-center text-sm">
                {t.noConversations}
              </div>
            ) : (
              <div className="max-h-[720px] space-y-3 overflow-y-auto pe-1">
                {conversations.map((conversation) => {
                  const isSelected =
                    selectedConversation &&
                    String(selectedConversation.id) === String(conversation.id);

                  const statusValue = safeString(conversation.status, "OPEN");
                  const unread = safeNumber(conversation.unread_count);

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => loadMessages(conversation)}
                      className={[
                        "w-full rounded-2xl border p-4 text-start transition hover:bg-muted/50",
                        isSelected ? "border-primary bg-primary/5" : "bg-background",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <UserRound className="text-muted-foreground size-4" />
                            <p className="truncate font-medium">
                              {contactName(conversation)}
                            </p>
                          </div>

                          <p className="text-muted-foreground mt-1 text-xs">
                            {contactPhone(conversation)}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          {conversation.is_pinned ? (
                            <Pin className="size-4 text-amber-600" />
                          ) : null}

                          {unread > 0 ? (
                            <Badge>{unread}</Badge>
                          ) : (
                            <Badge variant="outline">0</Badge>
                          )}
                        </div>
                      </div>

                      <p className="text-muted-foreground mt-3 line-clamp-2 text-sm leading-6">
                        {safeString(conversation.last_message_preview, "-")}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge className={statusClass(statusValue)}>
                          {statusValue}
                        </Badge>

                        {conversation.is_resolved ? (
                          <Badge variant="outline">{t.resolved}</Badge>
                        ) : (
                          <Badge variant="secondary">{t.unresolved}</Badge>
                        )}

                        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                          <Clock className="size-3.5" />
                          {formatDate(conversation.last_message_at)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Messages */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>{t.messagesTitle}</CardTitle>
                <CardDescription>
                  {selectedConversation ? contactName(selectedConversation) : t.messagesDesc}
                </CardDescription>
              </div>

              {selectedConversation ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={statusClass(safeString(selectedConversation.status, "OPEN"))}>
                    {safeString(selectedConversation.status, "OPEN")}
                  </Badge>

                  <Badge variant="secondary">
                    {contactPhone(selectedConversation)}
                  </Badge>
                </div>
              ) : null}
            </div>
          </CardHeader>

          <CardContent>
            {!selectedConversation ? (
              <div className="text-muted-foreground rounded-2xl border border-dashed py-24 text-center text-sm">
                {t.selectConversation}
              </div>
            ) : messagesLoading ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-24 text-sm">
                <Loader2 className="size-4 animate-spin" />
                {t.loading}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-muted-foreground rounded-2xl border border-dashed py-24 text-center text-sm">
                {t.noMessages}
              </div>
            ) : (
              <div className="max-h-[720px] space-y-4 overflow-y-auto pe-1">
                {messages.map((message) => {
                  const direction = safeString(message.direction, "INBOUND");
                  const isOutbound =
                    direction.toUpperCase() === "OUTBOUND" || message.is_from_me;

                  const body = safeString(
                    message.body_text || message.caption || message.attachment_name,
                    "-",
                  );

                  return (
                    <div
                      key={message.id}
                      className={[
                        "flex",
                        isOutbound ? "justify-end" : "justify-start",
                      ].join(" ")}
                    >
                      <div
                        className={[
                          "max-w-[82%] rounded-2xl border p-4",
                          isOutbound
                            ? "bg-primary text-primary-foreground"
                            : "bg-background",
                        ].join(" ")}
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge
                            className={
                              isOutbound
                                ? "border-white/20 bg-white/15 text-white"
                                : directionClass(direction)
                            }
                          >
                            {direction}
                          </Badge>

                          <Badge
                            variant={isOutbound ? "outline" : "secondary"}
                            className={isOutbound ? "border-white/20 text-white" : ""}
                          >
                            {safeString(message.message_type, "TEXT")}
                          </Badge>

                          {message.delivery_status ? (
                            <Badge
                              variant={isOutbound ? "outline" : "secondary"}
                              className={isOutbound ? "border-white/20 text-white" : ""}
                            >
                              {message.delivery_status}
                            </Badge>
                          ) : null}
                        </div>

                        <p className="whitespace-pre-wrap text-sm leading-7">
                          {body}
                        </p>

                        {message.attachment_url ? (
                          <a
                            href={message.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className={[
                              "mt-3 block text-xs underline",
                              isOutbound ? "text-white" : "text-primary",
                            ].join(" ")}
                          >
                            {safeString(message.attachment_name, "Attachment")}
                          </a>
                        ) : null}

                        <div
                          className={[
                            "mt-3 flex flex-wrap items-center gap-2 text-xs",
                            isOutbound
                              ? "text-primary-foreground/80"
                              : "text-muted-foreground",
                          ].join(" ")}
                        >
                          <span>{safeString(message.sender_name || message.sender_phone, "-")}</span>
                          <span>·</span>
                          <span>
                            {formatDate(message.message_created_at || message.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.changeStatus}</CardTitle>
              <CardDescription>
                {selectedConversation
                  ? contactName(selectedConversation)
                  : t.selectConversation}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <Button
                className="w-full"
                variant="outline"
                disabled={!selectedConversation || actionLoading}
                onClick={() =>
                  selectedConversation &&
                  postConversationAction(
                    API_PATHS.markRead(selectedConversation.id),
                    {},
                  )
                }
              >
                {actionLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {t.markRead}
              </Button>

              <Button
                className="w-full"
                variant="outline"
                disabled={!selectedConversation || actionLoading}
                onClick={() =>
                  selectedConversation &&
                  postConversationAction(
                    API_PATHS.toggleResolved(selectedConversation.id),
                    { is_resolved: !selectedConversation.is_resolved },
                  )
                }
              >
                {selectedConversation?.is_resolved ? (
                  <XCircle className="size-4" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {selectedConversation?.is_resolved ? t.reopen : t.markResolved}
              </Button>

              <Button
                className="w-full"
                variant="outline"
                disabled={!selectedConversation || actionLoading}
                onClick={() =>
                  selectedConversation &&
                  postConversationAction(
                    API_PATHS.togglePinned(selectedConversation.id),
                    { is_pinned: !selectedConversation.is_pinned },
                  )
                }
              >
                {selectedConversation?.is_pinned ? (
                  <PinOff className="size-4" />
                ) : (
                  <Pin className="size-4" />
                )}
                {selectedConversation?.is_pinned ? t.unpin : t.pin}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                {["OPEN", "CLOSED", "ARCHIVED", "SPAM"].map((status) => (
                  <Button
                    key={status}
                    variant="outline"
                    size="sm"
                    disabled={!selectedConversation || actionLoading}
                    onClick={() =>
                      selectedConversation &&
                      postConversationAction(
                        API_PATHS.updateStatus(selectedConversation.id),
                        { status },
                      )
                    }
                  >
                    {status}
                  </Button>
                ))}
              </div>
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
              <CardTitle>{t.noteTitle}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
              <div className="flex gap-2">
                <Inbox className="mt-1 size-4 text-emerald-600" />
                <span>{t.note1}</span>
              </div>
              <div className="flex gap-2">
                <FileText className="mt-1 size-4 text-emerald-600" />
                <span>{t.note2}</span>
              </div>
              <div className="flex gap-2">
                <Send className="mt-1 size-4 text-emerald-600" />
                <span>{t.note3}</span>
              </div>
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