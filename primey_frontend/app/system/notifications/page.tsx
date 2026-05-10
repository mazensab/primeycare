"use client";

/* ============================================================
   📂 app/system/notifications/page.tsx
   🧠 Primey Care | Notifications Overview

   ✅ المرحلة 17 + المرحلة 2
   ✅ نفس النمط المعتمد
   ✅ w-full space-y-4
   ✅ بدون main / min-h-screen / max-w
   ✅ أزرار انتقال للصفحات التي أزلناها من السايدر
   ✅ Skeleton Loading
   ✅ Error State مستقل
   ✅ Empty State ذكي
   ✅ Excel .xls HTML Workbook
   ✅ Web PDF Print
   ✅ sonner
   ✅ صلاحيات آمنة مع fallback لـ system_admin / superuser
   ✅ بدون localhost hardcoded
   ✅ لا توجد نصوص تقنية ظاهرة في الواجهة
============================================================ */

import Link from "next/link";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BellRing,
  Download,
  Eye,
  FileText,
  Inbox,
  Loader2,
  Mail,
  MessageCircle,
  Printer,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  UserRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/AuthProvider";
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
type Dict = Record<string, unknown>;

type NotificationStatus =
  | "UNREAD"
  | "READ"
  | "SENT"
  | "FAILED"
  | "PENDING"
  | "UNKNOWN";

type NotificationChannel =
  | "IN_APP"
  | "EMAIL"
  | "WHATSAPP"
  | "SMS"
  | "SYSTEM"
  | "UNKNOWN";

type NotificationSeverity =
  | "SUCCESS"
  | "INFO"
  | "WARNING"
  | "ERROR"
  | "CRITICAL"
  | "UNKNOWN";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  recipient_name: string;
  recipient_email: string;
  recipient_phone: string;
  status: NotificationStatus;
  channel: NotificationChannel;
  severity: NotificationSeverity;
  event_name: string;
  source: string;
  created_at: string;
  read_at: string;
  sent_at: string;
};

type NotificationsSummary = {
  total_notifications: number;
  unread_notifications: number;
  read_notifications: number;
  sent_notifications: number;
  failed_notifications: number;
  pending_notifications: number;
  in_app_notifications: number;
  email_notifications: number;
  whatsapp_notifications: number;
  sms_notifications: number;
  success_notifications: number;
  warning_notifications: number;
  error_notifications: number;
};

type ApiEnvelope<T> = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  data?: T;
  results?: unknown[];
  items?: unknown[];
  rows?: unknown[];
  notifications?: unknown[];
  inbox?: unknown[];
  summary?: Partial<NotificationsSummary>;
  stats?: Partial<NotificationsSummary>;
};

const DEFAULT_SUMMARY: NotificationsSummary = {
  total_notifications: 0,
  unread_notifications: 0,
  read_notifications: 0,
  sent_notifications: 0,
  failed_notifications: 0,
  pending_notifications: 0,
  in_app_notifications: 0,
  email_notifications: 0,
  whatsapp_notifications: 0,
  sms_notifications: 0,
  success_notifications: 0,
  warning_notifications: 0,
  error_notifications: 0,
};

/* ============================================================
   Locale / API
============================================================ */

function readLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const saved =
      window.localStorage.getItem("primey-locale") ||
      window.localStorage.getItem("locale") ||
      window.localStorage.getItem("lang");

    if (saved === "en") return "en";
    if (saved === "ar") return "ar";

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

function apiUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  if (!base) return path;

  return `${base.replace(/\/$/, "")}${path}`;
}

/* ============================================================
   Auth / Permissions
============================================================ */

function asDict(value: unknown): Dict {
  return value && typeof value === "object" ? (value as Dict) : {};
}

function getNested(source: Dict, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (value && typeof value === "object") return value as Dict;
  }

  return {};
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => {
          if (!value) return [];

          if (typeof value === "string") return [value];

          if (Array.isArray(value)) {
            return value.flatMap((item) => {
              if (typeof item === "string") return [item];

              if (item && typeof item === "object") {
                const obj = item as Dict;

                return [
                  obj.code,
                  obj.codename,
                  obj.permission,
                  obj.name,
                  obj.role,
                ].filter(Boolean) as string[];
              }

              return [];
            });
          }

          if (value && typeof value === "object") {
            const obj = value as Dict;

            return [
              obj.code,
              obj.codename,
              obj.permission,
              obj.name,
              obj.role,
            ].filter(Boolean) as string[];
          }

          return [];
        })
        .map((item) => String(item).trim())
        .filter(Boolean),
    ),
  );
}

function getAuthUser(authValue: unknown) {
  const auth = asDict(authValue);

  return getNested(auth, [
    "user",
    "currentUser",
    "profile",
    "account",
    "session",
    "data",
  ]);
}

