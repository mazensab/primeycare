"use client";

/* ============================================================
   📂 app/system/notifications/list/page.tsx
   🧠 Primey Care | Notifications List
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ مبني بنفس نمط قائمة المراكز/العملاء المعتمد
   ✅ البحث في صف مستقل
   ✅ الفلاتر والأعمدة في صف مستقل تحت البحث
   ✅ Excel export بصيغة .xls HTML Workbook
   ✅ Web PDF Print
   ✅ Error State مستقل
   ✅ Empty State ذكي
   ✅ Loading Skeleton
   ✅ حماية روابط التفاصيل والأزرار والطلبات
   ✅ fallback آمن لـ system_admin / superadmin
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ استخدام toast من sonner
   ✅ بدون localhost hardcoded
   ✅ لا توجد روابط تقارير داخل الوحدة
   ✅ لا توجد نصوص تقنية ظاهرة في الواجهة
   ✅ الأرقام تبقى بالإنجليزية
============================================================ */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowLeft,
  Bell,
  BellRing,
  CheckCircle2,
  ColumnsIcon,
  Copy,
  Download,
  Eye,
  Inbox,
  Loader2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
  Send,
  Settings,
  Smartphone,
  UserRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
type AuthRecord = Record<string, unknown>;

type NotificationStatus =
  | "UNREAD"
  | "READ"
  | "SENT"
  | "FAILED"
  | "PENDING"
  | "UNKNOWN";

type NotificationSeverity =
  | "SUCCESS"
  | "INFO"
  | "WARNING"
  | "ERROR"
  | "CRITICAL"
  | "UNKNOWN";

type NotificationChannel =
  | "IN_APP"
  | "EMAIL"
  | "WHATSAPP"
  | "SMS"
  | "SYSTEM"
  | "UNKNOWN";

type StatusFilter = "ALL" | NotificationStatus;
type ChannelFilter = "ALL" | NotificationChannel;
type SeverityFilter = "ALL" | NotificationSeverity;

type SortKey =
  | "title"
  | "recipientName"
  | "channel"
  | "severity"
  | "status"
  | "eventName"
  | "source"
  | "sentAt"
  | "createdAt";

type SortDirection = "asc" | "desc";

type NotificationItem = {
  id: number | string;
  title: string;
  message: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  status: NotificationStatus;
  severity: NotificationSeverity;
  channel: NotificationChannel;
  eventName: string;
  source: string;
  createdAt: string;
  readAt: string;
  sentAt: string;
  raw: Record<string, unknown>;
};

type NotificationsApiResponse = {
  ok?: boolean;
  message?: string;
  count?: number;
  results?: unknown[];
  notifications?: unknown[];
  items?: unknown[];
  inbox?: unknown[];
  data?:
    | unknown[]
    | {
        results?: unknown[];
        notifications?: unknown[];
        items?: unknown[];
        inbox?: unknown[];
      };
};

type VisibleColumns = {
  notification: boolean;
  recipient: boolean;
  channel: boolean;
  severity: boolean;
  status: boolean;
  event: boolean;
  source: boolean;
  sentAt: boolean;
  createdAt: boolean;
  actions: boolean;
};

type ExcelSheetOptions = {
  filename: string;
  worksheetName: string;
  title: string;
  locale: AppLocale;
  summaryRows: Array<[string, string | number]>;
  filterRows: Array<[string, string | number]>;
  headers: string[];
  rows: Array<Array<string | number>>;
};

const PAGE_SIZE = 10;

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
  } catch (error) {
    console.error("Read locale error:", error);
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
   API Helper
============================================================ */

function apiUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  if (!base) return path;

  return `${base.replace(/\/$/, "")}${path}`;
}

/* ============================================================
   Permission Helpers
============================================================ */

function asRecord(value: unknown): AuthRecord {
  return value && typeof value === "object" ? (value as AuthRecord) : {};
}

