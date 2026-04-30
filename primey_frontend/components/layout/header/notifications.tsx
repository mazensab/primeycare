"use client";

import { BellIcon, CheckCheckIcon, ClockIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

/* =========================================================
   🌍 Locale Types
========================================================= */

type AppLocale = "ar" | "en";

interface Notification {
  id: number;
  title: string;
  message: string;
  severity: string;
  notification_type: string;
  is_read: boolean;
  link?: string | null;
  created_at: string;
  read_at?: string | null;
  event_id?: number | null;
  recipient_id?: number | null;
}

type NotificationsApiResponse = {
  ok?: boolean;
  message?: string;
  results?: Notification[];
  count?: number;
  unread_count?: number;
  data?:
    | Notification[]
    | {
        results?: Notification[];
        unread_count?: number;
        counts?: {
          unread?: number;
          total?: number;
          read?: number;
        };
      };
  meta?: {
    unread_count?: number;
    counts?: {
      unread?: number;
      total?: number;
      read?: number;
    };
  };
};

/* =========================================================
   🔗 Helpers
========================================================= */

const NOTIFICATIONS_INBOX_ENDPOINT = "/api/notification-center/inbox/";

function readStoredLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const savedLocale = window.localStorage.getItem("primey-locale");
    if (savedLocale === "en") return "en";
    if (savedLocale === "ar") return "ar";

    const htmlLang = document.documentElement.lang;
    return htmlLang === "en" ? "en" : "ar";
  } catch (error) {
    console.error("Notifications locale read error:", error);
    return "ar";
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

function extractNotifications(payload: NotificationsApiResponse) {
  let results: Notification[] = [];

  if (Array.isArray(payload.results)) {
    results = payload.results;
  } else if (Array.isArray(payload.data)) {
    results = payload.data;
  } else if (
    payload.data &&
    !Array.isArray(payload.data) &&
    Array.isArray(payload.data.results)
  ) {
    results = payload.data.results;
  }

  const unreadCount = Number(
    payload.unread_count ??
      payload.meta?.unread_count ??
      payload.meta?.counts?.unread ??
      (!Array.isArray(payload.data) ? payload.data?.unread_count : undefined) ??
      (!Array.isArray(payload.data) ? payload.data?.counts?.unread : undefined) ??
      results.filter((item) => !item.is_read).length,
  );

  return {
    results,
    unreadCount: Number.isFinite(unreadCount) ? unreadCount : 0,
  };
}

function resolveWebSocketUrl() {
  const envWs = process.env.NEXT_PUBLIC_WS_URL?.trim();

  if (!envWs) return "";

  return `${envWs.replace(/\/+$/, "")}/ws/system/notifications/`;
}

/* =========================================================
   Component
========================================================= */

const Notifications = () => {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const router = useRouter();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [markingAll, setMarkingAll] = useState<boolean>(false);

  const socketRef = useRef<WebSocket | null>(null);
  const didLoadRef = useRef(false);

  const isArabic = locale === "ar";

  const isCompanyScope = useMemo(() => {
    return (
      pathname?.startsWith("/company") ||
      pathname?.startsWith("/center") ||
      pathname?.startsWith("/provider")
    );
  }, [pathname]);

  const pageHref = isCompanyScope
    ? "/company/notifications"
    : "/system/notifications";

  const wsNotificationsUrl = useMemo(() => resolveWebSocketUrl(), []);

  /* =========================================================
     🍪 Load Locale
  ========================================================= */

  useEffect(() => {
    const syncLocale = () => {
      setLocale(readStoredLocale());
    };

    syncLocale();

    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  /* =========================================================
     📥 Load Notifications from Backend
  ========================================================= */

  async function loadNotifications() {
    try {
      setLoading(true);

      const searchParams = new URLSearchParams({
        action: "latest",
        limit: "8",
      });

      const res = await fetch(
        `${NOTIFICATIONS_INBOX_ENDPOINT}?${searchParams.toString()}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (res.status === 401 || res.status === 403 || res.status === 404) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      if (!res.ok) {
        console.warn(`Notifications inbox API unavailable: ${res.status}`);
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      const data = (await res.json()) as NotificationsApiResponse;
      const parsed = extractNotifications(data);

      setNotifications(parsed.results);
      setUnreadCount(parsed.unreadCount);
    } catch (error) {
      console.error("Notifications load error:", error);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (didLoadRef.current) return;

    didLoadRef.current = true;
    void loadNotifications();
  }, []);

  /* =========================================================
     🔔 Optional WebSocket Realtime Notifications
  ========================================================= */

  useEffect(() => {
    if (!wsNotificationsUrl) return;

    let socket: WebSocket | null = null;

    try {
      socket = new WebSocket(wsNotificationsUrl);
      socketRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          const notification =
            payload?.notification || payload?.data?.notification || payload;

          if (!notification?.id) return;

          setNotifications((prev) => {
            const exists = prev.some((item) => item.id === notification.id);
            if (exists) return prev;

            return [notification as Notification, ...prev].slice(0, 8);
          });

          setUnreadCount((prev) => prev + 1);
        } catch (error) {
          console.error("Realtime notification parse error:", error);
        }
      };

      socket.onerror = () => {
        socketRef.current = null;
      };

      socket.onclose = () => {
        socketRef.current = null;
      };
    } catch (error) {
      console.error("Notification socket initialization error:", error);
    }

    return () => {
      try {
        socket?.close();
        socketRef.current?.close();
      } catch (error) {
        console.error("Notification socket close error:", error);
      } finally {
        socketRef.current = null;
      }
    };
  }, [wsNotificationsUrl]);

  /* =========================================================
     ✅ Mark Single Notification as Read
  ========================================================= */

  async function markAsRead(id: number) {
    try {
      const csrfToken = getCSRFToken();

      const res = await fetch(NOTIFICATIONS_INBOX_ENDPOINT, {
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

      if (res.status === 401 || res.status === 403 || res.status === 404) {
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, is_read: true, read_at: new Date().toISOString() }
              : item,
          ),
        );
        setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0));
        return;
      }

      if (!res.ok) {
        toast.error(
          isArabic
            ? "تعذر تحديث حالة الإشعار"
            : "Could not update notification",
        );
        return;
      }

      const payload = (await res.json()) as NotificationsApiResponse;
      const nextUnread = Number(payload.meta?.unread_count);

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, is_read: true, read_at: new Date().toISOString() }
            : item,
        ),
      );

      setUnreadCount((prev) =>
        Number.isFinite(nextUnread) ? nextUnread : prev > 0 ? prev - 1 : 0,
      );
    } catch (error) {
      console.error("Mark notification read error:", error);
    }
  }

  /* =========================================================
     ✅ Mark All Notifications as Read
  ========================================================= */

  async function markAllAsRead() {
    if (unreadCount <= 0) return;

    try {
      setMarkingAll(true);

      const csrfToken = getCSRFToken();

      const res = await fetch(NOTIFICATIONS_INBOX_ENDPOINT, {
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

      if (res.status === 401 || res.status === 403 || res.status === 404) {
        setNotifications((prev) =>
          prev.map((item) => ({
            ...item,
            is_read: true,
            read_at: new Date().toISOString(),
          })),
        );
        setUnreadCount(0);
        return;
      }

      if (!res.ok) {
        toast.error(
          isArabic
            ? "تعذر تعليم الإشعارات كمقروءة"
            : "Could not mark notifications as read",
        );
        return;
      }

      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          is_read: true,
          read_at: new Date().toISOString(),
        })),
      );
      setUnreadCount(0);

      toast.success(
        isArabic
          ? "تم تعليم كل الإشعارات كمقروءة"
          : "All notifications marked as read",
      );
    } catch (error) {
      console.error("Mark all notifications read error:", error);
    } finally {
      setMarkingAll(false);
    }
  }

  /* =========================================================
     🕒 Format Date by Locale
  ========================================================= */

  function formatNotificationDate(value: string) {
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

  function severityClassName(severity: string) {
    const normalized = severity?.toLowerCase();

    if (normalized === "success") {
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    }

    if (normalized === "warning") {
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
    }

    if (normalized === "error" || normalized === "critical") {
      return "bg-red-500/10 text-red-700 dark:text-red-300";
    }

    return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  }

  /* =========================================================
     🖱️ Handle Notification Click
  ========================================================= */

  async function handleNotificationClick(item: Notification) {
    if (!item.is_read) {
      await markAsRead(item.id);
    }

    if (item.link) {
      router.push(item.link);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" className="relative">
          <BellIcon />

          {unreadCount > 0 ? (
            <span className="bg-destructive absolute end-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={isMobile ? "center" : isArabic ? "start" : "end"}
        className="ms-4 w-80 p-0"
      >
        <div dir={isArabic ? "rtl" : "ltr"}>
          <DropdownMenuLabel className="bg-background dark:bg-muted sticky top-0 z-10 p-0">
            <div className="flex items-center justify-between border-b px-4 py-4">
              <div className="font-medium">
                {isArabic ? "الإشعارات" : "Notifications"}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={markAllAsRead}
                  disabled={unreadCount <= 0 || markingAll}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCheckIcon className="size-3.5" />
                  {isArabic ? "قراءة الكل" : "Read all"}
                </button>

                <Link
                  href={pageHref}
                  className="text-muted-foreground hover:text-foreground text-xs transition"
                >
                  {isArabic ? "عرض الكل" : "View all"}
                </Link>
              </div>
            </div>
          </DropdownMenuLabel>

          <ScrollArea className="h-[350px]">
            {loading ? (
              <div className="text-muted-foreground p-6 text-center text-sm">
                {isArabic
                  ? "جاري تحميل الإشعارات..."
                  : "Loading notifications..."}
              </div>
            ) : null}

            {!loading && notifications.length === 0 ? (
              <div className="text-muted-foreground p-6 text-center text-sm">
                {isArabic ? "لا توجد إشعارات" : "No notifications"}
              </div>
            ) : null}

            {!loading
              ? notifications.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className="group flex cursor-pointer items-start gap-3 rounded-none border-b px-4 py-3"
                  >
                    <div className="flex flex-1 items-start gap-2">
                      <div className="flex-none">
                        <Avatar className="size-8">
                          <AvatarFallback
                            className={severityClassName(item.severity)}
                          >
                            {item.title?.charAt(0) || (isArabic ? "إ" : "N")}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-medium">
                            {item.title}
                          </div>

                          {!item.is_read ? (
                            <span className="bg-primary size-2 rounded-full" />
                          ) : null}
                        </div>

                        <div className="text-muted-foreground line-clamp-1 text-xs">
                          {item.message}
                        </div>

                        <div className="text-muted-foreground flex items-center gap-1 text-xs">
                          <ClockIcon className="size-3" />
                          {formatNotificationDate(item.created_at)}
                        </div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              : null}
          </ScrollArea>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default Notifications;