function getAuthRoles(authValue: unknown): string[] {
  const auth = asDict(authValue);
  const user = getAuthUser(authValue);

  return uniqueStrings([
    auth.role,
    auth.roles,
    auth.user_role,
    auth.userType,
    auth.user_type,
    auth.workspace,
    auth.workspaces,
    auth.type,
    user.role,
    user.roles,
    user.user_role,
    user.userType,
    user.user_type,
    user.workspace,
    user.workspaces,
    user.type,
  ]).map((item) => item.toLowerCase());
}

function getAuthPermissionCodes(authValue: unknown): string[] {
  const auth = asDict(authValue);
  const user = getAuthUser(authValue);

  const authPermissions = asDict(auth.permissions);
  const userPermissions = asDict(user.permissions);
  const authProfilePermissions = asDict(auth.profile_permissions);
  const userProfilePermissions = asDict(user.profile_permissions);

  return uniqueStrings([
    auth.permission_codes,
    auth.permissions,
    auth.codes,
    auth.profile_permissions,
    authPermissions.codes,
    authProfilePermissions.codes,
    user.permission_codes,
    user.permissions,
    user.codes,
    user.profile_permissions,
    userPermissions.codes,
    userProfilePermissions.codes,
  ]);
}

function isAuthResolving(authValue: unknown) {
  const auth = asDict(authValue);

  return Boolean(
    auth.isLoading ||
      auth.loading ||
      auth.isInitializing ||
      auth.initializing ||
      auth.pending,
  );
}

function isSystemAdmin(authValue: unknown) {
  const auth = asDict(authValue);
  const user = getAuthUser(authValue);
  const roles = getAuthRoles(authValue);

  return (
    Boolean(auth.is_superuser) ||
    Boolean(auth.isSuperuser) ||
    Boolean(auth.is_system_admin) ||
    Boolean(auth.isSystemAdmin) ||
    Boolean(user.is_superuser) ||
    Boolean(user.isSuperuser) ||
    Boolean(user.is_system_admin) ||
    Boolean(user.isSystemAdmin) ||
    roles.some((role) =>
      [
        "system_admin",
        "superuser",
        "super_admin",
        "superadmin",
        "admin",
        "administrator",
      ].includes(role),
    )
  );
}

function hasAnyPermission(
  authValue: unknown,
  codes: string[],
  mode: "view" | "action",
) {
  if (isSystemAdmin(authValue)) return true;

  const permissions = getAuthPermissionCodes(authValue);

  if (permissions.length > 0) {
    return codes.some((code) => permissions.includes(code));
  }

  const roles = getAuthRoles(authValue);

  if (roles.length > 0) {
    if (mode === "view") {
      return roles.some((role) =>
        [
          "system_admin",
          "superuser",
          "super_admin",
          "accountant",
          "support",
          "viewer",
        ].includes(role),
      );
    }

    return roles.some((role) =>
      ["system_admin", "superuser", "super_admin", "support"].includes(role),
    );
  }

  return true;
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "الإشعارات" : "Notifications",
    subtitle: isArabic
      ? "لوحة متابعة الإشعارات الداخلية وحالات القراءة والإرسال وقنوات التواصل."
      : "Overview for internal notifications, read status, delivery status, and channels.",

    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    notificationsList: isArabic ? "قائمة الإشعارات" : "Notifications List",
    notificationSettings: isArabic
      ? "إعدادات الإشعارات"
      : "Notification Settings",

    totalNotifications: isArabic ? "إجمالي الإشعارات" : "Total Notifications",
    unreadNotifications: isArabic ? "غير مقروءة" : "Unread",
    sentNotifications: isArabic ? "مرسلة" : "Sent",
    failedNotifications: isArabic ? "فاشلة" : "Failed",
    pendingNotifications: isArabic ? "قيد الانتظار" : "Pending",
    emailNotifications: isArabic ? "البريد الإلكتروني" : "Email",
    whatsappNotifications: isArabic ? "واتساب" : "WhatsApp",
    smsNotifications: isArabic ? "رسائل SMS" : "SMS",
    warningNotifications: isArabic ? "تنبيهات تحذيرية" : "Warnings",
    errorNotifications: isArabic ? "تنبيهات خطأ" : "Errors",

    shortcutsTitle: isArabic ? "اختصارات الإشعارات" : "Notification Shortcuts",
    shortcutsDesc: isArabic
      ? "الوصول السريع لقائمة الإشعارات وإعدادات الإشعارات بعد تنظيف السايدر."
      : "Quick access to notification list and notification settings after sidebar cleanup.",

    latestTitle: isArabic ? "أحدث الإشعارات" : "Latest Notifications",
    latestDesc: isArabic
      ? "آخر الإشعارات مع القناة والحالة والمستلم."
      : "Latest notifications with channel, status, and recipient.",

    searchPlaceholder: isArabic
      ? "ابحث في الإشعارات بالعنوان أو الرسالة أو المستلم..."
      : "Search notifications by title, message, or recipient...",

    table: {
      notification: isArabic ? "الإشعار" : "Notification",
      recipient: isArabic ? "المستلم" : "Recipient",
      channel: isArabic ? "القناة" : "Channel",
      status: isArabic ? "الحالة" : "Status",
      severity: isArabic ? "الأهمية" : "Severity",
      source: isArabic ? "المصدر" : "Source",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      action: isArabic ? "الإجراء" : "Action",
    },

    unread: isArabic ? "غير مقروء" : "Unread",
    read: isArabic ? "مقروء" : "Read",
    sent: isArabic ? "مرسل" : "Sent",
    failed: isArabic ? "فشل" : "Failed",
    pending: isArabic ? "قيد الانتظار" : "Pending",
    unknown: isArabic ? "غير محدد" : "Unknown",

    inApp: isArabic ? "داخل النظام" : "In App",
    email: isArabic ? "بريد إلكتروني" : "Email",
    whatsapp: isArabic ? "واتساب" : "WhatsApp",
    sms: isArabic ? "SMS" : "SMS",
    system: isArabic ? "النظام" : "System",

    success: isArabic ? "نجاح" : "Success",
    info: isArabic ? "معلومة" : "Info",
    warning: isArabic ? "تحذير" : "Warning",
    error: isArabic ? "خطأ" : "Error",
    critical: isArabic ? "حرج" : "Critical",

    view: isArabic ? "عرض" : "View",

    emptyTitle: isArabic ? "لا توجد إشعارات" : "No notifications",
    emptyText: isArabic
      ? "ستظهر الإشعارات هنا عند وصول أول إشعار."
      : "Notifications will appear here when the first notification arrives.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث."
      : "Try changing your search terms.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الإشعارات" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض الإشعارات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view notifications. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل بيانات الإشعارات."
      : "Unable to load notifications.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث بيانات الإشعارات."
      : "Notifications refreshed.",

    exportSuccess: isArabic ? "تم تجهيز ملف Excel." : "Excel file prepared.",
    exportEmpty: isArabic
      ? "لا توجد بيانات قابلة للتصدير."
      : "No data available to export.",
    printSuccess: isArabic ? "تم تجهيز نافذة الطباعة." : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
  };
}