function getNestedRecord(source: AuthRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (value && typeof value === "object") {
      return value as AuthRecord;
    }
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
                const obj = item as AuthRecord;

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
            const obj = value as AuthRecord;

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

function getAuthUser(authValue: unknown): AuthRecord {
  const auth = asRecord(authValue);

  return getNestedRecord(auth, [
    "user",
    "currentUser",
    "profile",
    "account",
    "session",
    "data",
  ]);
}

function getAuthRoles(authValue: unknown): string[] {
  const auth = asRecord(authValue);
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
  const auth = asRecord(authValue);
  const user = getAuthUser(authValue);

  const authPermissions = asRecord(auth.permissions);
  const userPermissions = asRecord(user.permissions);
  const authProfilePermissions = asRecord(auth.profile_permissions);
  const userProfilePermissions = asRecord(user.profile_permissions);

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
  const auth = asRecord(authValue);

  return Boolean(
    auth.isLoading ||
      auth.loading ||
      auth.isInitializing ||
      auth.initializing ||
      auth.pending,
  );
}

function isSystemAdmin(authValue: unknown) {
  const auth = asRecord(authValue);
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

function hasKnownPermissionSignal(authValue: unknown) {
  return (
    getAuthRoles(authValue).length > 0 ||
    getAuthPermissionCodes(authValue).length > 0
  );
}

function hasPermissionCode(authValue: unknown, codes: string[]) {
  const permissions = getAuthPermissionCodes(authValue);

  if (permissions.length === 0) return undefined;

  return codes.some((code) => permissions.includes(code));
}

function hasSafePermission(
  authValue: unknown,
  codes: string[],
  mode: "view" | "action",
) {
  if (isSystemAdmin(authValue)) return true;

  const explicitPermission = hasPermissionCode(authValue, codes);

  if (typeof explicitPermission === "boolean") {
    return explicitPermission;
  }

  const roles = getAuthRoles(authValue);

  if (roles.length > 0) {
    if (mode === "view") {
      return roles.some((role) =>
        [
          "system_admin",
          "superuser",
          "super_admin",
          "support",
          "accountant",
          "viewer",
        ].includes(role),
      );
    }

    return roles.some((role) =>
      ["system_admin", "superuser", "super_admin", "support"].includes(role),
    );
  }

  if (!hasKnownPermissionSignal(authValue)) {
    return true;
  }

  return mode === "view";
}

/* ============================================================
   Normalizers
============================================================ */

function normalizeStatus(value: unknown, isRead?: unknown): NotificationStatus {
  const status = String(value || "").toUpperCase();

  if (status === "UNREAD") return "UNREAD";
  if (status === "READ") return "READ";
  if (status === "SENT") return "SENT";
  if (status === "FAILED") return "FAILED";
  if (status === "PENDING") return "PENDING";

  if (typeof isRead === "boolean") {
    return isRead ? "READ" : "UNREAD";
  }

  return "UNKNOWN";
}

function normalizeSeverity(value: unknown): NotificationSeverity {
  const severity = String(value || "").toUpperCase();

  if (severity === "SUCCESS") return "SUCCESS";
  if (severity === "INFO") return "INFO";
  if (severity === "WARNING" || severity === "WARN") return "WARNING";
  if (severity === "ERROR") return "ERROR";
  if (severity === "CRITICAL") return "CRITICAL";

  return "UNKNOWN";
}

function normalizeChannel(value: unknown): NotificationChannel {
  const channel = String(value || "").toUpperCase();

  if (channel === "IN_APP" || channel === "INAPP" || channel === "APP") {
    return "IN_APP";
  }

  if (channel === "EMAIL") return "EMAIL";
  if (channel === "WHATSAPP" || channel === "WA") return "WHATSAPP";
  if (channel === "SMS") return "SMS";
  if (channel === "SYSTEM") return "SYSTEM";

  return "UNKNOWN";
}

function getObjectValue(obj: Record<string, unknown>, key: string): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  const containers = [
    "notification",
    "recipient",
    "user",
    "event",
    "delivery",
    "item",
    "data",
    "summary",
  ];

  for (const container of containers) {
    const nested = obj[container];

    if (nested && typeof nested === "object") {
      const nestedObj = nested as Record<string, unknown>;
      const value = nestedObj[key];

      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
  }

  return undefined;
}

function extractNotifications(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  const response = payload as NotificationsApiResponse;

  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response.notifications)) return response.notifications;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.inbox)) return response.inbox;
  if (Array.isArray(response.data)) return response.data;

  if (response.data && typeof response.data === "object") {
    if (Array.isArray(response.data.results)) return response.data.results;
    if (Array.isArray(response.data.notifications)) {
      return response.data.notifications;
    }
    if (Array.isArray(response.data.items)) return response.data.items;
    if (Array.isArray(response.data.inbox)) return response.data.inbox;
  }

  return [];
}

