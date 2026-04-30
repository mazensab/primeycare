"use client";

/* ============================================================
   📂 app/system/notifications/list/page.tsx
   🧠 Primey Care | Notifications List Page
============================================================ */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCheck,
  Clock,
  Download,
  Eye,
  Filter,
  Loader2,
  RefreshCcw,
  Search,
  Settings,
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

type InboxPayload = {
  ok?: boolean;
  data?: NotificationItem[];
  results?: NotificationItem[];
  count?: number;
  meta?: {
    page?: number;
    page_size?: number;
    total_pages?: number;
    total_items?: number;
    has_next?: boolean;
    has_previous?: boolean;
    counts?: {
      total?: number;
      unread?: number;
      read?: number;
      info?: number;
      success?: number;
      warning?: number;
      error?: number;
      critical?: number;
    };
  };
};

/* ============================================================
   Constants
============================================================ */

const API_INBOX = "/api/notification-center/inbox/";

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

function normalizeList(payload: InboxPayload): NotificationItem[] {
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
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

function exportNotificationsCsv(items: NotificationItem[]) {
  const headers = [
    "id",
    "title",
    "message",
    "type",
    "severity",
    "is_read",
    "created_at",
    "read_at",
    "link",
  ];

  const rows = items.map((item) => [
    item.id,
    item.title,
    item.message,
    item.notification_type,
    item.severity,
    item.is_read ? "true" : "false",
    item.created_at,
    item.read_at || "",
    item.link || "",
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
  anchor.download = `primey-notifications-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();

  URL.revokeObjectURL(url);
}

/* ============================================================
   Page
============================================================ */

export default function NotificationsListPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [search, setSearch] = useState("");
  const [isRead, setIsRead] = useState<"all" | "read" | "unread">("all");
  const [severity, setSeverity] = useState("all");
  const [notificationType, setNotificationType] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<InboxPayload["meta"]>({});

  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";

  const labels = useMemo(
    () => ({
      title: isArabic ? "قائمة الإشعارات" : "Notifications List",
      subtitle: isArabic
        ? "استعراض إشعارات المستخدم الحالي، البحث، الفلترة، وتعليم الإشعارات كمقروءة."
        : "Review current user notifications, search, filter, and mark notifications as read.",
      refresh: isArabic ? "تحديث" : "Refresh",
      settings: isArabic ? "الإعدادات" : "Settings",
      dashboard: isArabic ? "لوحة الإشعارات" : "Notifications Dashboard",
      markAll: isArabic ? "قراءة الكل" : "Mark all read",
      export: isArabic ? "تصدير" : "Export",
      search: isArabic ? "ابحث في الإشعارات..." : "Search notifications...",
      filters: isArabic ? "الفلاتر" : "Filters",
      all: isArabic ? "الكل" : "All",
      read: isArabic ? "مقروء" : "Read",
      unread: isArabic ? "غير مقروء" : "Unread",
      type: isArabic ? "النوع" : "Type",
      severity: isArabic ? "الأهمية" : "Severity",
      status: isArabic ? "الحالة" : "Status",
      date: isArabic ? "التاريخ" : "Date",
      action: isArabic ? "الإجراء" : "Action",
      noData: isArabic ? "لا توجد إشعارات مطابقة." : "No matching notifications.",
      loading: isArabic ? "جاري تحميل الإشعارات..." : "Loading notifications...",
      view: isArabic ? "عرض" : "View",
      markRead: isArabic ? "قراءة" : "Read",
      next: isArabic ? "التالي" : "Next",
      previous: isArabic ? "السابق" : "Previous",
      total: isArabic ? "الإجمالي" : "Total",
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

      const params = new URLSearchParams({
        page: String(page),
        page_size: "20",
      });

      if (search.trim()) params.set("search", search.trim());
      if (isRead === "read") params.set("is_read", "true");
      if (isRead === "unread") params.set("is_read", "false");
      if (severity !== "all") params.set("severity", severity);
      if (notificationType.trim()) {
        params.set("notification_type", notificationType.trim());
      }

      const res = await fetch(`${API_INBOX}?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Inbox request failed: ${res.status}`);
      }

      const payload = (await res.json()) as InboxPayload;

      setItems(normalizeList(payload));
      setMeta(payload.meta || {});
    } catch (error) {
      console.error("Notifications list load error:", error);
      toast.error(
        isArabic
          ? "تعذر تحميل قائمة الإشعارات"
          : "Could not load notifications list",
      );
      setItems([]);
      setMeta({});
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: number | string) {
    try {
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
        body: JSON.stringify({
          action: "mark_read",
          notification_id: id,
        }),
      });

      if (!res.ok) {
        throw new Error(`Mark read failed: ${res.status}`);
      }

      toast.success(
        isArabic ? "تم تعليم الإشعار كمقروء" : "Notification marked as read",
      );

      await loadData();
    } catch (error) {
      console.error("Mark read error:", error);
      toast.error(
        isArabic
          ? "تعذر تحديث حالة الإشعار"
          : "Could not update notification",
      );
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
        body: JSON.stringify({
          action: "mark_all_read",
        }),
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
  }, [locale, page]);

  function applyFilters() {
    setPage(1);
    void loadData();
  }

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
            <Link href="/system/notifications/settings">
              <Settings className="size-4" />
              {labels.settings}
            </Link>
          </Button>

          <Button
            variant="outline"
            onClick={() => exportNotificationsCsv(items)}
            disabled={items.length === 0}
          >
            <Download className="size-4" />
            {labels.export}
          </Button>

          <Button onClick={markAllRead} disabled={markingAll}>
            {markingAll ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCheck className="size-4" />
            )}
            {labels.markAll}
          </Button>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{labels.filters}</CardTitle>
          <CardDescription>
            {isArabic
              ? "فلترة الإشعارات حسب الحالة والأهمية والنوع."
              : "Filter notifications by status, severity, and type."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_auto]">
            <div className="relative">
              <Search className="text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={labels.search}
                className="ps-10"
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyFilters();
                }}
              />
            </div>

            <select
              value={isRead}
              onChange={(event) =>
                setIsRead(event.target.value as "all" | "read" | "unread")
              }
              className="bg-background h-10 rounded-md border px-3 text-sm"
            >
              <option value="all">{labels.all}</option>
              <option value="unread">{labels.unread}</option>
              <option value="read">{labels.read}</option>
            </select>

            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value)}
              className="bg-background h-10 rounded-md border px-3 text-sm"
            >
              <option value="all">{labels.all}</option>
              <option value="info">info</option>
              <option value="success">success</option>
              <option value="warning">warning</option>
              <option value="error">error</option>
              <option value="critical">critical</option>
            </select>

            <Input
              value={notificationType}
              onChange={(event) => setNotificationType(event.target.value)}
              placeholder={labels.type}
            />

            <Button onClick={applyFilters} disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Filter className="size-4" />
              )}
              {labels.filters}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{labels.title}</CardTitle>
              <CardDescription>
                {labels.total}: {meta?.total_items || items.length}
              </CardDescription>
            </div>

            <Button variant="outline" onClick={loadData} disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCcw className="size-4" />
              )}
              {labels.refresh}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-hidden rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{labels.title}</TableHead>
                  <TableHead>{labels.type}</TableHead>
                  <TableHead>{labels.severity}</TableHead>
                  <TableHead>{labels.status}</TableHead>
                  <TableHead>{labels.date}</TableHead>
                  <TableHead className="text-end">{labels.action}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
                        <Loader2 className="size-4 animate-spin" />
                        {labels.loading}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="text-muted-foreground py-10 text-center text-sm">
                        {labels.noData}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="max-w-[420px] space-y-1">
                          <div className="flex items-center gap-2">
                            {!item.is_read ? (
                              <span className="bg-primary size-2 rounded-full" />
                            ) : null}
                            <span className="font-medium">{item.title}</span>
                          </div>
                          <p className="text-muted-foreground line-clamp-2 text-xs leading-6">
                            {item.message}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="secondary">
                          {item.notification_type || "system"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge className={severityClass(item.severity)}>
                          {severityLabel(item.severity, locale)}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge variant={item.is_read ? "outline" : "default"}>
                          {item.is_read ? labels.read : labels.unread}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="text-muted-foreground flex items-center gap-1 text-xs">
                          <Clock className="size-3.5" />
                          {formatDate(item.created_at)}
                        </div>
                      </TableCell>

                      <TableCell className="text-end">
                        <div className="flex justify-end gap-2">
                          {item.link ? (
                            <Button asChild variant="outline" size="sm">
                              <Link href={item.link}>
                                <Eye className="size-4" />
                                {labels.view}
                              </Link>
                            </Button>
                          ) : null}

                          {!item.is_read ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => markRead(item.id)}
                            >
                              <CheckCheck className="size-4" />
                              {labels.markRead}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              disabled={!meta?.has_previous || loading}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            >
              {labels.previous}
            </Button>

            <div className="text-muted-foreground text-sm">
              {page} / {meta?.total_pages || 1}
            </div>

            <Button
              variant="outline"
              disabled={!meta?.has_next || loading}
              onClick={() => setPage((prev) => prev + 1)}
            >
              {labels.next}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}