/* ============================================================
   Helpers
============================================================ */

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatDate(value: string, locale: AppLocale): string {
  if (!value) return locale === "ar" ? "غير محدد" : "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getNestedValue(obj: Dict, keys: string[]): unknown {
  for (const key of keys) {
    const value = obj[key];

    if (value !== undefined && value !== null && value !== "") return value;
  }

  for (const container of [
    "notification",
    "recipient",
    "user",
    "profile",
    "data",
    "payload",
  ]) {
    const nested = obj[container];

    if (nested && typeof nested === "object") {
      const value = getNestedValue(nested as Dict, keys);

      if (value !== undefined && value !== null && value !== "") return value;
    }
  }

  return undefined;
}

function extractRows(payload: ApiEnvelope<unknown> | null, key: string): unknown[] {
  if (!payload) return [];

  const data = asDict(payload.data);
  const directValue = (payload as Dict)[key];

  if (Array.isArray(directValue)) return directValue;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.notifications)) return payload.notifications;
  if (Array.isArray(payload.inbox)) return payload.inbox;

  if (Array.isArray(data[key])) return data[key] as unknown[];
  if (Array.isArray(data.results)) return data.results as unknown[];
  if (Array.isArray(data.items)) return data.items as unknown[];
  if (Array.isArray(data.rows)) return data.rows as unknown[];
  if (Array.isArray(data.notifications)) return data.notifications as unknown[];
  if (Array.isArray(data.inbox)) return data.inbox as unknown[];

  if (Array.isArray(payload.data)) return payload.data;

  return [];
}

function extractSummary(payload: ApiEnvelope<unknown> | null) {
  if (!payload) return {};

  const data = asDict(payload.data);

  return {
    ...asDict(payload.summary),
    ...asDict(payload.stats),
    ...asDict(data.summary),
    ...asDict(data.stats),
    ...asDict(data.totals),
    ...asDict(data),
  } as Partial<NotificationsSummary>;
}

function normalizeStatus(value: unknown): NotificationStatus {
  const clean = String(value || "").toUpperCase();

  if (["UNREAD", "NEW"].includes(clean)) return "UNREAD";
  if (["READ", "SEEN"].includes(clean)) return "READ";
  if (["SENT", "DELIVERED"].includes(clean)) return "SENT";
  if (["FAILED", "ERROR"].includes(clean)) return "FAILED";
  if (["PENDING", "QUEUED", "WAITING"].includes(clean)) return "PENDING";

  return "UNKNOWN";
}

function normalizeChannel(value: unknown): NotificationChannel {
  const clean = String(value || "").toUpperCase();

  if (["IN_APP", "INAPP", "APP", "INBOX"].includes(clean)) return "IN_APP";
  if (["EMAIL", "MAIL"].includes(clean)) return "EMAIL";
  if (["WHATSAPP", "WA"].includes(clean)) return "WHATSAPP";
  if (["SMS"].includes(clean)) return "SMS";
  if (["SYSTEM"].includes(clean)) return "SYSTEM";

  return "UNKNOWN";
}