function normalizeNotification(item: unknown): NotificationItem {
  const obj = (item || {}) as Record<string, unknown>;
  const recipient = obj.recipient as Record<string, unknown> | undefined;
  const user = obj.user as Record<string, unknown> | undefined;
  const event = obj.event as Record<string, unknown> | undefined;

  const id = getObjectValue(obj, "id") ?? "";

  return {
    id: id as number | string,
    title: String(
      getObjectValue(obj, "title") ??
        getObjectValue(obj, "subject") ??
        getObjectValue(obj, "name") ??
        "-",
    ),
    message: String(
      getObjectValue(obj, "message") ??
        getObjectValue(obj, "body") ??
        getObjectValue(obj, "content") ??
        getObjectValue(obj, "description") ??
        "",
    ),
    recipientName: String(
      getObjectValue(obj, "recipient_name") ??
        recipient?.name ??
        user?.full_name ??
        user?.name ??
        "-",
    ),
    recipientEmail: String(
      getObjectValue(obj, "recipient_email") ??
        recipient?.email ??
        user?.email ??
        "",
    ),
    recipientPhone: String(
      getObjectValue(obj, "recipient_phone") ??
        getObjectValue(obj, "recipient_mobile") ??
        recipient?.phone ??
        recipient?.mobile ??
        user?.phone ??
        user?.mobile ??
        "",
    ),
    status: normalizeStatus(
      getObjectValue(obj, "status"),
      getObjectValue(obj, "is_read") ?? getObjectValue(obj, "read"),
    ),
    severity: normalizeSeverity(
      getObjectValue(obj, "severity") ?? getObjectValue(obj, "level"),
    ),
    channel: normalizeChannel(
      getObjectValue(obj, "channel") ?? getObjectValue(obj, "delivery_channel"),
    ),
    eventName: String(
      getObjectValue(obj, "event_name") ??
        getObjectValue(obj, "event_type") ??
        event?.name ??
        event?.code ??
        "-",
    ),
    source: String(
      getObjectValue(obj, "source") ??
        getObjectValue(obj, "module") ??
        getObjectValue(obj, "category") ??
        "-",
    ),
    createdAt: String(getObjectValue(obj, "created_at") ?? ""),
    readAt: String(getObjectValue(obj, "read_at") ?? ""),
    sentAt: String(
      getObjectValue(obj, "sent_at") ??
        getObjectValue(obj, "delivered_at") ??
        getObjectValue(obj, "created_at") ??
        "",
    ),
    raw: obj,
  };
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "قائمة الإشعارات" : "Notifications List",
    subtitle: isArabic
      ? "استعراض الإشعارات مع البحث والفلاتر والأعمدة والفرز والتصدير والطباعة."
      : "Browse notifications with search, filters, columns, sorting, export, and print.",

    back: isArabic ? "مركز الإشعارات" : "Notifications Center",
    settings: isArabic ? "إعدادات الإشعارات" : "Notification Settings",
    createNotification: isArabic ? "إنشاء إشعار" : "Create Notification",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",
    columns: isArabic ? "الأعمدة" : "Columns",

    tableTitle: isArabic ? "بيانات الإشعارات" : "Notifications Data",
    tableSubtitle: isArabic
      ? "استعرض الإشعارات، رتّب البيانات، وخصص الأعمدة حسب احتياجك."
      : "Browse notifications, sort data, and customize columns as needed.",

    searchPlaceholder: isArabic
      ? "ابحث بعنوان الإشعار أو المستلم أو القناة أو الحالة أو الرسالة..."
      : "Search by notification title, recipient, channel, status, or message...",

    all: isArabic ? "الكل" : "All",
    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    allChannels: isArabic ? "كل القنوات" : "All Channels",
    allSeverities: isArabic ? "كل مستويات الأهمية" : "All Severities",

    unread: isArabic ? "غير مقروء" : "Unread",
    read: isArabic ? "مقروء" : "Read",
    sent: isArabic ? "مرسل" : "Sent",
    failed: isArabic ? "فشل" : "Failed",
    pending: isArabic ? "بانتظار الإرسال" : "Pending",
    unknown: isArabic ? "غير محدد" : "Unknown",

    success: isArabic ? "نجاح" : "Success",
    info: isArabic ? "معلومة" : "Info",
    warning: isArabic ? "تنبيه" : "Warning",
    error: isArabic ? "خطأ" : "Error",
    critical: isArabic ? "حرج" : "Critical",

    inApp: isArabic ? "داخل النظام" : "In-App",
    email: isArabic ? "البريد الإلكتروني" : "Email",
    whatsapp: isArabic ? "واتساب" : "WhatsApp",
    sms: isArabic ? "رسالة SMS" : "SMS",
    system: isArabic ? "النظام" : "System",

    totalNotifications: isArabic ? "إجمالي الإشعارات" : "Total Notifications",
    unreadNotifications: isArabic ? "غير مقروءة" : "Unread",
    sentNotifications: isArabic ? "مرسلة" : "Sent",
    failedNotifications: isArabic ? "فشل الإرسال" : "Failed",
    pendingNotifications: isArabic ? "بانتظار الإرسال" : "Pending",

    selectedRows: isArabic ? "صفوف محددة" : "row(s) selected",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",
    page: isArabic ? "صفحة" : "Page",
    from: isArabic ? "من" : "of",

    emptyTitle: isArabic ? "لا توجد إشعارات بعد" : "No notifications yet",
    emptyText: isArabic
      ? "عند إنشاء أو استقبال إشعارات جديدة ستظهر بياناتها هنا مباشرة."
      : "New notifications will appear here once they are created or received.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث أو فلاتر الحالة والقناة والأهمية."
      : "Try changing search keywords, status, channel, or severity filters.",

    actions: isArabic ? "الإجراءات" : "Actions",
    viewDetails: isArabic ? "عرض التفاصيل" : "View Details",
    copyTitle: isArabic ? "نسخ العنوان" : "Copy Title",
    copyId: isArabic ? "نسخ المعرف" : "Copy ID",
    copyRecipient: isArabic ? "نسخ المستلم" : "Copy Recipient",
    copyEmail: isArabic ? "نسخ البريد" : "Copy Email",
    copyPhone: isArabic ? "نسخ الجوال" : "Copy Phone",
    copyMessage: isArabic ? "نسخ الرسالة" : "Copy Message",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض قائمة الإشعارات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view notifications list. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل قائمة الإشعارات."
      : "Unable to load notifications list.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث قائمة الإشعارات بنجاح."
      : "Notifications list refreshed successfully.",
    exportSuccess: isArabic
      ? "تم تجهيز ملف Excel بنجاح."
      : "Excel file prepared successfully.",
    exportEmpty: isArabic
      ? "لا توجد بيانات قابلة للتصدير."
      : "No data available to export.",
    printReady: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    reportScope: isArabic ? "نطاق التقرير" : "Report Scope",
    currentFilteredData: isArabic
      ? "حسب الفلاتر الحالية"
      : "Current filtered data",
    selectedScope: isArabic ? "الصفوف المحددة" : "Selected rows",
    filterSearch: isArabic ? "البحث" : "Search",
    filterStatus: isArabic ? "فلتر الحالة" : "Status Filter",
    filterChannel: isArabic ? "فلتر القناة" : "Channel Filter",
    filterSeverity: isArabic ? "فلتر الأهمية" : "Severity Filter",

    table: {
      id: isArabic ? "المعرف" : "ID",
      notification: isArabic ? "الإشعار" : "Notification",
      message: isArabic ? "الرسالة" : "Message",
      recipient: isArabic ? "المستلم" : "Recipient",
      recipientEmail: isArabic ? "بريد المستلم" : "Recipient Email",
      recipientPhone: isArabic ? "جوال المستلم" : "Recipient Phone",
      channel: isArabic ? "القناة" : "Channel",
      severity: isArabic ? "الأهمية" : "Severity",
      status: isArabic ? "الحالة" : "Status",
      event: isArabic ? "الحدث" : "Event",
      source: isArabic ? "المصدر" : "Source",
      readAt: isArabic ? "تاريخ القراءة" : "Read At",
      sentAt: isArabic ? "تاريخ الإرسال" : "Sent At",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      actions: isArabic ? "الإجراء" : "Action",
    },

    printTitle: isArabic ? "قائمة الإشعارات" : "Notifications List",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
    rowsCount: isArabic ? "عدد السجلات" : "Rows Count",
  };
}

/* ============================================================
   UI Helpers
============================================================ */

function formatNumber(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatDate(value: string): string {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
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

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

function isValidNotificationId(id: NotificationItem["id"]) {
  const value = String(id || "").trim();

  return value.length > 0 && value !== "-" && value !== "undefined";
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

function channelIcon(channel: NotificationChannel): LucideIcon {
  if (channel === "EMAIL") return Mail;
  if (channel === "WHATSAPP") return MessageCircle;
  if (channel === "SMS") return Smartphone;
  if (channel === "IN_APP") return BellRing;

  return Bell;
}

function statusBadge(status: NotificationStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

  if (status === "READ" || status === "SENT") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "UNREAD" || status === "PENDING") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "FAILED") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="rounded-full px-3 py-1">
      {label}
    </Badge>
  );
}

function severityBadge(severity: NotificationSeverity, locale: AppLocale) {
  const label = severityLabel(severity, locale);

  if (severity === "SUCCESS") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
        {label}
      </Badge>
    );
  }

  if (severity === "WARNING") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50">
        {label}
      </Badge>
    );
  }

  if (severity === "ERROR" || severity === "CRITICAL") {
    return (
      <Badge variant="destructive" className="rounded-full">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="rounded-full">
      {label}
    </Badge>
  );
}

function getColumnLabels(locale: AppLocale) {
  const t = dictionary(locale);

  return {
    notification: t.table.notification,
    recipient: t.table.recipient,
    channel: t.table.channel,
    severity: t.table.severity,
    status: t.table.status,
    event: t.table.event,
    source: t.table.source,
    sentAt: t.table.sentAt,
    createdAt: t.table.createdAt,
    actions: t.actions,
  } satisfies Record<keyof VisibleColumns, string>;
}

