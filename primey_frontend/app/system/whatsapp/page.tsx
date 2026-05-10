"use client";

/* ============================================================
   📂 app/system/whatsapp/page.tsx
   🧠 Primey Care | WhatsApp Overview

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
  BellRing,
  ClipboardList,
  Download,
  FileText,
  Inbox,
  Loader2,
  Megaphone,
  MessageCircle,
  Printer,
  RefreshCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Wifi,
  WifiOff,
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

type WhatsAppStatus = "CONNECTED" | "DISCONNECTED" | "ERROR" | "PENDING" | "UNKNOWN";
type DeliveryStatus = "SENT" | "DELIVERED" | "READ" | "FAILED" | "PENDING" | "UNKNOWN";
type TemplateStatus = "APPROVED" | "PENDING" | "REJECTED" | "DRAFT" | "UNKNOWN";

type WhatsAppLogRow = {
  id: string;
  recipient_name: string;
  recipient_phone: string;
  message_body: string;
  template_name: string;
  event_code: string;
  status: DeliveryStatus;
  provider_status: string;
  error_message: string;
  created_at: string;
};

type WhatsAppTemplateRow = {
  id: string;
  template_name: string;
  template_key: string;
  event_code: string;
  language_code: string;
  status: TemplateStatus;
  is_active: boolean;
  created_at: string;
};

type WhatsAppSummary = {
  connected: boolean;
  configured: boolean;
  total_logs: number;
  sent_logs: number;
  delivered_logs: number;
  read_logs: number;
  failed_logs: number;
  pending_logs: number;
  total_templates: number;
  active_templates: number;
  approved_templates: number;
  pending_templates: number;
  total_broadcasts: number;
  total_conversations: number;
  unread_conversations: number;
  unread_messages: number;
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
  logs?: unknown[];
  templates?: unknown[];
  broadcasts?: unknown[];
  conversations?: unknown[];
  summary?: Partial<WhatsAppSummary>;
  stats?: Partial<WhatsAppSummary>;
};

const DEFAULT_SUMMARY: WhatsAppSummary = {
  connected: false,
  configured: false,
  total_logs: 0,
  sent_logs: 0,
  delivered_logs: 0,
  read_logs: 0,
  failed_logs: 0,
  pending_logs: 0,
  total_templates: 0,
  active_templates: 0,
  approved_templates: 0,
  pending_templates: 0,
  total_broadcasts: 0,
  total_conversations: 0,
  unread_conversations: 0,
  unread_messages: 0,
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
    title: isArabic ? "واتساب" : "WhatsApp",
    subtitle: isArabic
      ? "لوحة متابعة مركز واتساب والمحادثات والقوالب والسجلات والبث الجماعي."
      : "Overview for WhatsApp center, inbox, templates, logs, and broadcasts.",

    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    inbox: isArabic ? "صندوق المحادثات" : "Inbox",
    logs: isArabic ? "سجلات واتساب" : "WhatsApp Logs",
    templates: isArabic ? "قوالب واتساب" : "WhatsApp Templates",
    broadcasts: isArabic ? "البث الجماعي" : "Broadcasts",
    settings: isArabic ? "إعدادات واتساب" : "WhatsApp Settings",

    connected: isArabic ? "متصل" : "Connected",
    disconnected: isArabic ? "غير متصل" : "Disconnected",
    configured: isArabic ? "مهيأ" : "Configured",
    notConfigured: isArabic ? "غير مهيأ" : "Not Configured",

    totalLogs: isArabic ? "إجمالي الرسائل" : "Total Messages",
    sentLogs: isArabic ? "مرسلة" : "Sent",
    deliveredLogs: isArabic ? "تم التسليم" : "Delivered",
    readLogs: isArabic ? "مقروءة" : "Read",
    failedLogs: isArabic ? "فاشلة" : "Failed",
    pendingLogs: isArabic ? "قيد الانتظار" : "Pending",
    totalTemplates: isArabic ? "القوالب" : "Templates",
    activeTemplates: isArabic ? "قوالب نشطة" : "Active Templates",
    approvedTemplates: isArabic ? "قوالب معتمدة" : "Approved Templates",
    totalBroadcasts: isArabic ? "عمليات البث" : "Broadcasts",
    totalConversations: isArabic ? "المحادثات" : "Conversations",
    unreadConversations: isArabic ? "محادثات غير مقروءة" : "Unread Conversations",
    unreadMessages: isArabic ? "رسائل غير مقروءة" : "Unread Messages",

    shortcutsTitle: isArabic ? "اختصارات واتساب" : "WhatsApp Shortcuts",
    shortcutsDesc: isArabic
      ? "الوصول السريع للصفحات التي أزلناها من السايدر بعد تنظيف قسم التواصل."
      : "Quick access to pages removed from the sidebar after communication cleanup.",

    latestLogsTitle: isArabic ? "أحدث سجلات واتساب" : "Latest WhatsApp Logs",
    latestLogsDesc: isArabic
      ? "آخر الرسائل وحالة الإرسال والمستلم."
      : "Latest messages with delivery status and recipient.",

    searchPlaceholder: isArabic
      ? "ابحث في سجلات واتساب بالاسم أو الجوال أو الرسالة أو القالب..."
      : "Search WhatsApp logs by name, phone, message, or template...",

    table: {
      message: isArabic ? "الرسالة" : "Message",
      recipient: isArabic ? "المستلم" : "Recipient",
      template: isArabic ? "القالب" : "Template",
      event: isArabic ? "الحدث" : "Event",
      status: isArabic ? "الحالة" : "Status",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
    },

    sent: isArabic ? "مرسل" : "Sent",
    delivered: isArabic ? "تم التسليم" : "Delivered",
    read: isArabic ? "مقروء" : "Read",
    failed: isArabic ? "فشل" : "Failed",
    pending: isArabic ? "قيد الانتظار" : "Pending",
    unknown: isArabic ? "غير محدد" : "Unknown",

    approved: isArabic ? "معتمد" : "Approved",
    rejected: isArabic ? "مرفوض" : "Rejected",
    draft: isArabic ? "مسودة" : "Draft",

    open: isArabic ? "فتح" : "Open",

    emptyTitle: isArabic ? "لا توجد سجلات واتساب" : "No WhatsApp logs",
    emptyText: isArabic
      ? "ستظهر سجلات واتساب هنا بعد إرسال أول رسالة."
      : "WhatsApp logs will appear here after sending the first message.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث."
      : "Try changing your search terms.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض واتساب" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض مركز واتساب. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view WhatsApp center. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل بيانات واتساب."
      : "Unable to load WhatsApp data.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث بيانات واتساب."
      : "WhatsApp data refreshed.",

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

  for (const container of ["log", "message", "template", "data", "payload"]) {
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
  if (Array.isArray(payload.logs)) return payload.logs;
  if (Array.isArray(payload.templates)) return payload.templates;
  if (Array.isArray(payload.broadcasts)) return payload.broadcasts;
  if (Array.isArray(payload.conversations)) return payload.conversations;

  if (Array.isArray(data[key])) return data[key] as unknown[];
  if (Array.isArray(data.results)) return data.results as unknown[];
  if (Array.isArray(data.items)) return data.items as unknown[];
  if (Array.isArray(data.rows)) return data.rows as unknown[];
  if (Array.isArray(data.logs)) return data.logs as unknown[];
  if (Array.isArray(data.templates)) return data.templates as unknown[];
  if (Array.isArray(data.broadcasts)) return data.broadcasts as unknown[];
  if (Array.isArray(data.conversations)) return data.conversations as unknown[];

  if (Array.isArray(payload.data)) return payload.data;

  return [];
}

function normalizeDeliveryStatus(value: unknown): DeliveryStatus {
  const clean = String(value || "").toUpperCase();

  if (["SENT", "SENDING"].includes(clean)) return "SENT";
  if (["DELIVERED"].includes(clean)) return "DELIVERED";
  if (["READ", "SEEN"].includes(clean)) return "READ";
  if (["FAILED", "ERROR"].includes(clean)) return "FAILED";
  if (["PENDING", "QUEUED", "WAITING"].includes(clean)) return "PENDING";

  return "UNKNOWN";
}

function normalizeTemplateStatus(value: unknown): TemplateStatus {
  const clean = String(value || "").toUpperCase();

  if (["APPROVED", "ACTIVE"].includes(clean)) return "APPROVED";
  if (["PENDING", "SUBMITTED"].includes(clean)) return "PENDING";
  if (["REJECTED", "FAILED"].includes(clean)) return "REJECTED";
  if (["DRAFT", "NEW"].includes(clean)) return "DRAFT";

  return "UNKNOWN";
}

function normalizeWhatsAppStatus(payload: ApiEnvelope<unknown> | null): WhatsAppStatus {
  const data = asDict(payload?.data);
  const merged = {
    ...data,
    ...asDict(payload),
  };

  const connected = Boolean(
    merged.connected ||
      merged.is_connected ||
      merged.session_connected ||
      String(merged.session_status || "").toLowerCase() === "connected",
  );

  const hasError = Boolean(merged.last_error_message || merged.error_message);

  if (connected) return "CONNECTED";
  if (hasError) return "ERROR";

  const sessionStatus = String(merged.session_status || merged.status || "").toUpperCase();

  if (["PENDING", "CONNECTING", "WAITING"].includes(sessionStatus)) {
    return "PENDING";
  }

  if (["DISCONNECTED", "OFFLINE", "INACTIVE"].includes(sessionStatus)) {
    return "DISCONNECTED";
  }

  return "UNKNOWN";
}

function normalizeLog(item: unknown, index: number): WhatsAppLogRow {
  const obj = asDict(item);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    recipient_name: String(
      getNestedValue(obj, ["recipient_name", "customer_name", "name"]) || "",
    ),
    recipient_phone: String(
      getNestedValue(obj, ["recipient_phone", "phone", "mobile"]) || "",
    ),
    message_body: String(
      getNestedValue(obj, ["message_body", "body", "content", "payload_summary"]) || "",
    ),
    template_name: String(
      getNestedValue(obj, ["template_name", "template_key", "template"]) || "",
    ),
    event_code: String(getNestedValue(obj, ["event_code", "event", "trigger_source"]) || ""),
    status: normalizeDeliveryStatus(
      getNestedValue(obj, ["delivery_status", "provider_status", "status"]),
    ),
    provider_status: String(
      getNestedValue(obj, ["provider_status", "gateway_status"]) || "",
    ),
    error_message: String(
      getNestedValue(obj, ["error_message", "failure_reason", "last_error"]) || "",
    ),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
  };
}

function normalizeTemplate(item: unknown, index: number): WhatsAppTemplateRow {
  const obj = asDict(item);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    template_name: String(
      getNestedValue(obj, ["template_name", "name", "title"]) || "-",
    ),
    template_key: String(
      getNestedValue(obj, ["template_key", "key", "code"]) || "",
    ),
    event_code: String(getNestedValue(obj, ["event_code", "event"]) || ""),
    language_code: String(
      getNestedValue(obj, ["language_code", "language"]) || "",
    ),
    status: normalizeTemplateStatus(
      getNestedValue(obj, ["approval_status", "provider_status", "status"]),
    ),
    is_active: Boolean(getNestedValue(obj, ["is_active", "active"]) ?? false),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
  };
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
  };
}

function buildSummary({
  statusPayload,
  logs,
  templates,
  broadcastsCount,
  inboxSummary,
}: {
  statusPayload: ApiEnvelope<unknown> | null;
  logs: WhatsAppLogRow[];
  templates: WhatsAppTemplateRow[];
  broadcastsCount: number;
  inboxSummary: Dict;
}): WhatsAppSummary {
  const statusData = {
    ...asDict(statusPayload?.data),
    ...asDict(statusPayload),
  };

  const apiInbox = asDict(inboxSummary);

  const connectedStatus = normalizeWhatsAppStatus(statusPayload);
  const configured = Boolean(
    statusData.configured ||
      statusData.is_enabled ||
      statusData.is_active ||
      statusData.phone_number_id ||
      statusData.connected_phone,
  );

  return {
    connected: connectedStatus === "CONNECTED",
    configured,
    total_logs: logs.length,
    sent_logs: logs.filter((item) => item.status === "SENT").length,
    delivered_logs: logs.filter((item) => item.status === "DELIVERED").length,
    read_logs: logs.filter((item) => item.status === "READ").length,
    failed_logs: logs.filter((item) => item.status === "FAILED").length,
    pending_logs: logs.filter((item) => item.status === "PENDING").length,
    total_templates: templates.length,
    active_templates: templates.filter((item) => item.is_active).length,
    approved_templates: templates.filter((item) => item.status === "APPROVED").length,
    pending_templates: templates.filter((item) => item.status === "PENDING").length,
    total_broadcasts: broadcastsCount,
    total_conversations: toNumber(
      apiInbox.total_conversations || apiInbox.conversations_count,
    ),
    unread_conversations: toNumber(
      apiInbox.unread_conversations || apiInbox.unread_conversations_count,
    ),
    unread_messages: toNumber(
      apiInbox.unread_messages || apiInbox.unread_messages_count,
    ),
  };
}

function statusLabel(status: DeliveryStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<DeliveryStatus, string> = {
    SENT: t.sent,
    DELIVERED: t.delivered,
    READ: t.read,
    FAILED: t.failed,
    PENDING: t.pending,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function templateStatusLabel(status: TemplateStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<TemplateStatus, string> = {
    APPROVED: t.approved,
    PENDING: t.pending,
    REJECTED: t.rejected,
    DRAFT: t.draft,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function statusBadge(status: DeliveryStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

  if (status === "SENT" || status === "DELIVERED" || status === "READ") {
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
        <CardContent className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
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
  summary: WhatsAppSummary;
  rows: WhatsAppLogRow[];
}) {
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";
  const t = dictionary(locale);

  const rowsHtml = rows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.recipient_name || "-")}</td>
          <td>${escapeHtml(item.recipient_phone || "-")}</td>
          <td>${escapeHtml(item.template_name || "-")}</td>
          <td>${escapeHtml(item.event_code || "-")}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(item.message_body || "-")}</td>
          <td>${escapeHtml(item.error_message || "-")}</td>
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
          <tr><td class="summary-label">${escapeHtml(t.totalLogs)}</td><td colspan="7">${escapeHtml(formatNumber(summary.total_logs))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.deliveredLogs)}</td><td colspan="7">${escapeHtml(formatNumber(summary.delivered_logs))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.failedLogs)}</td><td colspan="7">${escapeHtml(formatNumber(summary.failed_logs))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalTemplates)}</td><td colspan="7">${escapeHtml(formatNumber(summary.total_templates))}</td></tr>

          <tr><td colspan="8"></td></tr>
          <tr>
            <th>${escapeHtml(t.table.recipient)}</th>
            <th>${escapeHtml("Phone")}</th>
            <th>${escapeHtml(t.table.template)}</th>
            <th>${escapeHtml(t.table.event)}</th>
            <th>${escapeHtml(t.table.status)}</th>
            <th>${escapeHtml(t.table.message)}</th>
            <th>${escapeHtml("Error")}</th>
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
  summary: WhatsAppSummary;
  rows: WhatsAppLogRow[];
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);

  const tableRows = rows
    .slice(0, 40)
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.recipient_name || "-")}</td>
          <td>${escapeHtml(item.recipient_phone || "-")}</td>
          <td>${escapeHtml(item.template_name || "-")}</td>
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
          <div class="box"><span>${escapeHtml(t.totalLogs)}</span><strong>${escapeHtml(formatNumber(summary.total_logs))}</strong></div>
          <div class="box"><span>${escapeHtml(t.deliveredLogs)}</span><strong>${escapeHtml(formatNumber(summary.delivered_logs))}</strong></div>
          <div class="box"><span>${escapeHtml(t.failedLogs)}</span><strong>${escapeHtml(formatNumber(summary.failed_logs))}</strong></div>
          <div class="box"><span>${escapeHtml(t.totalTemplates)}</span><strong>${escapeHtml(formatNumber(summary.total_templates))}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t.table.recipient)}</th>
              <th>${escapeHtml("Phone")}</th>
              <th>${escapeHtml(t.table.template)}</th>
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

export default function SystemWhatsAppPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<WhatsAppLogRow[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplateRow[]>([]);
  const [summary, setSummary] = useState<WhatsAppSummary>(DEFAULT_SUMMARY);
  const [query, setQuery] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<WhatsAppStatus>("UNKNOWN");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasAnyPermission(
    auth,
    ["whatsapp.view", "whatsapp.logs.view", "system.view"],
    "view",
  );

  const canViewInbox = hasAnyPermission(
    auth,
    ["whatsapp.view", "whatsapp.inbox.view"],
    "view",
  );

  const canViewLogs = hasAnyPermission(
    auth,
    ["whatsapp.view", "whatsapp.logs.view"],
    "view",
  );

  const canViewTemplates = hasAnyPermission(
    auth,
    ["whatsapp.view", "whatsapp.templates.view"],
    "view",
  );

  const canViewBroadcasts = hasAnyPermission(
    auth,
    ["whatsapp.view", "whatsapp.broadcasts.view"],
    "view",
  );

  const canViewSettings = hasAnyPermission(
    auth,
    ["whatsapp.settings", "whatsapp.settings.view", "system.settings"],
    "view",
  );

  const canExport = hasAnyPermission(
    auth,
    ["whatsapp.export", "reports.export"],
    "action",
  );

  const canPrint = hasAnyPermission(
    auth,
    ["whatsapp.print", "reports.print"],
    "action",
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
          item.recipient_name,
          item.recipient_phone,
          item.message_body,
          item.template_name,
          item.event_code,
          item.provider_status,
          item.error_message,
          statusLabel(item.status, locale),
        ]
          .join(" ")
          .toLowerCase()
          .includes(clean),
      )
      .slice(0, 12);
  }, [locale, query, rows]);

  const activeSummary = useMemo(
    () => ({
      ...summary,
      total_logs: filteredRows.length,
      sent_logs: filteredRows.filter((item) => item.status === "SENT").length,
      delivered_logs: filteredRows.filter((item) => item.status === "DELIVERED").length,
      read_logs: filteredRows.filter((item) => item.status === "READ").length,
      failed_logs: filteredRows.filter((item) => item.status === "FAILED").length,
      pending_logs: filteredRows.filter((item) => item.status === "PENDING").length,
    }),
    [filteredRows, summary],
  );

  const displaySummary = query.trim() ? activeSummary : summary;
  const hasData = rows.length > 0;
  const hasSearch = query.trim().length > 0;

  const loadWhatsApp = useCallback(
    async (showToast = false) => {
      if (!canView) {
        setRows([]);
        setTemplates([]);
        setSummary(DEFAULT_SUMMARY);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const [statusPayload, logsPayload, templatesPayload, broadcastsPayload, inboxPayload] =
          await Promise.all([
            safeGet("/api/whatsapp/status/"),
            safeGet("/api/whatsapp/logs/?page_size=500"),
            safeGet("/api/whatsapp/templates/?page_size=500"),
            safeGet("/api/whatsapp/broadcasts/?page_size=500"),
            safeGet("/api/whatsapp/inbox/summary/"),
          ]);

        const normalizedLogs = extractRows(logsPayload, "logs")
          .map(normalizeLog)
          .filter((item) => item.id || item.recipient_phone || item.message_body);

        const normalizedTemplates = extractRows(templatesPayload, "templates")
          .map(normalizeTemplate)
          .filter((item) => item.id || item.template_name);

        const broadcastsCount =
          extractRows(broadcastsPayload, "broadcasts").length ||
          toNumber(extractSummary(broadcastsPayload).broadcasts_count) ||
          toNumber(extractSummary(broadcastsPayload).total_broadcasts);

        const inboxSummary = extractSummary(inboxPayload);

        setRows(normalizedLogs);
        setTemplates(normalizedTemplates);
        setConnectionStatus(normalizeWhatsAppStatus(statusPayload));
        setSummary(
          buildSummary({
            statusPayload,
            logs: normalizedLogs,
            templates: normalizedTemplates,
            broadcastsCount,
            inboxSummary,
          }),
        );

        if (showToast) toast.success(t.loadSuccess);
      } catch (error) {
        console.error("WhatsApp overview load error:", error);
        setRows([]);
        setTemplates([]);
        setSummary(DEFAULT_SUMMARY);
        setConnectionStatus("UNKNOWN");
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
      filename: `primey-care-whatsapp-${new Date().toISOString().slice(0, 10)}.xls`,
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
    loadWhatsApp(false);
  }, [authResolving, loadWhatsApp]);

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
            onClick={() => loadWhatsApp(true)}
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
              onClick={() => loadWhatsApp(true)}
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
              title={connectionStatus === "CONNECTED" ? t.connected : t.disconnected}
              value={connectionStatus === "CONNECTED" ? t.connected : t.disconnected}
              icon={connectionStatus === "CONNECTED" ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
            />
            <KpiCard
              title={t.totalLogs}
              value={formatNumber(displaySummary.total_logs)}
              icon={<MessageCircle className="h-5 w-5" />}
            />
            <KpiCard
              title={t.deliveredLogs}
              value={formatNumber(displaySummary.delivered_logs)}
              icon={<BadgeCheck className="h-5 w-5" />}
            />
            <KpiCard
              title={t.failedLogs}
              value={formatNumber(displaySummary.failed_logs)}
              icon={<XCircle className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MiniStat title={t.totalTemplates} value={displaySummary.total_templates} />
            <MiniStat title={t.activeTemplates} value={displaySummary.active_templates} />
            <MiniStat title={t.totalConversations} value={displaySummary.total_conversations} />
            <MiniStat title={t.unreadMessages} value={displaySummary.unread_messages} />
          </div>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">
                {t.shortcutsTitle}
              </CardTitle>
              <CardDescription>{t.shortcutsDesc}</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {canViewInbox ? (
                  <ShortcutCard
                    href="/system/whatsapp/inbox"
                    icon={<Inbox className="h-5 w-5" />}
                    title={t.inbox}
                    description={
                      isArabic
                        ? "فتح صندوق محادثات واتساب ومتابعة الرسائل."
                        : "Open WhatsApp inbox and conversations."
                    }
                  />
                ) : null}

                {canViewLogs ? (
                  <ShortcutCard
                    href="/system/whatsapp/logs"
                    icon={<FileText className="h-5 w-5" />}
                    title={t.logs}
                    description={
                      isArabic
                        ? "عرض سجلات الإرسال وحالات الرسائل."
                        : "View sending logs and message statuses."
                    }
                  />
                ) : null}

                {canViewTemplates ? (
                  <ShortcutCard
                    href="/system/whatsapp/templates"
                    icon={<ClipboardList className="h-5 w-5" />}
                    title={t.templates}
                    description={
                      isArabic
                        ? "إدارة قوالب الرسائل المرتبطة بالأحداث."
                        : "Manage event-based WhatsApp templates."
                    }
                  />
                ) : null}

                {canViewBroadcasts ? (
                  <ShortcutCard
                    href="/system/whatsapp/broadcasts"
                    icon={<Megaphone className="h-5 w-5" />}
                    title={t.broadcasts}
                    description={
                      isArabic
                        ? "إدارة حملات ورسائل البث الجماعي."
                        : "Manage WhatsApp broadcast messages."
                    }
                  />
                ) : null}

                {canViewSettings ? (
                  <ShortcutCard
                    href="/system/whatsapp/settings"
                    icon={<Settings className="h-5 w-5" />}
                    title={t.settings}
                    description={
                      isArabic
                        ? "ضبط إعدادات الربط وقنوات الإرسال."
                        : "Configure connection and sending settings."
                    }
                  />
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
                <MessageCircle className="h-12 w-12 text-muted-foreground/40" />
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
                    {t.latestLogsTitle}
                  </CardTitle>
                  <CardDescription>{t.latestLogsDesc}</CardDescription>
                </div>

                {canViewLogs ? (
                  <Link href="/system/whatsapp/logs">
                    <Button variant="outline" className="h-10 rounded-xl">
                      <ArrowUpRight className="h-4 w-4" />
                      {t.logs}
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
                        <TableHead className="min-w-[230px]">
                          {t.table.recipient}
                        </TableHead>
                        <TableHead className="min-w-[250px]">
                          {t.table.message}
                        </TableHead>
                        <TableHead className="min-w-[150px]">
                          {t.table.template}
                        </TableHead>
                        <TableHead className="min-w-[130px]">
                          {t.table.status}
                        </TableHead>
                        <TableHead className="min-w-[160px]">
                          {t.table.createdAt}
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {filteredRows.length > 0 ? (
                        filteredRows.map((item) => (
                          <TableRow key={`${item.id}-${item.recipient_phone}`}>
                            <TableCell>
                              <div className="min-w-[210px]">
                                <p className="font-semibold">
                                  {item.recipient_name || "-"}
                                </p>
                                <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground" dir="ltr">
                                  <Smartphone className="h-3.5 w-3.5" />
                                  {item.recipient_phone || "-"}
                                </p>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="min-w-[230px]">
                                <p className="line-clamp-2 text-sm leading-6">
                                  {item.message_body || "-"}
                                </p>
                                {item.error_message ? (
                                  <p className="mt-1 line-clamp-1 text-xs text-destructive">
                                    {item.error_message}
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="min-w-[130px]">
                                <p className="font-medium">
                                  {item.template_name || "-"}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                                  {item.event_code || "-"}
                                </p>
                              </div>
                            </TableCell>

                            <TableCell>{statusBadge(item.status, locale)}</TableCell>

                            <TableCell>
                              {formatDate(item.created_at, locale)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-32 text-center">
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

          {templates.length > 0 ? (
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">
                  {t.templates}
                </CardTitle>
                <CardDescription>
                  {formatNumber(templates.length)} {t.totalTemplates}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {templates.slice(0, 6).map((template) => (
                    <Card
                      key={`${template.id}-${template.template_key}`}
                      className="rounded-2xl border bg-background/70 shadow-sm"
                    >
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{template.template_name}</p>
                            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                              {template.template_key || template.event_code || "-"}
                            </p>
                          </div>

                          <Badge variant="outline" className="rounded-full">
                            {templateStatusLabel(template.status, locale)}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {template.is_active ? (
                            <Badge className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                              {t.activeTemplates}
                            </Badge>
                          ) : null}

                          {template.language_code ? (
                            <Badge variant="outline" className="rounded-full" dir="ltr">
                              {template.language_code}
                            </Badge>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

/* ============================================================
   Small Components
============================================================ */

async function safeGet(endpoint: string) {
  const response = await fetch(apiUrl(endpoint), {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  }).catch(() => null);

  if (!response) return null;

  const payload = (await response.json().catch(() => null)) as
    | ApiEnvelope<unknown>
    | null;

  if (!response.ok || payload?.ok === false || payload?.success === false) {
    return null;
  }

  return payload;
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
          <div className="min-w-0">
            <div className="truncate text-2xl font-bold">{value}</div>
            <p className="mt-1 text-sm text-muted-foreground">{title}</p>
          </div>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
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

function ShortcutCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full rounded-2xl border bg-background/70 shadow-sm transition hover:bg-muted/40">
        <CardContent className="flex h-full flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {icon}
            </div>

            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </div>

          <div>
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}