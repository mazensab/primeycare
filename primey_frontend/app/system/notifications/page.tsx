"use client";

/* ============================================================
   📂 app/system/notifications/page.tsx
   🧠 Primey Care | Notifications Dashboard Page
   ------------------------------------------------------------
   ✅ لوحة إشعارات المستخدم الحالي
   ✅ تعتمد على Inbox API فقط لتجنب redirect 301
   ✅ تدعم: counts / latest / mark_all_read
============================================================ */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
  Clock,
  Eye,
  Inbox,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCcw,
  Settings,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
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

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";

type NotificationItem = {
  id: number | string;
  title: string;
  message: string;
  notification_type: string;
  severity: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
};

type InboxCounts = {
  total?: number;
  unread?: number;
  read?: number;
  info?: number;
  success?: number;
  warning?: number;
  error?: number;
  critical?: number;
};

type InboxPayload = {
  ok?: boolean;
  data?:
    | NotificationItem[]
    | {
        unread_count?: number;
        counts?: InboxCounts;
      };
  results?: NotificationItem[];
  count?: number;
  meta?: {
    unread_count?: number;
    counts?: InboxCounts;
  };
};

/* ============================================================
   Constants
============================================================ */

const API_INBOX = "/api/notification-center/inbox";

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

function normalizeList(payload: InboxPayload): NotificationItem[] {
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function normalizeCounts(payload: InboxPayload): InboxCounts {
  if (payload.meta?.counts) return payload.meta.counts;

  if (
    payload.data &&
    !Array.isArray(payload.data) &&
    payload.data.counts
  ) {
    return payload.data.counts;
  }

  return {};
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

function severityLabel(value: string, locale: AppLocale) {
  const normalized = String(value || "").toLowerCase();

  const ar: Record<string, string> = {
    success: "نجاح",
    info: "معلومة",
    warning: "تنبيه",
    error: "خطأ",
    critical: "حرج",
  };

  const en: Record<string, string> = {
    success: "Success",
    info: "Info",
    warning: "Warning",
    error: "Error",
    critical: "Critical",
  };

  return locale === "ar"
    ? ar[normalized] || value || "إشعار"
    : en[normalized] || value || "Notification";
}

function severityClass(value: string) {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  if (normalized === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300";
  }

  if (normalized === "error" || normalized === "critical") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300";
  }

  return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300";
}

/* ============================================================
   Page
============================================================ */

export default function NotificationsDashboardPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [counts, setCounts] = useState<InboxCounts>({});
  const [latest, setLatest] = useState<NotificationItem[]>([]);

  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";

  const labels = useMemo(
    () => ({
      title: isArabic ? "الإشعارات" : "Notifications",
      subtitle: isArabic
        ? "متابعة إشعارات النظام، الإشعارات غير المقروءة، وقنوات التنبيه من مكان واحد."
        : "Monitor system notifications, unread messages, and notification channels from one place.",
      refresh: isArabic ? "تحديث" : "Refresh",
      list: isArabic ? "قائمة الإشعارات" : "Notifications List",
      settings: isArabic ? "الإعدادات" : "Settings",
      markAll: isArabic ? "قراءة الكل" : "Mark all read",
      latest: isArabic ? "آخر إشعاراتي" : "My Latest Notifications",
      latestDesc: isArabic
        ? "آخر الإشعارات غير المقروءة للمستخدم الحالي."
        : "Latest unread notifications for the current user.",
      noNotifications: isArabic ? "لا توجد إشعارات غير مقروءة." : "No unread notifications.",
      loading: isArabic ? "جاري تحميل بيانات الإشعارات..." : "Loading notification data...",
      totalNotifications: isArabic ? "إجمالي الإشعارات" : "Total Notifications",
      unread: isArabic ? "غير المقروءة" : "Unread",
      read: isArabic ? "المقروءة" : "Read",
      info: isArabic ? "معلومات" : "Info",
      success: isArabic ? "ناجحة" : "Success",
      warning: isArabic ? "تنبيهات" : "Warnings",
      critical: isArabic ? "حرجة" : "Critical",
      quickActions: isArabic ? "إجراءات سريعة" : "Quick Actions",
      quickDesc: isArabic
        ? "اختصارات لإدارة الإشعارات والإعدادات."
        : "Shortcuts to manage notifications and settings.",
      openList: isArabic ? "فتح القائمة" : "Open List",
      openSettings: isArabic ? "فتح الإعدادات" : "Open Settings",
      channels: isArabic ? "القنوات المدعومة" : "Supported Channels",
      inApp: isArabic ? "داخل النظام" : "In-App",
      email: isArabic ? "البريد الإلكتروني" : "Email",
      whatsapp: isArabic ? "واتساب" : "WhatsApp",
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

  async function loadData() {
    try {
      setLoading(true);

      const [countRes, latestRes] = await Promise.all([
        fetch(`${API_INBOX}?action=count`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        }),
        fetch(`${API_INBOX}?action=latest&limit=8`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        }),
      ]);

      if (!countRes.ok) {
        throw new Error(`Count request failed: ${countRes.status}`);
      }

      if (!latestRes.ok) {
        throw new Error(`Latest request failed: ${latestRes.status}`);
      }

      const countPayload = (await countRes.json()) as InboxPayload;
      const latestPayload = (await latestRes.json()) as InboxPayload;

      setCounts(normalizeCounts(countPayload));
      setLatest(normalizeList(latestPayload));
    } catch (error) {
      console.error("Notifications dashboard load error:", error);
      toast.error(
        isArabic
          ? "تعذر تحميل بيانات الإشعارات"
          : "Could not load notification data",
      );
      setCounts({});
      setLatest([]);
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    try {
      setMarkingAll(true);

      const csrfToken = getCSRFToken();

      const res = await fetch(API_INBOX, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
        body: JSON.stringify({ action: "mark_all_read" }),
      });

      if (!res.ok) {
        throw new Error(`Mark all read failed: ${res.status}`);
      }

      toast.success(
        isArabic
          ? "تم تعليم كل الإشعارات كمقروءة"
          : "All notifications marked as read",
      );

      await loadData();
    } catch (error) {
      console.error("Mark all read error:", error);
      toast.error(
        isArabic
          ? "تعذر تعليم الإشعارات كمقروءة"
          : "Could not mark notifications as read",
      );
    } finally {
      setMarkingAll(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const cards = [
    {
      title: labels.totalNotifications,
      value: counts.total || 0,
      icon: Bell,
      hint: "0%",
    },
    {
      title: labels.unread,
      value: counts.unread || 0,
      icon: BellRing,
      hint: "0%",
    },
    {
      title: labels.read,
      value: counts.read || 0,
      icon: CheckCheck,
      hint: "0%",
    },
    {
      title: labels.info,
      value: counts.info || 0,
      icon: ShieldCheck,
      hint: "0%",
    },
    {
      title: labels.warning,
      value: counts.warning || 0,
      icon: TriangleAlert,
      hint: "0%",
    },
    {
      title: labels.critical,
      value: counts.critical || counts.error || 0,
      icon: Clock,
      hint: "0%",
    },
  ];

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
          <Button variant="outline" onClick={loadData} disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
            {labels.refresh}
          </Button>

          <Button variant="outline" onClick={markAllRead} disabled={markingAll}>
            {markingAll ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCheck className="size-4" />
            )}
            {labels.markAll}
          </Button>

          <Button asChild>
            <Link href="/system/notifications/list">
              <Inbox className="size-4" />
              {labels.list}
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.title}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                <div className="space-y-1">
                  <CardDescription>{item.title}</CardDescription>
                  <CardTitle className="text-3xl">{item.value}</CardTitle>
                </div>
                <div className="bg-background/70 rounded-2xl border p-2">
                  <Icon className="text-muted-foreground size-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-emerald-600 text-xs font-medium">
                  {item.hint}
                </div>
                <div className="bg-muted mt-2 h-2 overflow-hidden rounded-full">
                  <div className="bg-foreground h-full w-1/2 rounded-full" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>{labels.latest}</CardTitle>
                <CardDescription>{labels.latestDesc}</CardDescription>
              </div>

              <Button asChild variant="outline" size="sm">
                <Link href="/system/notifications/list">
                  <Eye className="size-4" />
                  {labels.openList}
                </Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
                <Loader2 className="size-4 animate-spin" />
                {labels.loading}
              </div>
            ) : latest.length === 0 ? (
              <div className="text-muted-foreground flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed text-sm">
                {labels.noNotifications}
              </div>
            ) : (
              <div className="space-y-3">
                {latest.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.link) window.location.href = item.link;
                    }}
                    className="hover:bg-muted/60 flex w-full items-start gap-3 rounded-2xl border p-4 text-start transition"
                  >
                    <div className="bg-background rounded-2xl border p-2">
                      <Bell className="text-muted-foreground size-5" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-medium">
                          {item.title}
                        </div>
                        <Badge className={severityClass(item.severity)}>
                          {severityLabel(item.severity, locale)}
                        </Badge>
                      </div>

                      <p className="text-muted-foreground line-clamp-2 text-xs leading-6">
                        {item.message}
                      </p>

                      <div className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Clock className="size-3.5" />
                        {formatDate(item.created_at)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{labels.quickActions}</CardTitle>
              <CardDescription>{labels.quickDesc}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button asChild variant="outline" className="justify-between">
                <Link href="/system/notifications/list">
                  <span>{labels.openList}</span>
                  <Inbox className="size-4" />
                </Link>
              </Button>

              <Button asChild variant="outline" className="justify-between">
                <Link href="/system/notifications/settings">
                  <span>{labels.openSettings}</span>
                  <Settings className="size-4" />
                </Link>
              </Button>

              <Button
                variant="outline"
                className="justify-between"
                onClick={markAllRead}
                disabled={markingAll}
              >
                <span>{labels.markAll}</span>
                {markingAll ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCheck className="size-4" />
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{labels.channels}</CardTitle>
              <CardDescription>
                {isArabic
                  ? "القنوات التي يدعمها مركز الإشعارات."
                  : "Channels supported by the notification center."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-center justify-between rounded-2xl border p-3">
                <span className="text-sm">{labels.inApp}</span>
                <Badge variant="secondary">
                  <Bell className="me-1 size-3" />
                  Active
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-2xl border p-3">
                <span className="text-sm">{labels.email}</span>
                <Badge variant="secondary">
                  <Mail className="me-1 size-3" />
                  Ready
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-2xl border p-3">
                <span className="text-sm">{labels.whatsapp}</span>
                <Badge variant="secondary">
                  <Smartphone className="me-1 size-3" />
                  Ready
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}