function normalizeSeverity(value: unknown): NotificationSeverity {
  const clean = String(value || "").toUpperCase();

  if (["SUCCESS", "DONE"].includes(clean)) return "SUCCESS";
  if (["INFO", "INFORMATION"].includes(clean)) return "INFO";
  if (["WARNING", "WARN"].includes(clean)) return "WARNING";
  if (["ERROR", "FAILED"].includes(clean)) return "ERROR";
  if (["CRITICAL", "HIGH"].includes(clean)) return "CRITICAL";

  return "UNKNOWN";
}

function normalizeNotification(item: unknown, index: number): NotificationRow {
  const obj = asDict(item);

  const title =
    getNestedValue(obj, ["title", "subject", "heading"]) ||
    getNestedValue(obj, ["event_name", "event", "type"]);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    title: String(title || "-"),
    message: String(getNestedValue(obj, ["message", "body", "content"]) || ""),
    recipient_name: String(
      getNestedValue(obj, ["recipient_name", "user_name", "name"]) || "",
    ),
    recipient_email: String(
      getNestedValue(obj, ["recipient_email", "email"]) || "",
    ),
    recipient_phone: String(
      getNestedValue(obj, ["recipient_phone", "phone", "mobile"]) || "",
    ),
    status: normalizeStatus(getNestedValue(obj, ["status", "state"])),
    channel: normalizeChannel(getNestedValue(obj, ["channel", "delivery_channel"])),
    severity: normalizeSeverity(getNestedValue(obj, ["severity", "level"])),
    event_name: String(getNestedValue(obj, ["event_name", "event", "type"]) || ""),
    source: String(getNestedValue(obj, ["source", "module", "app_label"]) || ""),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
    read_at: String(getNestedValue(obj, ["read_at", "seen_at"]) || ""),
    sent_at: String(getNestedValue(obj, ["sent_at", "delivered_at"]) || ""),
  };
}

function buildSummary(
  rows: NotificationRow[],
  apiSummary?: Partial<NotificationsSummary>,
): NotificationsSummary {
  const fallback: NotificationsSummary = {
    total_notifications: rows.length,
    unread_notifications: rows.filter((item) => item.status === "UNREAD").length,
    read_notifications: rows.filter((item) => item.status === "READ").length,
    sent_notifications: rows.filter((item) => item.status === "SENT").length,
    failed_notifications: rows.filter((item) => item.status === "FAILED").length,
    pending_notifications: rows.filter((item) => item.status === "PENDING").length,
    in_app_notifications: rows.filter((item) => item.channel === "IN_APP").length,
    email_notifications: rows.filter((item) => item.channel === "EMAIL").length,
    whatsapp_notifications: rows.filter((item) => item.channel === "WHATSAPP")
      .length,
    sms_notifications: rows.filter((item) => item.channel === "SMS").length,
    success_notifications: rows.filter((item) => item.severity === "SUCCESS")
      .length,
    warning_notifications: rows.filter((item) => item.severity === "WARNING")
      .length,
    error_notifications: rows.filter(
      (item) => item.severity === "ERROR" || item.severity === "CRITICAL",
    ).length,
  };

  const api = asDict(apiSummary);

  return {
    total_notifications:
      toNumber(api.total_notifications) ||
      toNumber(api.notifications_count) ||
      toNumber(api.count) ||
      fallback.total_notifications,
    unread_notifications:
      toNumber(api.unread_notifications) ||
      toNumber(api.unread_count) ||
      fallback.unread_notifications,
    read_notifications:
      toNumber(api.read_notifications) ||
      toNumber(api.read_count) ||
      fallback.read_notifications,
    sent_notifications:
      toNumber(api.sent_notifications) ||
      toNumber(api.sent_count) ||
      fallback.sent_notifications,
    failed_notifications:
      toNumber(api.failed_notifications) ||
      toNumber(api.failed_count) ||
      fallback.failed_notifications,
    pending_notifications:
      toNumber(api.pending_notifications) ||
      toNumber(api.pending_count) ||
      fallback.pending_notifications,
    in_app_notifications:
      toNumber(api.in_app_notifications) ||
      toNumber(api.in_app_count) ||
      fallback.in_app_notifications,
    email_notifications:
      toNumber(api.email_notifications) ||
      toNumber(api.email_count) ||
      fallback.email_notifications,
    whatsapp_notifications:
      toNumber(api.whatsapp_notifications) ||
      toNumber(api.whatsapp_count) ||
      fallback.whatsapp_notifications,
    sms_notifications:
      toNumber(api.sms_notifications) ||
      toNumber(api.sms_count) ||
      fallback.sms_notifications,
    success_notifications:
      toNumber(api.success_notifications) || fallback.success_notifications,
    warning_notifications:
      toNumber(api.warning_notifications) || fallback.warning_notifications,
    error_notifications:
      toNumber(api.error_notifications) || fallback.error_notifications,
  };
}

