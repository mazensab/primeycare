"use client";

/* ============================================================
   📂 app/system/notifications/[id]/page.tsx
   🧠 Primey Care | Notification Details
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ مبني بنفس نمط تفاصيل المراكز/العملاء المعتمد
   ✅ Side Profile Card + Main Content
   ✅ Error State مستقل عن Not Found
   ✅ Skeleton Loading
   ✅ Web PDF Print
   ✅ حماية روابط وأزرار الصفحة حسب الصلاحيات
   ✅ fallback آمن لـ system_admin / superadmin
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ استخدام toast من sonner
   ✅ بدون localhost hardcoded
   ✅ لا توجد روابط تقارير داخل الوحدة
   ✅ لا توجد نصوص تقنية ظاهرة في الواجهة
   ✅ الأرقام تبقى بالإنجليزية
============================================================ */

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  Eye,
  Hash,
  Inbox,
  Loader2,
  Mail,
  MessageCircle,
  Printer,
  RefreshCcw,
  Send,
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
import {
  Table,
  TableBody,
  TableCell,
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

type NotificationDetail = {
  id: number | string;
  title: string;
  subject: string;
  message: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  recipientId: string;
  status: NotificationStatus;
  severity: NotificationSeverity;
  channel: NotificationChannel;
  eventName: string;
  eventCode: string;
  source: string;
  reference: string;
  deliveryReference: string;
  externalReference: string;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
  readAt: string;
  sentAt: string;
  deliveredAt: string;
  failedAt: string;
  raw: Record<string, unknown>;
};

type NotificationDetailResponse = {
  ok?: boolean;
  message?: string;
  data?: unknown;
  notification?: unknown;
  item?: unknown;
};

const DETAIL_ENDPOINTS = ["/api/notifications", "/api/notifications/inbox"];

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
   API Helpers
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

function unwrapNotification(payload: unknown): Record<string, unknown> {
  const wrapper = (payload || {}) as NotificationDetailResponse;
  const value = wrapper.data || wrapper.notification || wrapper.item || payload || {};

  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return {};
}

function normalizeNotificationDetail(payload: unknown): NotificationDetail {
  const obj = unwrapNotification(payload);
  const recipient = obj.recipient as Record<string, unknown> | undefined;
  const user = obj.user as Record<string, unknown> | undefined;
  const event = obj.event as Record<string, unknown> | undefined;
  const delivery = obj.delivery as Record<string, unknown> | undefined;

  const id = getObjectValue(obj, "id") ?? "";

  const title = String(
    getObjectValue(obj, "title") ??
      getObjectValue(obj, "subject") ??
      getObjectValue(obj, "name") ??
      "-",
  );

  return {
    id: id as number | string,
    title,
    subject: String(getObjectValue(obj, "subject") ?? title),
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
    recipientId: String(
      getObjectValue(obj, "recipient_id") ??
        recipient?.id ??
        user?.id ??
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
    eventCode: String(
      getObjectValue(obj, "event_code") ??
        event?.code ??
        getObjectValue(obj, "event_type") ??
        "-",
    ),
    source: String(
      getObjectValue(obj, "source") ??
        getObjectValue(obj, "module") ??
        getObjectValue(obj, "category") ??
        "-",
    ),
    reference: String(
      getObjectValue(obj, "reference") ??
        getObjectValue(obj, "object_reference") ??
        "-",
    ),
    deliveryReference: String(
      getObjectValue(obj, "delivery_reference") ??
        delivery?.reference ??
        delivery?.id ??
        "-",
    ),
    externalReference: String(
      getObjectValue(obj, "external_reference") ??
        getObjectValue(obj, "provider_reference") ??
        delivery?.external_reference ??
        "-",
    ),
    errorMessage: String(
      getObjectValue(obj, "error_message") ??
        getObjectValue(obj, "failure_reason") ??
        delivery?.error_message ??
        "",
    ),
    createdAt: String(getObjectValue(obj, "created_at") ?? ""),
    updatedAt: String(getObjectValue(obj, "updated_at") ?? ""),
    readAt: String(getObjectValue(obj, "read_at") ?? ""),
    sentAt: String(
      getObjectValue(obj, "sent_at") ??
        getObjectValue(obj, "created_at") ??
        "",
    ),
    deliveredAt: String(
      getObjectValue(obj, "delivered_at") ?? delivery?.delivered_at ?? "",
    ),
    failedAt: String(getObjectValue(obj, "failed_at") ?? delivery?.failed_at ?? ""),
    raw: obj,
  };
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "تفاصيل الإشعار" : "Notification Details",
    subtitle: isArabic
      ? "عرض تفاصيل الإشعار، المستلم، القناة، الحالة، الأهمية، ومراجع التسليم."
      : "View notification details, recipient, channel, status, severity, and delivery references.",

    back: isArabic ? "مركز الإشعارات" : "Notifications Center",
    list: isArabic ? "قائمة الإشعارات" : "Notifications List",
    settings: isArabic ? "إعدادات الإشعارات" : "Notification Settings",
    refresh: isArabic ? "تحديث" : "Refresh",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    copy: isArabic ? "نسخ" : "Copy",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    overview: isArabic ? "نظرة عامة" : "Overview",
    overviewDesc: isArabic
      ? "بيانات الإشعار الأساسية والحالة التشغيلية."
      : "Basic notification data and operational status.",

    recipient: isArabic ? "بيانات المستلم" : "Recipient Information",
    recipientDesc: isArabic
      ? "بيانات المستلم المرتبط بالإشعار."
      : "Recipient data linked to the notification.",

    delivery: isArabic ? "بيانات الإرسال والتسليم" : "Delivery Information",
    deliveryDesc: isArabic
      ? "القناة والمراجع وحالة التسليم."
      : "Channel, references, and delivery state.",

    dates: isArabic ? "التواريخ" : "Dates",
    datesDesc: isArabic
      ? "تواريخ الإنشاء والإرسال والقراءة والتسليم."
      : "Creation, sending, reading, and delivery dates.",

    messageContent: isArabic ? "محتوى الإشعار" : "Notification Content",
    messageContentDesc: isArabic
      ? "العنوان والرسالة الكاملة للإشعار."
      : "The notification subject and full message.",

    quickInfo: isArabic ? "معلومات سريعة" : "Quick Info",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تفاصيل الإشعارات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view notification details. Contact your system administrator if you need access.",

    notFoundTitle: isArabic ? "الإشعار غير موجود" : "Notification not found",
    notFoundText: isArabic
      ? "لم يتم العثور على الإشعار المطلوب أو قد يكون غير متاح."
      : "The requested notification could not be found or may not be available.",

    loadError: isArabic
      ? "تعذر تحميل تفاصيل الإشعار."
      : "Unable to load notification details.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث تفاصيل الإشعار بنجاح."
      : "Notification details refreshed successfully.",
    printReady: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

    fields: {
      id: isArabic ? "المعرف" : "ID",
      title: isArabic ? "العنوان" : "Title",
      subject: isArabic ? "الموضوع" : "Subject",
      message: isArabic ? "الرسالة" : "Message",
      recipientName: isArabic ? "اسم المستلم" : "Recipient Name",
      recipientEmail: isArabic ? "بريد المستلم" : "Recipient Email",
      recipientPhone: isArabic ? "جوال المستلم" : "Recipient Phone",
      recipientId: isArabic ? "معرف المستلم" : "Recipient ID",
      status: isArabic ? "الحالة" : "Status",
      severity: isArabic ? "الأهمية" : "Severity",
      channel: isArabic ? "القناة" : "Channel",
      eventName: isArabic ? "الحدث" : "Event",
      eventCode: isArabic ? "رمز الحدث" : "Event Code",
      source: isArabic ? "المصدر" : "Source",
      reference: isArabic ? "المرجع" : "Reference",
      deliveryReference: isArabic ? "مرجع التسليم" : "Delivery Reference",
      externalReference: isArabic ? "المرجع الخارجي" : "External Reference",
      errorMessage: isArabic ? "رسالة الخطأ" : "Error Message",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isArabic ? "آخر تحديث" : "Updated At",
      readAt: isArabic ? "تاريخ القراءة" : "Read At",
      sentAt: isArabic ? "تاريخ الإرسال" : "Sent At",
      deliveredAt: isArabic ? "تاريخ التسليم" : "Delivered At",
      failedAt: isArabic ? "تاريخ الفشل" : "Failed At",
    },

    statuses: {
      UNREAD: isArabic ? "غير مقروء" : "Unread",
      READ: isArabic ? "مقروء" : "Read",
      SENT: isArabic ? "مرسل" : "Sent",
      FAILED: isArabic ? "فشل" : "Failed",
      PENDING: isArabic ? "بانتظار الإرسال" : "Pending",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<NotificationStatus, string>,

    severities: {
      SUCCESS: isArabic ? "نجاح" : "Success",
      INFO: isArabic ? "معلومة" : "Info",
      WARNING: isArabic ? "تنبيه" : "Warning",
      ERROR: isArabic ? "خطأ" : "Error",
      CRITICAL: isArabic ? "حرج" : "Critical",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<NotificationSeverity, string>,

    channels: {
      IN_APP: isArabic ? "داخل النظام" : "In-App",
      EMAIL: isArabic ? "البريد الإلكتروني" : "Email",
      WHATSAPP: isArabic ? "واتساب" : "WhatsApp",
      SMS: isArabic ? "رسالة SMS" : "SMS",
      SYSTEM: isArabic ? "النظام" : "System",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<NotificationChannel, string>,

    empty: isArabic ? "لا توجد بيانات" : "No data",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
  };
}

/* ============================================================
   UI Helpers
============================================================ */

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

function isValidId(id: unknown) {
  const value = String(id || "").trim();

  return value.length > 0 && value !== "-" && value !== "undefined";
}

function statusLabel(status: NotificationStatus, locale: AppLocale) {
  return dictionary(locale).statuses[status];
}

function severityLabel(severity: NotificationSeverity, locale: AppLocale) {
  return dictionary(locale).severities[severity];
}

function channelLabel(channel: NotificationChannel, locale: AppLocale) {
  return dictionary(locale).channels[channel];
}

function channelIcon(channel: NotificationChannel) {
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

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="space-y-4 p-5">
          <SkeletonLine className="h-16 w-16 rounded-2xl" />
          <SkeletonLine className="h-6 w-48" />
          <SkeletonLine className="h-4 w-32" />
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonLine key={index} className="h-10 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-3 p-5">
              <SkeletonLine className="h-5 w-40" />
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-4 w-3/4" />
              <SkeletonLine className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function copyToClipboard(value: string, successMessage: string) {
  if (!value || value === "-") return;

  navigator.clipboard.writeText(value);
  toast.success(successMessage);
}

function InfoRow({
  label,
  value,
  copyable,
  copiedMessage,
  children,
}: {
  label: string;
  value?: string;
  copyable?: boolean;
  copiedMessage: string;
  children?: ReactNode;
}) {
  const displayValue = value || "-";

  return (
    <TableRow>
      <TableCell className="w-[220px] text-muted-foreground">{label}</TableCell>
      <TableCell>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 break-words font-medium">
            {children || displayValue}
          </div>

          {copyable && displayValue !== "-" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg"
              onClick={() => copyToClipboard(displayValue, copiedMessage)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function QuickInfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-background p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-1 truncate text-sm font-semibold">{value || "-"}</div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="mt-2 text-lg font-bold">{value}</div>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function TextSection({
  label,
  value,
  empty,
}: {
  label: string;
  value: string;
  empty: string;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
        {value || empty}
      </p>
    </div>
  );
}

/* ============================================================
   Print
============================================================ */

function buildPrintHtml({
  locale,
  notification,
  t,
}: {
  locale: AppLocale;
  notification: NotificationDetail;
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const rows: Array<[string, string]> = [
    [t.fields.id, String(notification.id)],
    [t.fields.title, notification.title],
    [t.fields.recipientName, notification.recipientName],
    [t.fields.recipientEmail, notification.recipientEmail || "-"],
    [t.fields.recipientPhone, notification.recipientPhone || "-"],
    [t.fields.channel, channelLabel(notification.channel, locale)],
    [t.fields.severity, severityLabel(notification.severity, locale)],
    [t.fields.status, statusLabel(notification.status, locale)],
    [t.fields.eventName, notification.eventName],
    [t.fields.source, notification.source],
    [t.fields.reference, notification.reference],
    [t.fields.deliveryReference, notification.deliveryReference],
    [t.fields.externalReference, notification.externalReference],
    [t.fields.sentAt, formatDate(notification.sentAt)],
    [t.fields.readAt, formatDate(notification.readAt)],
    [t.fields.deliveredAt, formatDate(notification.deliveredAt)],
    [t.fields.failedAt, formatDate(notification.failedAt)],
    [t.fields.createdAt, formatDate(notification.createdAt)],
  ];

  return `
    <!doctype html>
    <html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(t.title)}</title>
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
            gap: 16px;
            align-items: flex-start;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 14px;
            margin-bottom: 18px;
          }
          h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 800;
          }
          .meta {
            margin-top: 8px;
            font-size: 12px;
            line-height: 1.8;
            color: #6b7280;
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
            margin-bottom: 18px;
          }
          th,
          td {
            border: 1px solid #e5e7eb;
            padding: 9px 8px;
            text-align: ${isArabic ? "right" : "left"};
            vertical-align: top;
          }
          th {
            width: 220px;
            background: #f3f4f6;
            color: #111827;
            font-weight: 700;
          }
          .section-title {
            margin: 18px 0 8px;
            font-size: 16px;
            font-weight: 800;
          }
          .text-block {
            border: 1px solid #e5e7eb;
            padding: 12px;
            border-radius: 12px;
            line-height: 1.8;
            white-space: pre-wrap;
          }
          @page {
            size: A4;
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
            <h1>${escapeHtml(notification.title)}</h1>
            <div class="meta">
              <div>${escapeHtml(t.fields.recipientName)}: ${escapeHtml(notification.recipientName || "-")}</div>
              <div>${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <table>
          <tbody>
            ${rows
              .map(
                ([label, value]) => `
                  <tr>
                    <th>${escapeHtml(label)}</th>
                    <td>${escapeHtml(value || "-")}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>

        <div class="section-title">${escapeHtml(t.fields.message)}</div>
        <div class="text-block">${escapeHtml(notification.message || "-")}</div>

        ${
          notification.errorMessage
            ? `<div class="section-title">${escapeHtml(t.fields.errorMessage)}</div>
               <div class="text-block">${escapeHtml(notification.errorMessage)}</div>`
            : ""
        }

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

export default function SystemNotificationDetailsPage() {
  const params = useParams();
  const auth = useAuth() as unknown;

  const notificationId = String(params?.id || "");

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [notification, setNotification] = useState<NotificationDetail | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [notFound, setNotFound] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canViewNotifications = hasSafePermission(
    auth,
    ["notifications.view", "notifications.detail", "notifications.list"],
    "view",
  );

  const canViewNotificationsList = hasSafePermission(
    auth,
    ["notifications.view", "notifications.list"],
    "view",
  );

  const canPrintNotifications = hasSafePermission(
    auth,
    ["notifications.print", "reports.print"],
    "action",
  );

  const canManageSettings = hasSafePermission(
    auth,
    ["notifications.settings", "notifications.manage"],
    "action",
  );

  const loadNotification = useCallback(
    async (showToast = false) => {
      if (!canViewNotifications) {
        setIsLoading(false);
        setNotification(null);
        return;
      }

      if (!isValidId(notificationId)) {
        setIsLoading(false);
        setNotification(null);
        setNotFound(true);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        setNotFound(false);

        let loadedPayload: NotificationDetailResponse | null = null;
        let loaded = false;
        let found404 = false;

        for (const endpoint of DETAIL_ENDPOINTS) {
          const response = await fetch(
            apiUrl(`${endpoint}/${encodeURIComponent(notificationId)}/`),
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
              headers: {
                Accept: "application/json",
              },
            },
          );

          const payload = (await response.json().catch(() => null)) as
            | NotificationDetailResponse
            | null;

          if (response.status === 404) {
            found404 = true;
            loadedPayload = payload;
            continue;
          }

          if (response.status === 405) {
            loadedPayload = payload;
            continue;
          }

          if (!response.ok || payload?.ok === false) {
            throw new Error(payload?.message || `HTTP ${response.status}`);
          }

          loadedPayload = payload;
          loaded = true;
          break;
        }

        if (!loaded) {
          if (found404) {
            setNotification(null);
            setNotFound(true);
            return;
          }

          throw new Error(loadedPayload?.message || "Unable to load");
        }

        const normalized = normalizeNotificationDetail(loadedPayload);

        if (!isValidId(normalized.id)) {
          setNotification(null);
          setNotFound(true);
          return;
        }

        setNotification(normalized);

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load notification details:", error);
        setNotification(null);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewNotifications, notificationId, t.loadError, t.refreshSuccess],
  );

  function printNotification() {
    if (!canPrintNotifications || !notification) return;

    const printWindow = window.open("", "_blank", "width=1000,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        locale,
        notification,
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
    loadNotification(false);
  }, [authResolving, loadNotification]);

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
            {notification?.title || t.title}
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
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

          {canViewNotificationsList ? (
            <Link href="/system/notifications/list">
              <Button
                variant="outline"
                className="h-10 w-full rounded-xl sm:w-auto"
              >
                <ClipboardList className="h-4 w-4" />
                <span>{t.list}</span>
              </Button>
            </Link>
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

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadNotification(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canPrintNotifications && notification ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printNotification}
              disabled={isLoading || Boolean(errorMessage) || notFound}
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
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
                <p className="font-semibold text-destructive">{errorMessage}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.loadErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadNotification(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Not Found */}
      {!isLoading && !errorMessage && notFound ? (
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Bell className="h-7 w-7 text-muted-foreground" />
            </div>

            <div>
              <p className="text-lg font-semibold">{t.notFoundTitle}</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {t.notFoundText}
              </p>
            </div>

            {canViewNotificationsList ? (
              <Link href="/system/notifications/list">
                <Button className="mt-2 rounded-xl">
                  <ClipboardList className="h-4 w-4" />
                  {t.list}
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? <DetailSkeleton /> : null}

      {!isLoading && !errorMessage && notification && !notFound ? (
        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          {/* Side Profile */}
          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="space-y-5 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border bg-muted">
                    <Bell className="h-8 w-8" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold">
                      {notification.title}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {notification.recipientName || "-"}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {statusBadge(notification.status, locale)}
                      {severityBadge(notification.severity, locale)}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.fields.channel}
                  </p>

                  <div className="mt-2 flex items-center gap-2 text-lg font-bold">
                    {(() => {
                      const ChannelIcon = channelIcon(notification.channel);
                      return <ChannelIcon className="h-5 w-5" />;
                    })()}
                    <span>{channelLabel(notification.channel, locale)}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full">
                      {notification.eventName || "-"}
                    </Badge>
                    <Badge variant="outline" className="rounded-full">
                      {notification.source || "-"}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() => copyToClipboard(notification.title, t.copied)}
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy} {t.fields.title}
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() =>
                      copyToClipboard(String(notification.id), t.copied)
                    }
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy} {t.fields.id}
                  </Button>

                  {notification.message ? (
                    <Button
                      variant="outline"
                      className="justify-start rounded-xl"
                      onClick={() =>
                        copyToClipboard(notification.message, t.copied)
                      }
                    >
                      <Copy className="h-4 w-4" />
                      {t.copy} {t.fields.message}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">
                  {t.quickInfo}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <QuickInfoItem
                  icon={UserRound}
                  label={t.fields.recipientName}
                  value={notification.recipientName || "-"}
                />

                <QuickInfoItem
                  icon={Mail}
                  label={t.fields.recipientEmail}
                  value={notification.recipientEmail || "-"}
                />

                <QuickInfoItem
                  icon={CalendarDays}
                  label={t.fields.sentAt}
                  value={formatDate(notification.sentAt || notification.createdAt)}
                />

                <QuickInfoItem
                  icon={CheckCircle2}
                  label={t.fields.readAt}
                  value={formatDate(notification.readAt)}
                />
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="space-y-4">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Eye className="h-4 w-4" />
                  {t.overview}
                </CardTitle>
                <CardDescription>{t.overviewDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableBody>
                      <InfoRow
                        label={t.fields.id}
                        value={String(notification.id)}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.title}
                        value={notification.title}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.subject}
                        value={notification.subject}
                        copyable={Boolean(notification.subject)}
                        copiedMessage={t.copied}
                      />
                      <TableRow>
                        <TableCell className="w-[220px] text-muted-foreground">
                          {t.fields.status}
                        </TableCell>
                        <TableCell>
                          {statusBadge(notification.status, locale)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="w-[220px] text-muted-foreground">
                          {t.fields.severity}
                        </TableCell>
                        <TableCell>
                          {severityBadge(notification.severity, locale)}
                        </TableCell>
                      </TableRow>
                      <InfoRow
                        label={t.fields.createdAt}
                        value={formatDate(notification.createdAt)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.updatedAt}
                        value={formatDate(
                          notification.updatedAt || notification.createdAt,
                        )}
                        copiedMessage={t.copied}
                      />
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <UserRound className="h-4 w-4" />
                  {t.recipient}
                </CardTitle>
                <CardDescription>{t.recipientDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableBody>
                      <InfoRow
                        label={t.fields.recipientName}
                        value={notification.recipientName || "-"}
                        copyable={Boolean(notification.recipientName)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.recipientEmail}
                        value={notification.recipientEmail || "-"}
                        copyable={Boolean(notification.recipientEmail)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.recipientPhone}
                        value={notification.recipientPhone || "-"}
                        copyable={Boolean(notification.recipientPhone)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.recipientId}
                        value={notification.recipientId || "-"}
                        copyable={Boolean(notification.recipientId)}
                        copiedMessage={t.copied}
                      />
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Send className="h-4 w-4" />
                  {t.delivery}
                </CardTitle>
                <CardDescription>{t.deliveryDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <MetricCard
                    icon={channelIcon(notification.channel)}
                    label={t.fields.channel}
                    value={channelLabel(notification.channel, locale)}
                  />
                  <MetricCard
                    icon={ShieldCheck}
                    label={t.fields.eventName}
                    value={notification.eventName || "-"}
                  />
                  <MetricCard
                    icon={Inbox}
                    label={t.fields.source}
                    value={notification.source || "-"}
                  />
                  <MetricCard
                    icon={Hash}
                    label={t.fields.reference}
                    value={notification.reference || "-"}
                  />
                  <MetricCard
                    icon={Hash}
                    label={t.fields.deliveryReference}
                    value={notification.deliveryReference || "-"}
                  />
                  <MetricCard
                    icon={Hash}
                    label={t.fields.externalReference}
                    value={notification.externalReference || "-"}
                  />
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border">
                  <Table>
                    <TableBody>
                      <InfoRow
                        label={t.fields.eventCode}
                        value={notification.eventCode}
                        copyable={notification.eventCode !== "-"}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.reference}
                        value={notification.reference}
                        copyable={notification.reference !== "-"}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.deliveryReference}
                        value={notification.deliveryReference}
                        copyable={notification.deliveryReference !== "-"}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.externalReference}
                        value={notification.externalReference}
                        copyable={notification.externalReference !== "-"}
                        copiedMessage={t.copied}
                      />
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <CalendarDays className="h-4 w-4" />
                  {t.dates}
                </CardTitle>
                <CardDescription>{t.datesDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={CalendarDays}
                  label={t.fields.sentAt}
                  value={formatDate(notification.sentAt)}
                />
                <MetricCard
                  icon={CheckCircle2}
                  label={t.fields.readAt}
                  value={formatDate(notification.readAt)}
                />
                <MetricCard
                  icon={Send}
                  label={t.fields.deliveredAt}
                  value={formatDate(notification.deliveredAt)}
                />
                <MetricCard
                  icon={AlertTriangle}
                  label={t.fields.failedAt}
                  value={formatDate(notification.failedAt)}
                />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Mail className="h-4 w-4" />
                  {t.messageContent}
                </CardTitle>
                <CardDescription>{t.messageContentDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <TextSection
                  label={t.fields.subject}
                  value={notification.subject}
                  empty={t.empty}
                />

                <TextSection
                  label={t.fields.message}
                  value={notification.message}
                  empty={t.empty}
                />

                {notification.errorMessage ? (
                  <TextSection
                    label={t.fields.errorMessage}
                    value={notification.errorMessage}
                    empty={t.empty}
                  />
                ) : null}
              </CardContent>
            </Card>
          </main>
        </div>
      ) : null}
    </div>
  );
}