function copyToClipboard(value: string, successMessage: string) {
  if (!value || value === "-") return;

  navigator.clipboard.writeText(value);
  toast.success(successMessage);
}

/* ============================================================
   Export / Print
============================================================ */

function downloadExcel(options: ExcelSheetOptions) {
  const dir = options.locale === "ar" ? "rtl" : "ltr";
  const align = options.locale === "ar" ? "right" : "left";
  const colspan = Math.max(options.headers.length, 2);

  const summaryHtml = options.summaryRows
    .map(
      ([label, value]) => `
        <tr>
          <td class="summary-label">${escapeHtml(label)}</td>
          <td class="summary-value">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const filterHtml = options.filterRows
    .map(
      ([label, value]) => `
        <tr>
          <td class="summary-label">${escapeHtml(label)}</td>
          <td class="summary-value">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const headerHtml = options.headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("");

  const rowsHtml = options.rows
    .map(
      (row) => `
        <tr>
          ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}
        </tr>`,
    )
    .join("");

  const workbook = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${escapeHtml(options.worksheetName)}</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayRightToLeft>${options.locale === "ar" ? "True" : "False"}</x:DisplayRightToLeft>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body {
            direction: ${dir};
            font-family: Arial, sans-serif;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          th,
          td {
            border: 1px solid #d9e2ef;
            padding: 8px;
            text-align: ${align};
            vertical-align: top;
            mso-number-format: "\\@";
          }
          th {
            background: #d8ecfb;
            color: #000000;
            font-weight: 700;
          }
          .title {
            font-size: 20px;
            font-weight: 700;
            text-align: center;
            background: #ffffff;
          }
          .section {
            font-weight: 700;
            background: #eef6ff;
          }
          .summary-label {
            font-weight: 700;
            background: #f8fafc;
            width: 240px;
          }
          .summary-value {
            font-weight: 700;
          }
        </style>
      </head>
      <body dir="${dir}">
        <table>
          <tr>
            <td class="title" colspan="${colspan}">
              ${escapeHtml(options.title)}
            </td>
          </tr>
          <tr><td colspan="${colspan}"></td></tr>
          <tr><td class="section" colspan="${colspan}">
            ${options.locale === "ar" ? "ملخص القائمة" : "List Summary"}
          </td></tr>
          ${summaryHtml}
          <tr><td colspan="${colspan}"></td></tr>
          <tr><td class="section" colspan="${colspan}">
            ${options.locale === "ar" ? "الفلاتر المستخدمة" : "Applied Filters"}
          </td></tr>
          ${filterHtml}
          <tr><td colspan="${colspan}"></td></tr>
          <tr>${headerHtml}</tr>
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
  anchor.download = options.filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

function buildPrintHtml({
  locale,
  title,
  rows,
  t,
}: {
  locale: AppLocale;
  title: string;
  rows: NotificationItem[];
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const tableRows = rows
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.title || "-")}</td>
          <td>${escapeHtml(item.recipientName || "-")}</td>
          <td>${escapeHtml(item.recipientEmail || "-")}</td>
          <td>${escapeHtml(item.recipientPhone || "-")}</td>
          <td>${escapeHtml(channelLabel(item.channel, locale))}</td>
          <td>${escapeHtml(severityLabel(item.severity, locale))}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(item.eventName || "-")}</td>
          <td>${escapeHtml(item.source || "-")}</td>
          <td>${escapeHtml(formatDate(item.sentAt || item.createdAt))}</td>
        </tr>
      `,
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
            background: #ffffff;
            direction: ${isArabic ? "rtl" : "ltr"};
            text-align: ${isArabic ? "right" : "left"};
          }
          .print-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 18px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 14px;
          }
          h1 {
            margin: 0;
            font-size: 22px;
            font-weight: 800;
          }
          .meta {
            margin-top: 8px;
            color: #6b7280;
            font-size: 12px;
            line-height: 1.8;
          }
          .badge {
            display: inline-block;
            border: 1px solid #d1d5db;
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 12px;
            color: #374151;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th {
            background: #f3f4f6;
            color: #111827;
            font-weight: 700;
          }
          th,
          td {
            border: 1px solid #e5e7eb;
            padding: 9px 8px;
            text-align: ${isArabic ? "right" : "left"};
            vertical-align: top;
          }
          tr:nth-child(even) td {
            background: #fafafa;
          }
          @page {
            size: A4 landscape;
            margin: 12mm;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>

      <body>
        <div class="print-header">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">
              <div>${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
              <div>${escapeHtml(t.rowsCount)}: ${formatNumber(rows.length)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.notification)}</th>
              <th>${escapeHtml(t.table.recipient)}</th>
              <th>${escapeHtml(t.table.recipientEmail)}</th>
              <th>${escapeHtml(t.table.recipientPhone)}</th>
              <th>${escapeHtml(t.table.channel)}</th>
              <th>${escapeHtml(t.table.severity)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.event)}</th>
              <th>${escapeHtml(t.table.source)}</th>
              <th>${escapeHtml(t.table.sentAt)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              tableRows ||
              `<tr><td colspan="11" style="text-align:center">${escapeHtml(t.emptyTitle)}</td></tr>`
            }
          </tbody>
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
   Skeleton
============================================================ */

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function StatCardSkeleton() {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <SkeletonLine className="h-7 w-16" />
            <SkeletonLine className="h-4 w-28" />
          </div>
          <SkeletonLine className="h-10 w-10 rounded-xl" />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <SkeletonLine className="h-3 w-8" />
          <SkeletonLine className="h-2 flex-1" />
        </div>
      </CardContent>
    </Card>
  );
}

function TableRowsSkeleton({ columnsCount }: { columnsCount: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columnsCount }).map((__, columnIndex) => (
            <TableCell key={columnIndex}>
              <SkeletonLine
                className={
                  columnIndex === 1
                    ? "h-10 w-56 rounded-lg"
                    : "h-4 w-24 rounded-lg"
                }
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/* ============================================================
   Page
============================================================ */

export default function SystemNotificationsListPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("ALL");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");

  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [pageIndex, setPageIndex] = useState(0);

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    notification: true,
    recipient: true,
    channel: true,
    severity: true,
    status: true,
    event: true,
    source: true,
    sentAt: true,
    createdAt: true,
    actions: true,
  });

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canViewNotifications = hasSafePermission(
    auth,
    ["notifications.view", "notifications.list"],
    "view",
  );

  const canCreateNotifications = hasSafePermission(
    auth,
    ["notifications.create", "notifications.send"],
    "action",
  );

  const canManageSettings = hasSafePermission(
    auth,
    ["notifications.settings", "notifications.manage"],
    "action",
  );

  const canExportNotifications = hasSafePermission(
    auth,
    ["notifications.export", "reports.export"],
    "action",
  );

  const canPrintNotifications = hasSafePermission(
    auth,
    ["notifications.print", "reports.print"],
    "action",
  );

  const canViewNotificationDetails = hasSafePermission(
    auth,
    ["notifications.view", "notifications.detail"],
    "view",
  );

  const safeVisibleColumns = useMemo<VisibleColumns>(
    () => ({
      ...visibleColumns,
      actions: visibleColumns.actions && canViewNotificationDetails,
    }),
    [canViewNotificationDetails, visibleColumns],
  );

  const columnLabels = useMemo(() => getColumnLabels(locale), [locale]);

  const stats = useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter((item) => item.status === "UNREAD").length;
    const sent = notifications.filter((item) => item.status === "SENT").length;
    const failed = notifications.filter((item) => item.status === "FAILED").length;
    const pending = notifications.filter((item) => item.status === "PENDING").length;

    return {
      total,
      unread,
      sent,
      failed,
      pending,
    };
  }, [notifications]);

  const statusOptions = useMemo(
    () => [
      {
        value: "ALL" as StatusFilter,
        label: t.allStatuses,
        count: notifications.length,
      },
      {
        value: "UNREAD" as StatusFilter,
        label: t.unread,
        count: notifications.filter((item) => item.status === "UNREAD").length,
      },
      {
        value: "READ" as StatusFilter,
        label: t.read,
        count: notifications.filter((item) => item.status === "READ").length,
      },
      {
        value: "SENT" as StatusFilter,
        label: t.sent,
        count: notifications.filter((item) => item.status === "SENT").length,
      },
      {
        value: "FAILED" as StatusFilter,
        label: t.failed,
        count: notifications.filter((item) => item.status === "FAILED").length,
      },
      {
        value: "PENDING" as StatusFilter,
        label: t.pending,
        count: notifications.filter((item) => item.status === "PENDING").length,
      },
    ],
    [notifications, t],
  );

  const channelOptions = useMemo(
    () => [
      {
        value: "ALL" as ChannelFilter,
        label: t.allChannels,
        count: notifications.length,
      },
      ...(
        ["IN_APP", "EMAIL", "WHATSAPP", "SMS", "SYSTEM"] as NotificationChannel[]
      ).map((channel) => ({
        value: channel as ChannelFilter,
        label: channelLabel(channel, locale),
        count: notifications.filter((item) => item.channel === channel).length,
      })),
    ],
    [locale, notifications, t.allChannels],
  );

  const severityOptions = useMemo(
    () => [
      {
        value: "ALL" as SeverityFilter,
        label: t.allSeverities,
        count: notifications.length,
      },
      ...(
        ["SUCCESS", "INFO", "WARNING", "ERROR", "CRITICAL"] as NotificationSeverity[]
      ).map((severity) => ({
        value: severity as SeverityFilter,
        label: severityLabel(severity, locale),
        count: notifications.filter((item) => item.severity === severity).length,
      })),
    ],
    [locale, notifications, t.allSeverities],
  );

  const filteredNotifications = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return notifications.filter((item) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : item.status === statusFilter;

      const matchesChannel =
        channelFilter === "ALL" ? true : item.channel === channelFilter;

      const matchesSeverity =
        severityFilter === "ALL" ? true : item.severity === severityFilter;

      const matchesQuery = !cleanQuery
        ? true
        : [
            item.title,
            item.message,
            item.recipientName,
            item.recipientEmail,
            item.recipientPhone,
            item.status,
            item.channel,
            item.severity,
            item.eventName,
            item.source,
            statusLabel(item.status, locale),
            channelLabel(item.channel, locale),
            severityLabel(item.severity, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesStatus && matchesChannel && matchesSeverity && matchesQuery;
    });
  }, [
    channelFilter,
    locale,
    notifications,
    query,
    severityFilter,
    statusFilter,
  ]);

  const sortedNotifications = useMemo(() => {
    const rows = [...filteredNotifications];

    rows.sort((firstItem, secondItem) => {
      let first: string | number = "";
      let second: string | number = "";

      if (sortKey === "title") {
        first = firstItem.title.toLowerCase();
        second = secondItem.title.toLowerCase();
      }

      if (sortKey === "recipientName") {
        first = firstItem.recipientName.toLowerCase();
        second = secondItem.recipientName.toLowerCase();
      }

      if (sortKey === "channel") {
        first = firstItem.channel.toLowerCase();
        second = secondItem.channel.toLowerCase();
      }

      if (sortKey === "severity") {
        first = firstItem.severity.toLowerCase();
        second = secondItem.severity.toLowerCase();
      }

      if (sortKey === "status") {
        first = firstItem.status.toLowerCase();
        second = secondItem.status.toLowerCase();
      }

      if (sortKey === "eventName") {
        first = firstItem.eventName.toLowerCase();
        second = secondItem.eventName.toLowerCase();
      }

      if (sortKey === "source") {
        first = firstItem.source.toLowerCase();
        second = secondItem.source.toLowerCase();
      }

      if (sortKey === "sentAt") {
        first = new Date(firstItem.sentAt || firstItem.createdAt || 0).getTime();
        second = new Date(secondItem.sentAt || secondItem.createdAt || 0).getTime();
      }

      if (sortKey === "createdAt") {
        first = new Date(firstItem.createdAt || firstItem.sentAt || 0).getTime();
        second = new Date(secondItem.createdAt || secondItem.sentAt || 0).getTime();
      }

      if (first < second) return sortDirection === "asc" ? -1 : 1;
      if (first > second) return sortDirection === "asc" ? 1 : -1;

      return 0;
    });

    return rows;
  }, [filteredNotifications, sortDirection, sortKey]);

  const exportRows = useMemo(() => {
    if (selectedIds.length > 0) {
      return sortedNotifications.filter((item) => selectedIds.includes(item.id));
    }

    return sortedNotifications;
  }, [selectedIds, sortedNotifications]);

  const pageCount = Math.max(1, Math.ceil(sortedNotifications.length / PAGE_SIZE));

  const pageRows = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return sortedNotifications.slice(start, start + PAGE_SIZE);
  }, [pageIndex, sortedNotifications]);

  const selectedOnPage = pageRows.filter((row) =>
    selectedIds.includes(row.id),
  ).length;

  const allPageSelected =
    pageRows.length > 0 && selectedOnPage === pageRows.length;

  const hasSearchOrFilter =
    query.trim().length > 0 ||
    statusFilter !== "ALL" ||
    channelFilter !== "ALL" ||
    severityFilter !== "ALL";

  const visibleTableColumnsCount =
    1 + Object.values(safeVisibleColumns).filter(Boolean).length;

  const loadNotifications = useCallback(
    async (showToast = false) => {
      if (!canViewNotifications) {
        setIsLoading(false);
        setNotifications([]);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const endpoints = [
          "/api/notifications/inbox/?page_size=200",
          "/api/notifications/?page_size=200",
        ];

        let payload: NotificationsApiResponse | null = null;
        let loaded = false;

        for (const endpoint of endpoints) {
          const response = await fetch(apiUrl(endpoint), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          });

          const result = (await response.json().catch(() => null)) as
            | NotificationsApiResponse
            | null;

          if (response.status === 404 || response.status === 405) {
            payload = result;
            continue;
          }

          if (!response.ok || result?.ok === false) {
            throw new Error(result?.message || `HTTP ${response.status}`);
          }

          payload = result;
          loaded = true;
          break;
        }

        if (!loaded) {
          throw new Error(payload?.message || "Unable to load notifications");
        }

        setNotifications(extractNotifications(payload).map(normalizeNotification));

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load notifications list:", error);
        setNotifications([]);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewNotifications, t.loadError, t.refreshSuccess],
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function toggleRow(id: string | number) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function toggleAllPageRows() {
    const pageIds = pageRows.map((row) => row.id);

    if (allPageSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !pageIds.includes(id)),
      );
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...pageIds])));
  }

  function clearFilters() {
    setQuery("");
    setStatusFilter("ALL");
    setChannelFilter("ALL");
    setSeverityFilter("ALL");
  }

  function exportExcel() {
    if (!canExportNotifications) return;

    if (exportRows.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    const statusLabelText =
      statusOptions.find((item) => item.value === statusFilter)?.label || t.all;

    const channelLabelText =
      channelOptions.find((item) => item.value === channelFilter)?.label || t.all;

    const severityLabelText =
      severityOptions.find((item) => item.value === severityFilter)?.label || t.all;

    downloadExcel({
      filename: `primey-care-notifications-list-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "قائمة الإشعارات" : "Notifications List",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [
          t.reportScope,
          selectedIds.length > 0 ? t.selectedScope : t.currentFilteredData,
        ],
        [
          t.table.notification,
          `${formatNumber(exportRows.length)} / ${formatNumber(
            notifications.length,
          )}`,
        ],
        [t.totalNotifications, stats.total],
        [t.unreadNotifications, stats.unread],
        [t.sentNotifications, stats.sent],
        [t.failedNotifications, stats.failed],
        [t.pendingNotifications, stats.pending],
      ],
      filterRows: [
        [t.filterSearch, query || t.all],
        [t.filterStatus, statusLabelText],
        [t.filterChannel, channelLabelText],
        [t.filterSeverity, severityLabelText],
      ],
      headers: [
        t.table.id,
        t.table.notification,
        t.table.message,
        t.table.recipient,
        t.table.recipientEmail,
        t.table.recipientPhone,
        t.table.channel,
        t.table.severity,
        t.table.status,
        t.table.event,
        t.table.source,
        t.table.sentAt,
        t.table.readAt,
        t.table.createdAt,
      ],
      rows: exportRows.map((item) => [
        String(item.id || "-"),
        item.title || "-",
        item.message || "-",
        item.recipientName || "-",
        item.recipientEmail || "-",
        item.recipientPhone || "-",
        channelLabel(item.channel, locale),
        severityLabel(item.severity, locale),
        statusLabel(item.status, locale),
        item.eventName || "-",
        item.source || "-",
        formatDate(item.sentAt || item.createdAt),
        formatDate(item.readAt),
        formatDate(item.createdAt),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printList() {
    if (!canPrintNotifications) return;

    if (exportRows.length === 0) {
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
        title: t.printTitle,
        rows: exportRows,
        t,
      }),
    );
    printWindow.document.close();

    toast.success(t.printReady);
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
    if (authResolving) return;
    loadNotifications(false);
  }, [authResolving, loadNotifications]);

  useEffect(() => {
    setPageIndex(0);
    setSelectedIds([]);
  }, [query, statusFilter, channelFilter, severityFilter]);

  if (!authResolving && !canViewNotifications) {
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
      {/* Header */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.title}
          </h1>

          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/system/notifications">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

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

          {canExportNotifications ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={exportExcel}
              disabled={
                isLoading || exportRows.length === 0 || Boolean(errorMessage)
              }
            >
              <Download className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </Button>
          ) : null}

          {canPrintNotifications ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printList}
              disabled={
                isLoading || exportRows.length === 0 || Boolean(errorMessage)
              }
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canManageSettings ? (
            <Link href="/system/notifications/settings">
              <Button
                variant="outline"
                className="h-10 w-full rounded-xl sm:w-auto"
              >
                <Settings className="h-4 w-4" />
                <span>{t.settings}</span>
              </Button>
            </Link>
          ) : null}

          {canCreateNotifications ? (
            <Link href="/system/notifications/create">
              <Button className="h-10 w-full rounded-xl sm:w-auto">
                <PlusCircle className="h-4 w-4" />
                <span>{t.createNotification}</span>
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {/* Error State */}
      {!isLoading && errorMessage ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <XCircle className="h-5 w-5" />
              </div>

              <div>
                <p className="font-semibold text-destructive">
                  {errorMessage}
                </p>
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

      {!errorMessage ? (
        <>
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {isLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <StatCardSkeleton key={index} />
                ))
              : [
                  {
                    title: t.totalNotifications,
                    value: stats.total,
                    percent: stats.total > 0 ? 100 : 0,
                    icon: Bell,
                  },
                  {
                    title: t.unreadNotifications,
                    value: stats.unread,
                    percent: percent(stats.unread, stats.total),
                    icon: BellRing,
                  },
                  {
                    title: t.sentNotifications,
                    value: stats.sent,
                    percent: percent(stats.sent, stats.total),
                    icon: Send,
                  },
                  {
                    title: t.failedNotifications,
                    value: stats.failed,
                    percent: percent(stats.failed, stats.total),
                    icon: AlertTriangle,
                  },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <Card
                      key={item.title}
                      className="rounded-2xl border bg-card shadow-sm"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-2xl font-bold">
                              {formatNumber(item.value)}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.title}
                            </p>
                          </div>

                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            {formatNumber(item.percent)}%
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${item.percent}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
          </div>

          {/* Table */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {t.tableTitle}
              </CardTitle>
              <CardDescription>{t.tableSubtitle}</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="w-full space-y-4">
                {/* Search Row */}
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

                {/* Filters Row */}
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="grid flex-1 gap-3">
                    <div className="flex flex-wrap gap-2">
                      {statusOptions.map((item) => (
                        <Button
                          key={item.value}
                          variant={
                            statusFilter === item.value ? "default" : "outline"
                          }
                          className="h-10 rounded-xl"
                          onClick={() => setStatusFilter(item.value)}
                        >
                          <span>{item.label}</span>
                          <Badge
                            variant={
                              statusFilter === item.value
                                ? "secondary"
                                : "outline"
                            }
                            className="ms-1 rounded-full"
                          >
                            {formatNumber(item.count)}
                          </Badge>
                        </Button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {channelOptions.map((item) => (
                        <Button
                          key={item.value}
                          variant={
                            channelFilter === item.value ? "default" : "outline"
                          }
                          className="h-10 rounded-xl"
                          onClick={() => setChannelFilter(item.value)}
                        >
                          <span>{item.label}</span>
                          <Badge
                            variant={
                              channelFilter === item.value
                                ? "secondary"
                                : "outline"
                            }
                            className="ms-1 rounded-full"
                          >
                            {formatNumber(item.count)}
                          </Badge>
                        </Button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {severityOptions.map((item) => (
                        <Button
                          key={item.value}
                          variant={
                            severityFilter === item.value ? "default" : "outline"
                          }
                          className="h-10 rounded-xl"
                          onClick={() => setSeverityFilter(item.value)}
                        >
                          <span>{item.label}</span>
                          <Badge
                            variant={
                              severityFilter === item.value
                                ? "secondary"
                                : "outline"
                            }
                            className="ms-1 rounded-full"
                          >
                            {formatNumber(item.count)}
                          </Badge>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {hasSearchOrFilter ? (
                      <Button
                        variant="outline"
                        className="h-10 rounded-xl"
                        onClick={clearFilters}
                      >
                        {t.clearFilters}
                      </Button>
                    ) : null}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-10 rounded-xl">
                          <ColumnsIcon className="h-4 w-4" />
                          <span>{t.columns}</span>
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align={isArabic ? "start" : "end"}>
                        {Object.entries(visibleColumns).map(([key, value]) => {
                          if (key === "actions" && !canViewNotificationDetails) {
                            return null;
                          }

                          return (
                            <DropdownMenuCheckboxItem
                              key={key}
                              checked={value}
                              onCheckedChange={(checked) =>
                                setVisibleColumns((current) => ({
                                  ...current,
                                  [key]: Boolean(checked),
                                }))
                              }
                            >
                              {columnLabels[key as keyof VisibleColumns]}
                            </DropdownMenuCheckboxItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={allPageSelected}
                              onCheckedChange={toggleAllPageRows}
                              aria-label="Select all"
                            />
                          </TableHead>

                          {safeVisibleColumns.notification ? (
                            <SortableHead
                              label={t.table.notification}
                              onClick={() => toggleSort("title")}
                            />
                          ) : null}

                          {safeVisibleColumns.recipient ? (
                            <SortableHead
                              label={t.table.recipient}
                              onClick={() => toggleSort("recipientName")}
                            />
                          ) : null}

                          {safeVisibleColumns.channel ? (
                            <SortableHead
                              label={t.table.channel}
                              onClick={() => toggleSort("channel")}
                            />
                          ) : null}

                          {safeVisibleColumns.severity ? (
                            <SortableHead
                              label={t.table.severity}
                              onClick={() => toggleSort("severity")}
                            />
                          ) : null}

                          {safeVisibleColumns.status ? (
                            <SortableHead
                              label={t.table.status}
                              onClick={() => toggleSort("status")}
                            />
                          ) : null}

                          {safeVisibleColumns.event ? (
                            <SortableHead
                              label={t.table.event}
                              onClick={() => toggleSort("eventName")}
                            />
                          ) : null}

                          {safeVisibleColumns.source ? (
                            <SortableHead
                              label={t.table.source}
                              onClick={() => toggleSort("source")}
                            />
                          ) : null}

                          {safeVisibleColumns.sentAt ? (
                            <SortableHead
                              label={t.table.sentAt}
                              onClick={() => toggleSort("sentAt")}
                            />
                          ) : null}

                          {safeVisibleColumns.createdAt ? (
                            <SortableHead
                              label={t.table.createdAt}
                              onClick={() => toggleSort("createdAt")}
                            />
                          ) : null}

                          {safeVisibleColumns.actions ? (
                            <TableHead>{t.table.actions}</TableHead>
                          ) : null}
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {isLoading ? (
                          <TableRowsSkeleton
                            columnsCount={visibleTableColumnsCount}
                          />
                        ) : pageRows.length > 0 ? (
                          pageRows.map((item) => {
                            const ChannelIcon = channelIcon(item.channel);

                            return (
                              <TableRow
                                key={`${item.id}-${item.title}`}
                                data-state={
                                  selectedIds.includes(item.id)
                                    ? "selected"
                                    : undefined
                                }
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={selectedIds.includes(item.id)}
                                    onCheckedChange={() => toggleRow(item.id)}
                                    aria-label="Select row"
                                  />
                                </TableCell>

                                {safeVisibleColumns.notification ? (
                                  <TableCell>
                                    <div className="flex min-w-[280px] items-center gap-3">
                                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted">
                                        <Bell className="h-4 w-4" />
                                      </div>

                                      <div className="min-w-0">
                                        <p className="truncate font-medium">
                                          {item.title || "-"}
                                        </p>
                                        <p className="line-clamp-1 text-xs text-muted-foreground">
                                          {item.message || "-"}
                                        </p>
                                      </div>
                                    </div>
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.recipient ? (
                                  <TableCell>
                                    <div className="flex min-w-[210px] items-center gap-3">
                                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted">
                                        <UserRound className="h-4 w-4" />
                                      </div>

                                      <div className="min-w-0">
                                        <p className="truncate font-medium">
                                          {item.recipientName || "-"}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                          {item.recipientEmail ||
                                            item.recipientPhone ||
                                            "-"}
                                        </p>
                                      </div>
                                    </div>
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.channel ? (
                                  <TableCell>
                                    <Badge
                                      variant="secondary"
                                      className="rounded-full"
                                    >
                                      <ChannelIcon className="h-3.5 w-3.5" />
                                      {channelLabel(item.channel, locale)}
                                    </Badge>
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.severity ? (
                                  <TableCell>
                                    {severityBadge(item.severity, locale)}
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.status ? (
                                  <TableCell>
                                    {statusBadge(item.status, locale)}
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.event ? (
                                  <TableCell>
                                    <span className="whitespace-nowrap">
                                      {item.eventName || "-"}
                                    </span>
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.source ? (
                                  <TableCell>
                                    <span className="whitespace-nowrap">
                                      {item.source || "-"}
                                    </span>
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.sentAt ? (
                                  <TableCell>
                                    {formatDate(item.sentAt || item.createdAt)}
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.createdAt ? (
                                  <TableCell>
                                    {formatDate(item.createdAt)}
                                  </TableCell>
                                ) : null}

                                {safeVisibleColumns.actions ? (
                                  <TableCell>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          className="h-8 w-8 p-0"
                                        >
                                          <span className="sr-only">
                                            {t.actions}
                                          </span>
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>

                                      <DropdownMenuContent
                                        align={isArabic ? "start" : "end"}
                                      >
                                        <DropdownMenuLabel>
                                          {t.actions}
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />

                                        {isValidNotificationId(item.id) ? (
                                          <DropdownMenuItem asChild>
                                            <Link
                                              href={`/system/notifications/${item.id}`}
                                            >
                                              <Eye className="h-4 w-4" />
                                              {t.viewDetails}
                                            </Link>
                                          </DropdownMenuItem>
                                        ) : null}

                                        <DropdownMenuItem
                                          onClick={() =>
                                            copyToClipboard(
                                              String(item.id || "-"),
                                              t.copied,
                                            )
                                          }
                                        >
                                          <Copy className="h-4 w-4" />
                                          {t.copyId}
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                          onClick={() =>
                                            copyToClipboard(
                                              item.title || "-",
                                              t.copied,
                                            )
                                          }
                                        >
                                          <Copy className="h-4 w-4" />
                                          {t.copyTitle}
                                        </DropdownMenuItem>

                                        {item.recipientName ? (
                                          <DropdownMenuItem
                                            onClick={() =>
                                              copyToClipboard(
                                                item.recipientName,
                                                t.copied,
                                              )
                                            }
                                          >
                                            <UserRound className="h-4 w-4" />
                                            {t.copyRecipient}
                                          </DropdownMenuItem>
                                        ) : null}

                                        {item.recipientEmail ? (
                                          <DropdownMenuItem
                                            onClick={() =>
                                              copyToClipboard(
                                                item.recipientEmail,
                                                t.copied,
                                              )
                                            }
                                          >
                                            <Mail className="h-4 w-4" />
                                            {t.copyEmail}
                                          </DropdownMenuItem>
                                        ) : null}

                                        {item.recipientPhone ? (
                                          <DropdownMenuItem
                                            onClick={() =>
                                              copyToClipboard(
                                                item.recipientPhone,
                                                t.copied,
                                              )
                                            }
                                          >
                                            <Smartphone className="h-4 w-4" />
                                            {t.copyPhone}
                                          </DropdownMenuItem>
                                        ) : null}

                                        {item.message ? (
                                          <DropdownMenuItem
                                            onClick={() =>
                                              copyToClipboard(
                                                item.message,
                                                t.copied,
                                              )
                                            }
                                          >
                                            <Inbox className="h-4 w-4" />
                                            {t.copyMessage}
                                          </DropdownMenuItem>
                                        ) : null}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                ) : null}
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={visibleTableColumnsCount}
                              className="h-36 text-center"
                            >
                              <div className="mx-auto max-w-md space-y-2">
                                <p className="font-semibold">
                                  {hasSearchOrFilter
                                    ? t.noResultsTitle
                                    : t.emptyTitle}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {hasSearchOrFilter
                                    ? t.noResultsText
                                    : t.emptyText}
                                </p>

                                {hasSearchOrFilter ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2 rounded-xl"
                                    onClick={clearFilters}
                                  >
                                    {t.clearFilters}
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <div className="flex-1 text-sm text-muted-foreground">
                    {formatNumber(selectedIds.length)} /{" "}
                    {formatNumber(sortedNotifications.length)} {t.selectedRows}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {t.page} {formatNumber(pageIndex + 1)} {t.from}{" "}
                    {formatNumber(pageCount)}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() =>
                        setPageIndex((current) => Math.max(current - 1, 0))
                      }
                      disabled={pageIndex === 0}
                    >
                      {t.previous}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() =>
                        setPageIndex((current) =>
                          Math.min(current + 1, pageCount - 1),
                        )
                      }
                      disabled={pageIndex >= pageCount - 1}
                    >
                      {t.next}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

/* ============================================================
   Small Components
============================================================ */

function SortableHead({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <TableHead>
      <Button className="-ms-3" variant="ghost" onClick={onClick}>
        {label}
        <ArrowDownUp className="h-3 w-3" />
      </Button>
    </TableHead>
  );
}