function statusLabel(status: NotificationStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<NotificationStatus, string> = {
    UNREAD: t.unread,
    READ: t.read,
    SENT: t.sent,
    FAILED: t.failed,
    PENDING: t.pending,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function channelLabel(channel: NotificationChannel, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<NotificationChannel, string> = {
    IN_APP: t.inApp,
    EMAIL: t.email,
    WHATSAPP: t.whatsapp,
    SMS: t.sms,
    SYSTEM: t.system,
    UNKNOWN: t.unknown,
  };

  return labels[channel];
}

function severityLabel(severity: NotificationSeverity, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<NotificationSeverity, string> = {
    SUCCESS: t.success,
    INFO: t.info,
    WARNING: t.warning,
    ERROR: t.error,
    CRITICAL: t.critical,
    UNKNOWN: t.unknown,
  };

  return labels[severity];
}

function statusBadge(status: NotificationStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

  if (status === "UNREAD" || status === "SENT") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "PENDING") {
    return (
      <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
        {label}
      </Badge>
    );
  }

  if (status === "FAILED") {
    return (
      <Badge className="rounded-full border-rose-200 bg-rose-50 px-3 py-1 text-rose-700 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {label}
    </Badge>
  );
}

function isValidId(value: unknown) {
  const id = String(value || "").trim();

  return id && id !== "-" && id !== "undefined" && id !== "null";
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <SkeletonLine className="h-8 w-28" />
              <SkeletonLine className="mt-3 h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="grid gap-3 p-5 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <SkeletonLine key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="space-y-3 p-5">
          <SkeletonLine className="h-7 w-48" />
          {Array.from({ length: 7 }).map((_, index) => (
            <SkeletonLine key={index} className="h-12 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================================================
   Export / Print
============================================================ */

function downloadExcel({
  filename,
  title,
  locale,
  summary,
  rows,
}: {
  filename: string;
  title: string;
  locale: AppLocale;
  summary: NotificationsSummary;
  rows: NotificationRow[];
}) {
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";
  const t = dictionary(locale);

  const rowsHtml = rows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.title)}</td>
          <td>${escapeHtml(item.message || "-")}</td>
          <td>${escapeHtml(item.recipient_name || "-")}</td>
          <td>${escapeHtml(channelLabel(item.channel, locale))}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(severityLabel(item.severity, locale))}</td>
          <td>${escapeHtml(item.source || "-")}</td>
          <td>${escapeHtml(formatDate(item.created_at, locale))}</td>
        </tr>`,
    )
    .join("");

  const workbook = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <style>
          body { direction: ${dir}; font-family: Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th, td {
            border: 1px solid #d9e2ef;
            padding: 8px;
            text-align: ${align};
            vertical-align: top;
            mso-number-format: "\\@";
          }
          th { background: #d8ecfb; font-weight: 700; }
          .title { font-size: 20px; font-weight: 700; text-align: center; background: #fff; }
          .section { font-weight: 700; background: #eef6ff; }
          .summary-label { font-weight: 700; background: #f8fafc; width: 240px; }
        </style>
      </head>
      <body dir="${dir}">
        <table>
          <tr><td class="title" colspan="8">${escapeHtml(title)}</td></tr>
          <tr><td colspan="8"></td></tr>
          <tr><td class="section" colspan="8">${escapeHtml(t.generatedAt)}: ${escapeHtml(new Date().toLocaleString("en-US"))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalNotifications)}</td><td colspan="7">${escapeHtml(formatNumber(summary.total_notifications))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.unreadNotifications)}</td><td colspan="7">${escapeHtml(formatNumber(summary.unread_notifications))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.sentNotifications)}</td><td colspan="7">${escapeHtml(formatNumber(summary.sent_notifications))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.failedNotifications)}</td><td colspan="7">${escapeHtml(formatNumber(summary.failed_notifications))}</td></tr>

          <tr><td colspan="8"></td></tr>
          <tr>
            <th>${escapeHtml(t.table.notification)}</th>
            <th>${escapeHtml("Message")}</th>
            <th>${escapeHtml(t.table.recipient)}</th>
            <th>${escapeHtml(t.table.channel)}</th>
            <th>${escapeHtml(t.table.status)}</th>
            <th>${escapeHtml(t.table.severity)}</th>
            <th>${escapeHtml(t.table.source)}</th>
            <th>${escapeHtml(t.table.createdAt)}</th>
          </tr>
          ${rowsHtml}
        </table>
      </body>
    </html>`;

  const blob = new Blob([workbook], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

function buildPrintHtml({
  locale,
  title,
  summary,
  rows,
}: {
  locale: AppLocale;
  title: string;
  summary: NotificationsSummary;
  rows: NotificationRow[];
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);

  const tableRows = rows
    .slice(0, 40)
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.title)}</td>
          <td>${escapeHtml(item.recipient_name || "-")}</td>
          <td>${escapeHtml(channelLabel(item.channel, locale))}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(formatDate(item.created_at, locale))}</td>
        </tr>`,
    )
    .join("");

  return `
    <!doctype html>
    <html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            font-family: Arial, Tahoma, sans-serif;
            color: #111827;
            background: #fff;
            direction: ${isArabic ? "rtl" : "ltr"};
            text-align: ${isArabic ? "right" : "left"};
          }
          .header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 14px;
            margin-bottom: 18px;
          }
          h1 { margin: 0; font-size: 22px; font-weight: 800; }
          .meta { margin-top: 8px; color: #6b7280; font-size: 12px; }
          .badge {
            border: 1px solid #d1d5db;
            border-radius: 999px;
            padding: 5px 12px;
            font-size: 12px;
            height: fit-content;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 18px;
          }
          .box {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 10px;
          }
          .box span { color: #6b7280; display: block; font-size: 11px; }
          .box strong { display: block; margin-top: 6px; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
          th { background: #f3f4f6; font-weight: 700; }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 8px;
            text-align: ${isArabic ? "right" : "left"};
          }
          @page { size: A4 landscape; margin: 12mm; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">${escapeHtml(t.printedAt)}: ${escapeHtml(new Date().toLocaleString("en-US"))}</div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <div class="grid">
          <div class="box"><span>${escapeHtml(t.totalNotifications)}</span><strong>${escapeHtml(formatNumber(summary.total_notifications))}</strong></div>
          <div class="box"><span>${escapeHtml(t.unreadNotifications)}</span><strong>${escapeHtml(formatNumber(summary.unread_notifications))}</strong></div>
          <div class="box"><span>${escapeHtml(t.sentNotifications)}</span><strong>${escapeHtml(formatNumber(summary.sent_notifications))}</strong></div>
          <div class="box"><span>${escapeHtml(t.failedNotifications)}</span><strong>${escapeHtml(formatNumber(summary.failed_notifications))}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t.table.notification)}</th>
              <th>${escapeHtml(t.table.recipient)}</th>
              <th>${escapeHtml(t.table.channel)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.createdAt)}</th>
            </tr>
          </thead>
          <tbody>${tableRows || `<tr><td colspan="5">${escapeHtml(t.emptyTitle)}</td></tr>`}</tbody>
        </table>

        <script>
          window.addEventListener("load", () => {
            window.focus();
            window.print();
          });
        </script>
      </body>
    </html>
  `;
}

/* ============================================================
   Page
============================================================ */

export default function SystemNotificationsPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [summary, setSummary] =
    useState<NotificationsSummary>(DEFAULT_SUMMARY);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasAnyPermission(
    auth,
    ["notifications.view", "notification_center.view", "system.view"],
    "view",
  );

  const canViewList = hasAnyPermission(
    auth,
    ["notifications.view", "notification_center.view"],
    "view",
  );

  const canViewSettings = hasAnyPermission(
    auth,
    [
      "notifications.settings",
      "notifications.settings.view",
      "notification_center.settings",
      "system.settings",
    ],
    "view",
  );

  const canExport = hasAnyPermission(
    auth,
    ["notifications.export", "reports.export"],
    "action",
  );

  const canPrint = hasAnyPermission(
    auth,
    ["notifications.print", "reports.print"],
    "action",
  );

  const canViewDetails = hasAnyPermission(
    auth,
    ["notifications.view", "notification_center.view"],
    "view",
  );

  const filteredRows = useMemo(() => {
    const clean = query.trim().toLowerCase();

    const sorted = [...rows].sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at)),
    );

    if (!clean) return sorted.slice(0, 12);

    return sorted
      .filter((item) =>
        [
          item.title,
          item.message,
          item.recipient_name,
          item.recipient_email,
          item.recipient_phone,
          item.event_name,
          item.source,
          statusLabel(item.status, locale),
          channelLabel(item.channel, locale),
          severityLabel(item.severity, locale),
        ]
          .join(" ")
          .toLowerCase()
          .includes(clean),
      )
      .slice(0, 12);
  }, [locale, query, rows]);

  const activeSummary = useMemo(
    () => buildSummary(filteredRows),
    [filteredRows],
  );

  const displaySummary = query.trim() ? activeSummary : summary;
  const hasData = rows.length > 0;
  const hasSearch = query.trim().length > 0;

  const loadNotifications = useCallback(
    async (showToast = false) => {
      if (!canView) {
        setRows([]);
        setSummary(DEFAULT_SUMMARY);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const payload = await loadFirstAvailable([
          "/api/notifications/inbox/?page_size=500",
          "/api/notifications/?page_size=500",
          "/api/notification-center/inbox/?page_size=500",
        ]);

        if (!payload) {
          throw new Error(t.loadError);
        }

        const normalizedRows = [
          ...extractRows(payload, "notifications"),
          ...extractRows(payload, "inbox"),
        ]
          .map(normalizeNotification)
          .filter((item) => item.id || item.title);

        const dedupedRows = Array.from(
          new Map(normalizedRows.map((item) => [String(item.id), item])).values(),
        );

        setRows(dedupedRows);
        setSummary(buildSummary(dedupedRows, extractSummary(payload)));

        if (showToast) toast.success(t.loadSuccess);
      } catch (error) {
        console.error("Notifications overview load error:", error);
        setRows([]);
        setSummary(DEFAULT_SUMMARY);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canView, t.loadError, t.loadSuccess],
  );

  function exportExcel() {
    if (!canExport) return;

    if (!hasData) {
      toast.error(t.exportEmpty);
      return;
    }

    downloadExcel({
      filename: `primey-care-notifications-${new Date().toISOString().slice(0, 10)}.xls`,
      title: t.title,
      locale,
      summary: displaySummary,
      rows: hasSearch ? filteredRows : rows,
    });

    toast.success(t.exportSuccess);
  }

  function printPage() {
    if (!canPrint) return;

    if (!hasData) {
      toast.error(t.exportEmpty);
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        locale,
        title: t.title,
        summary: displaySummary,
        rows: hasSearch ? filteredRows : rows,
      }),
    );
    printWindow.document.close();

    toast.success(t.printSuccess);
  }

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readLocale();

      applyDocumentLocale(nextLocale);
      setLocale(nextLocale);
    };

    const syncAfterPaint = () => {
      syncLocale();
      window.setTimeout(syncLocale, 0);
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
    if (authResolving) return;
    loadNotifications(false);
  }, [authResolving, loadNotifications]);

  if (!authResolving && !canView) {
    return (
      <div className="w-full space-y-4" dir={isArabic ? "rtl" : "ltr"}>
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5" />
            </div>

            <div>
              <p className="font-semibold text-destructive">
                {t.accessDeniedTitle}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.accessDeniedText}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.title}
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadNotifications(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canExport ? (
            <Button
              className="h-10 rounded-xl"
              onClick={exportExcel}
              disabled={isLoading || !hasData || Boolean(errorMessage)}
            >
              <Download className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </Button>
          ) : null}

          {canPrint ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printPage}
              disabled={isLoading || !hasData || Boolean(errorMessage)}
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {!isLoading && errorMessage ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <XCircle className="h-5 w-5" />
              </div>

              <div>
                <p className="font-semibold text-destructive">{errorMessage}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.loadErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadNotifications(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title={t.totalNotifications}
              value={formatNumber(displaySummary.total_notifications)}
              icon={<BellRing className="h-5 w-5" />}
            />
            <KpiCard
              title={t.unreadNotifications}
              value={formatNumber(displaySummary.unread_notifications)}
              icon={<Inbox className="h-5 w-5" />}
            />
            <KpiCard
              title={t.sentNotifications}
              value={formatNumber(displaySummary.sent_notifications)}
              icon={<BadgeCheck className="h-5 w-5" />}
            />
            <KpiCard
              title={t.failedNotifications}
              value={formatNumber(displaySummary.failed_notifications)}
              icon={<XCircle className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MiniStat
              title={t.emailNotifications}
              value={displaySummary.email_notifications}
            />
            <MiniStat
              title={t.whatsappNotifications}
              value={displaySummary.whatsapp_notifications}
            />
            <MiniStat
              title={t.pendingNotifications}
              value={displaySummary.pending_notifications}
            />
            <MiniStat
              title={t.errorNotifications}
              value={displaySummary.error_notifications}
            />
          </div>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">
                {t.shortcutsTitle}
              </CardTitle>
              <CardDescription>{t.shortcutsDesc}</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {canViewList ? (
                  <Link href="/system/notifications/list">
                    <Card className="h-full rounded-2xl border bg-background/70 shadow-sm transition hover:bg-muted/40">
                      <CardContent className="flex h-full items-start gap-3 p-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <FileText className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold">{t.notificationsList}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {isArabic
                              ? "عرض الإشعارات مع البحث والفلاتر والإجراءات."
                              : "Open notifications with search, filters, and actions."}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ) : null}

                {canViewSettings ? (
                  <Link href="/system/notifications/settings">
                    <Card className="h-full rounded-2xl border bg-background/70 shadow-sm transition hover:bg-muted/40">
                      <CardContent className="flex h-full items-start gap-3 p-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <Settings className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold">
                            {t.notificationSettings}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {isArabic
                              ? "ضبط قنوات الإشعارات وسلوك التنبيهات."
                              : "Configure notification channels and alert behavior."}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-4">
              <div className="relative w-full">
                <Search
                  className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                    isArabic ? "right-3" : "left-3"
                  }`}
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.searchPlaceholder}
                  className={`h-11 rounded-xl ${isArabic ? "pr-10" : "pl-10"}`}
                />
              </div>
            </CardContent>
          </Card>

          {!hasData ? (
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                <Bell className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-semibold">{t.emptyTitle}</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  {t.emptyText}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {hasData && hasSearch && filteredRows.length === 0 ? (
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                <Search className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-semibold">{t.noResultsTitle}</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  {t.noResultsText}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.latestTitle}
                  </CardTitle>
                  <CardDescription>{t.latestDesc}</CardDescription>
                </div>

                {canViewList ? (
                  <Link href="/system/notifications/list">
                    <Button variant="outline" className="h-10 rounded-xl">
                      <ArrowUpRight className="h-4 w-4" />
                      {t.notificationsList}
                    </Button>
                  </Link>
                ) : null}
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-hidden rounded-xl border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[250px]">
                          {t.table.notification}
                        </TableHead>
                        <TableHead className="min-w-[180px]">
                          {t.table.recipient}
                        </TableHead>
                        <TableHead className="min-w-[120px]">
                          {t.table.channel}
                        </TableHead>
                        <TableHead className="min-w-[120px]">
                          {t.table.status}
                        </TableHead>
                        <TableHead className="min-w-[120px]">
                          {t.table.severity}
                        </TableHead>
                        <TableHead className="min-w-[160px]">
                          {t.table.createdAt}
                        </TableHead>
                        {canViewDetails ? (
                          <TableHead className="min-w-[90px]">
                            {t.table.action}
                          </TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {filteredRows.length > 0 ? (
                        filteredRows.map((item) => (
                          <TableRow key={`${item.id}-${item.title}`}>
                            <TableCell>
                              <div className="min-w-[230px]">
                                <p className="font-semibold">{item.title}</p>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                  {item.message || item.event_name || "-"}
                                </p>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="min-w-[160px]">
                                <p className="inline-flex items-center gap-1.5 text-sm font-medium">
                                  <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                                  {item.recipient_name || "-"}
                                </p>

                                <p
                                  className="mt-1 text-xs text-muted-foreground"
                                  dir="ltr"
                                >
                                  {item.recipient_email ||
                                    item.recipient_phone ||
                                    "-"}
                                </p>
                              </div>
                            </TableCell>

                            <TableCell>
                              <ChannelBadge channel={item.channel} locale={locale} />
                            </TableCell>

                            <TableCell>{statusBadge(item.status, locale)}</TableCell>

                            <TableCell>
                              <Badge variant="outline" className="rounded-full">
                                {severityLabel(item.severity, locale)}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              {formatDate(item.created_at, locale)}
                            </TableCell>

                            {canViewDetails ? (
                              <TableCell>
                                {isValidId(item.id) ? (
                                  <Link href={`/system/notifications/${item.id}`}>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 rounded-lg"
                                    >
                                      <Eye className="h-4 w-4" />
                                      <span className="sr-only">{t.view}</span>
                                    </Button>
                                  </Link>
                                ) : (
                                  <span className="text-sm text-muted-foreground">
                                    -
                                  </span>
                                )}
                              </TableCell>
                            ) : null}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={canViewDetails ? 7 : 6}
                            className="h-32 text-center"
                          >
                            <p className="text-sm text-muted-foreground">
                              {hasSearch ? t.noResultsText : t.emptyText}
                            </p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/* ============================================================
   Small Components
============================================================ */

async function loadFirstAvailable(endpoints: string[]) {
  let lastError = "";

  for (const endpoint of endpoints) {
    const response = await fetch(apiUrl(endpoint), {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    const payload = (await response.json().catch(() => null)) as
      | ApiEnvelope<unknown>
      | null;

    if (response.ok && payload?.ok !== false && payload?.success !== false) {
      return payload;
    }

    lastError =
      payload?.message ||
      payload?.detail ||
      payload?.error ||
      `HTTP ${response.status}`;
  }

  console.warn("Notifications endpoint fallback failed:", lastError);
  return null;
}

function ChannelBadge({
  channel,
  locale,
}: {
  channel: NotificationChannel;
  locale: AppLocale;
}) {
  const iconMap: Record<NotificationChannel, ReactNode> = {
    IN_APP: <Inbox className="h-3.5 w-3.5" />,
    EMAIL: <Mail className="h-3.5 w-3.5" />,
    WHATSAPP: <MessageCircle className="h-3.5 w-3.5" />,
    SMS: <Smartphone className="h-3.5 w-3.5" />,
    SYSTEM: <ShieldCheck className="h-3.5 w-3.5" />,
    UNKNOWN: <Bell className="h-3.5 w-3.5" />,
  };

  return (
    <Badge variant="outline" className="rounded-full">
      {iconMap[channel]}
      {channelLabel(channel, locale)}
    </Badge>
  );
}

function KpiCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: ReactNode;
  icon: ReactNode;
}) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <p className="mt-1 text-sm text-muted-foreground">{title}</p>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ title, value }: { title: string; value: number }) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{title}</span>
          <span className="text-lg font-bold">{formatNumber(value)}</span>
        </div>
      </CardContent>
    </Card>
  );
}