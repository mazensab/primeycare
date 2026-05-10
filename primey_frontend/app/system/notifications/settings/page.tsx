"use client";

/* ============================================================
   📂 app/system/notifications/settings/page.tsx
   🧠 Primey Care | Notification Settings
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ مبني بنفس نمط المراكز/العملاء المعتمد
   ✅ Full Width Layout
   ✅ Main Settings + Sidebar Summary
   ✅ حماية عرض وتحديث الإعدادات حسب الصلاحيات
   ✅ fallback آمن لـ system_admin / superadmin
   ✅ Error State مستقل
   ✅ Skeleton Loading
   ✅ حفظ آمن عند توفر صلاحية الإدارة
   ✅ لا توجد روابط تقارير داخل الوحدة
   ✅ لا توجد مسارات أو أسماء API ظاهرة في الواجهة
   ✅ استخدام toast من sonner
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ بدون localhost hardcoded
   ✅ الأرقام بالإنجليزية
============================================================ */

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Bell,
  CheckCircle2,
  ClipboardList,
  Globe,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCcw,
  Save,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";
type AuthRecord = Record<string, unknown>;

type NotificationSettingsData = {
  appName: string;
  brandName: string;
  frontendBaseUrl: string;
  supportEmail: string;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  inAppEnabled: boolean;
  smsEnabled: boolean;
  emailLogoUrl: string;
  primeyEmailLogoUrl: string;
  auditBcc: string;
  defaultSeverity: string;
  senderName: string;
  senderEmail: string;
  note: string;
  readonly: boolean;
  persisted: boolean;
  availableChannels: string[];
};

type SettingsPayload = {
  ok?: boolean;
  message?: string;
  data?: Record<string, unknown>;
  settings?: Record<string, unknown>;
};

type SettingsErrors = Partial<Record<keyof NotificationSettingsData, string>>;

const SETTINGS_ENDPOINTS = [
  "/api/notification-center/settings/",
  "/api/notifications/settings/",
];

const initialSettings: NotificationSettingsData = {
  appName: "Primey Care",
  brandName: "Primey Care",
  frontendBaseUrl: "",
  supportEmail: "",
  emailEnabled: true,
  whatsappEnabled: true,
  inAppEnabled: true,
  smsEnabled: false,
  emailLogoUrl: "",
  primeyEmailLogoUrl: "",
  auditBcc: "",
  defaultSeverity: "INFO",
  senderName: "Primey Care",
  senderEmail: "",
  note: "",
  readonly: true,
  persisted: false,
  availableChannels: [],
};

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

function readCookie(name: string) {
  if (typeof document === "undefined") return "";

  const match = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.split("=")[1] || "") : "";
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
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "إعدادات الإشعارات" : "Notification Settings",
    subtitle: isArabic
      ? "إدارة إعدادات مركز الإشعارات وقنوات الإرسال والبريد وواتساب من صفحة موحدة."
      : "Manage notification center settings, delivery channels, email, and WhatsApp from one unified page.",

    back: isArabic ? "مركز الإشعارات" : "Notifications Center",
    list: isArabic ? "قائمة الإشعارات" : "Notifications List",
    refresh: isArabic ? "تحديث" : "Refresh",
    save: isArabic ? "حفظ الإعدادات" : "Save Settings",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    retry: isArabic ? "إعادة المحاولة" : "Retry",

    mainInfo: isArabic ? "الهوية العامة" : "General Identity",
    mainDesc: isArabic
      ? "اسم التطبيق والهوية والرابط العام المستخدم داخل قوالب الإشعارات."
      : "Application name, brand identity, and frontend URL used in notification templates.",

    channelsInfo: isArabic ? "قنوات الإرسال" : "Delivery Channels",
    channelsDesc: isArabic
      ? "تحديد القنوات المفعلة لإرسال الإشعارات."
      : "Configure enabled notification delivery channels.",

    emailInfo: isArabic ? "إعدادات البريد" : "Email Settings",
    emailDesc: isArabic
      ? "بيانات المرسل والدعم والشعارات ونسخ التدقيق."
      : "Sender, support email, logos, and audit BCC settings.",

    advancedInfo: isArabic ? "إعدادات إضافية" : "Additional Settings",
    advancedDesc: isArabic
      ? "ملاحظات وقيم افتراضية مساعدة لمركز الإشعارات."
      : "Notes and default values used by the notification center.",

    summaryTitle: isArabic ? "ملخص الإعدادات" : "Settings Summary",
    summaryDesc: isArabic
      ? "مراجعة سريعة لحالة قنوات الإرسال."
      : "Quick review of delivery channel status.",

    statusTitle: isArabic ? "حالة الإعدادات" : "Settings Status",
    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض إعدادات الإشعارات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view notification settings. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل إعدادات الإشعارات."
      : "Unable to load notification settings.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث إعدادات الإشعارات بنجاح."
      : "Notification settings refreshed successfully.",
    saveSuccess: isArabic
      ? "تم حفظ إعدادات الإشعارات بنجاح."
      : "Notification settings saved successfully.",
    saveError: isArabic
      ? "تعذر حفظ إعدادات الإشعارات."
      : "Unable to save notification settings.",
    validationToast: isArabic
      ? "يرجى تصحيح الحقول المطلوبة قبل الحفظ."
      : "Please fix the required fields before saving.",

    labels: {
      appName: isArabic ? "اسم التطبيق" : "App Name",
      brandName: isArabic ? "اسم العلامة" : "Brand Name",
      frontendBaseUrl: isArabic ? "رابط الواجهة" : "Frontend URL",
      supportEmail: isArabic ? "بريد الدعم" : "Support Email",
      senderName: isArabic ? "اسم المرسل" : "Sender Name",
      senderEmail: isArabic ? "بريد المرسل" : "Sender Email",
      emailLogoUrl: isArabic ? "رابط شعار البريد" : "Email Logo URL",
      primeyEmailLogoUrl: isArabic ? "رابط شعار Primey" : "Primey Email Logo URL",
      auditBcc: isArabic ? "نسخة تدقيق البريد" : "Email Audit BCC",
      defaultSeverity: isArabic ? "الأهمية الافتراضية" : "Default Severity",
      note: isArabic ? "ملاحظة" : "Note",
      inAppEnabled: isArabic ? "الإشعارات داخل النظام" : "In-App Notifications",
      emailEnabled: isArabic ? "إشعارات البريد" : "Email Notifications",
      whatsappEnabled: isArabic ? "إشعارات واتساب" : "WhatsApp Notifications",
      smsEnabled: isArabic ? "إشعارات SMS" : "SMS Notifications",
      readonly: isArabic ? "قراءة فقط" : "Read Only",
      persisted: isArabic ? "محفوظة في النظام" : "Persisted",
      availableChannels: isArabic ? "القنوات المتاحة" : "Available Channels",
    },

    placeholders: {
      appName: "Primey Care",
      brandName: "Primey Care",
      frontendBaseUrl: "https://example.com",
      supportEmail: "support@example.com",
      senderName: "Primey Care",
      senderEmail: "no-reply@example.com",
      emailLogoUrl: "https://example.com/logo.png",
      primeyEmailLogoUrl: "https://example.com/primey-logo.png",
      auditBcc: "audit@example.com, finance@example.com",
      note: isArabic
        ? "ملاحظات داخلية عن إعدادات الإشعارات..."
        : "Internal notes about notification settings...",
    },

    validation: {
      appName: isArabic ? "اسم التطبيق مطلوب." : "App name is required.",
      brandName: isArabic ? "اسم العلامة مطلوب." : "Brand name is required.",
      email: isArabic ? "صيغة البريد غير صحيحة." : "Invalid email format.",
      url: isArabic ? "صيغة الرابط غير صحيحة." : "Invalid URL format.",
    },

    active: isArabic ? "فعال" : "Active",
    inactive: isArabic ? "غير فعال" : "Inactive",
    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",
    readonlyHint: isArabic
      ? "هذه الإعدادات للقراءة فقط من الباك إند ولا يمكن تعديلها من الواجهة."
      : "These settings are read-only from the backend and cannot be edited from the interface.",
    editableHint: isArabic
      ? "يمكن تعديل هذه الإعدادات وحفظها حسب الصلاحية المتاحة."
      : "These settings can be edited and saved based on available permission.",
    notAvailable: isArabic ? "غير متوفر" : "Not available",

    quickNotesTitle: isArabic ? "ملاحظات تشغيلية" : "Operational Notes",
    quickNotes: [
      isArabic
        ? "تفعيل البريد وواتساب يعتمد على إعدادات الباك إند ومفاتيح القنوات."
        : "Email and WhatsApp activation depends on backend configuration and channel credentials.",
      isArabic
        ? "بريد الدعم يظهر داخل قوالب الإشعارات والرسائل المرسلة للعملاء."
        : "Support email appears in notification templates and customer messages.",
      isArabic
        ? "نسخ التدقيق يمكن استخدامها لمراجعة الرسائل المهمة داخليًا."
        : "Audit BCC can be used to internally review important messages.",
      isArabic
        ? "لا يتم عرض أي مسارات تقنية أو تفاصيل API داخل الواجهة."
        : "No technical routes or API details are displayed in the interface.",
    ],
  };
}

/* ============================================================
   Normalizers
============================================================ */

function getValue(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return "";
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;

  const clean = String(value ?? "").toLowerCase();

  if (["true", "1", "yes", "enabled", "active"].includes(clean)) return true;
  if (["false", "0", "no", "disabled", "inactive"].includes(clean)) return false;

  return fallback;
}

function normalizeList(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBcc(value: unknown): string {
  return normalizeList(value).join(", ");
}

function unwrapSettings(payload: SettingsPayload | null): Record<string, unknown> {
  if (!payload) return {};

  return payload.data || payload.settings || (payload as Record<string, unknown>);
}

function normalizeSettings(payload: SettingsPayload | null): NotificationSettingsData {
  const data = unwrapSettings(payload);

  const availableChannels = normalizeList(
    getValue(data, ["available_channels", "channels", "enabled_channels"]),
  );

  return {
    appName: String(getValue(data, ["app_name", "appName"]) || "Primey Care"),
    brandName: String(
      getValue(data, ["project_brand_name", "brand_name", "brandName"]) ||
        "Primey Care",
    ),
    frontendBaseUrl: String(
      getValue(data, ["frontend_base_url", "frontend_url", "app_url"]) || "",
    ),
    supportEmail: String(getValue(data, ["support_email"]) || ""),
    emailEnabled: toBoolean(
      getValue(data, ["email_notifications_enabled", "email_enabled"]),
      true,
    ),
    whatsappEnabled: toBoolean(
      getValue(data, ["whatsapp_notifications_enabled", "whatsapp_enabled"]),
      true,
    ),
    inAppEnabled: toBoolean(
      getValue(data, ["in_app_notifications_enabled", "in_app_enabled"]),
      true,
    ),
    smsEnabled: toBoolean(
      getValue(data, ["sms_notifications_enabled", "sms_enabled"]),
      false,
    ),
    emailLogoUrl: String(getValue(data, ["email_logo_url"]) || ""),
    primeyEmailLogoUrl: String(getValue(data, ["primey_email_logo_url"]) || ""),
    auditBcc: normalizeBcc(getValue(data, ["email_audit_bcc", "audit_bcc"])),
    defaultSeverity: String(getValue(data, ["default_severity"]) || "INFO"),
    senderName: String(getValue(data, ["sender_name", "email_sender_name"]) || "Primey Care"),
    senderEmail: String(getValue(data, ["sender_email", "email_sender_email"]) || ""),
    note: String(getValue(data, ["note", "notes"]) || ""),
    readonly: toBoolean(getValue(data, ["readonly", "read_only"]), true),
    persisted: toBoolean(getValue(data, ["persisted", "is_persisted"]), false),
    availableChannels,
  };
}

function normalizePayload(settings: NotificationSettingsData) {
  return {
    app_name: settings.appName.trim(),
    project_brand_name: settings.brandName.trim(),
    frontend_base_url: settings.frontendBaseUrl.trim(),
    support_email: settings.supportEmail.trim(),
    email_notifications_enabled: settings.emailEnabled,
    whatsapp_notifications_enabled: settings.whatsappEnabled,
    in_app_notifications_enabled: settings.inAppEnabled,
    sms_notifications_enabled: settings.smsEnabled,
    email_logo_url: settings.emailLogoUrl.trim(),
    primey_email_logo_url: settings.primeyEmailLogoUrl.trim(),
    email_audit_bcc: normalizeList(settings.auditBcc),
    default_severity: settings.defaultSeverity.trim() || "INFO",
    sender_name: settings.senderName.trim(),
    sender_email: settings.senderEmail.trim(),
    note: settings.note.trim(),
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

function isValidEmail(value: string) {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidUrl(value: string) {
  if (!value.trim()) return true;

  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function channelCount(settings: NotificationSettingsData) {
  return [
    settings.inAppEnabled,
    settings.emailEnabled,
    settings.whatsappEnabled,
    settings.smsEnabled,
  ].filter(Boolean).length;
}

function statusBadge(active: boolean, locale: AppLocale) {
  const t = dictionary(locale);

  return active ? (
    <Badge className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
      {t.active}
    </Badge>
  ) : (
    <Badge variant="outline" className="rounded-full">
      {t.inactive}
    </Badge>
  );
}

function FieldBlock({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

function ToggleBox({
  icon: Icon,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border bg-background p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          </div>

          <Checkbox
            checked={checked}
            disabled={disabled}
            onCheckedChange={(value) => onChange(Boolean(value))}
          />
        </div>
      </div>
    </label>
  );
}

function SummaryItem({
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

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-3 p-5">
              <SkeletonLine className="h-5 w-40" />
              <SkeletonLine className="h-10 w-full rounded-xl" />
              <SkeletonLine className="h-10 w-full rounded-xl" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="space-y-3 p-5">
          <SkeletonLine className="h-5 w-32" />
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonLine key={index} className="h-12 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================================================
   Page
============================================================ */

export default function SystemNotificationSettingsPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [settings, setSettings] =
    useState<NotificationSettingsData>(initialSettings);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canViewSettings = hasSafePermission(
    auth,
    ["notifications.view", "notifications.settings", "notifications.manage"],
    "view",
  );

  const canManageSettings = hasSafePermission(
    auth,
    ["notifications.settings", "notifications.manage"],
    "action",
  );

  const canViewNotifications = hasSafePermission(
    auth,
    ["notifications.view", "notifications.list"],
    "view",
  );

  const isReadonly = settings.readonly || !canManageSettings;
  const enabledChannels = channelCount(settings);
  const progressPercent = Math.round((enabledChannels / 4) * 100);

  function updateSetting<K extends keyof NotificationSettingsData>(
    key: K,
    value: NotificationSettingsData[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));

    setErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
  }

  function validateSettings() {
    const nextErrors: SettingsErrors = {};

    if (!settings.appName.trim()) {
      nextErrors.appName = t.validation.appName;
    }

    if (!settings.brandName.trim()) {
      nextErrors.brandName = t.validation.brandName;
    }

    if (!isValidEmail(settings.supportEmail)) {
      nextErrors.supportEmail = t.validation.email;
    }

    if (!isValidEmail(settings.senderEmail)) {
      nextErrors.senderEmail = t.validation.email;
    }

    for (const email of normalizeList(settings.auditBcc)) {
      if (!isValidEmail(email)) {
        nextErrors.auditBcc = t.validation.email;
      }
    }

    if (!isValidUrl(settings.frontendBaseUrl)) {
      nextErrors.frontendBaseUrl = t.validation.url;
    }

    if (!isValidUrl(settings.emailLogoUrl)) {
      nextErrors.emailLogoUrl = t.validation.url;
    }

    if (!isValidUrl(settings.primeyEmailLogoUrl)) {
      nextErrors.primeyEmailLogoUrl = t.validation.url;
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  const loadSettings = useCallback(
    async (showToast = false) => {
      if (!canViewSettings) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        let loadedPayload: SettingsPayload | null = null;
        let loaded = false;

        for (const endpoint of SETTINGS_ENDPOINTS) {
          const response = await fetch(apiUrl(endpoint), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          });

          const payload = (await response.json().catch(() => null)) as
            | SettingsPayload
            | null;

          if (response.status === 404 || response.status === 405) {
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
          throw new Error(loadedPayload?.message || "Unable to load settings");
        }

        setSettings(normalizeSettings(loadedPayload));

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Notification settings load error:", error);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewSettings, t.loadError, t.refreshSuccess],
  );

  async function saveSettings() {
    if (!canManageSettings || settings.readonly) return;

    if (!validateSettings()) {
      toast.error(t.validationToast);
      return;
    }

    try {
      setIsSaving(true);

      const csrfToken = readCookie("csrftoken");
      let saved = false;
      let lastMessage = "";

      for (const endpoint of SETTINGS_ENDPOINTS) {
        const response = await fetch(apiUrl(endpoint), {
          method: "PATCH",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
          },
          body: JSON.stringify(normalizePayload(settings)),
        });

        const payload = (await response.json().catch(() => null)) as
          | SettingsPayload
          | null;

        if (response.status === 404 || response.status === 405) {
          lastMessage = payload?.message || "";
          continue;
        }

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || `HTTP ${response.status}`);
        }

        setSettings(normalizeSettings(payload));
        saved = true;
        break;
      }

      if (!saved) {
        throw new Error(lastMessage || t.saveError);
      }

      toast.success(t.saveSuccess);
    } catch (error) {
      console.error("Notification settings save error:", error);
      toast.error(t.saveError);
    } finally {
      setIsSaving(false);
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
    if (authResolving) return;
    loadSettings(false);
  }, [authResolving, loadSettings]);

  if (!authResolving && !canViewSettings) {
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

          {canViewNotifications ? (
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

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadSettings(true)}
            disabled={isLoading || isSaving}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canManageSettings && !settings.readonly ? (
            <Button
              className="h-10 rounded-xl"
              onClick={saveSettings}
              disabled={isLoading || isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{isSaving ? t.saving : t.save}</span>
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
              onClick={() => loadSettings(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!errorMessage && isLoading ? <SettingsSkeleton /> : null}

      {!errorMessage && !isLoading ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* Main Settings */}
          <div className="space-y-4">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Settings className="h-4 w-4" />
                  {t.mainInfo}
                </CardTitle>
                <CardDescription>{t.mainDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2">
                <FieldBlock label={t.labels.appName} error={errors.appName}>
                  <Input
                    value={settings.appName}
                    disabled={isReadonly || isSaving}
                    placeholder={t.placeholders.appName}
                    className="h-10 rounded-xl"
                    onChange={(event) =>
                      updateSetting("appName", event.target.value)
                    }
                  />
                </FieldBlock>

                <FieldBlock label={t.labels.brandName} error={errors.brandName}>
                  <Input
                    value={settings.brandName}
                    disabled={isReadonly || isSaving}
                    placeholder={t.placeholders.brandName}
                    className="h-10 rounded-xl"
                    onChange={(event) =>
                      updateSetting("brandName", event.target.value)
                    }
                  />
                </FieldBlock>

                <FieldBlock
                  label={t.labels.frontendBaseUrl}
                  error={errors.frontendBaseUrl}
                >
                  <Input
                    value={settings.frontendBaseUrl}
                    disabled={isReadonly || isSaving}
                    placeholder={t.placeholders.frontendBaseUrl}
                    className="h-10 rounded-xl"
                    dir="ltr"
                    onChange={(event) =>
                      updateSetting("frontendBaseUrl", event.target.value)
                    }
                  />
                </FieldBlock>

                <FieldBlock
                  label={t.labels.defaultSeverity}
                  error={errors.defaultSeverity}
                >
                  <select
                    value={settings.defaultSeverity}
                    disabled={isReadonly || isSaving}
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    onChange={(event) =>
                      updateSetting("defaultSeverity", event.target.value)
                    }
                  >
                    <option value="INFO">{isArabic ? "معلومة" : "Info"}</option>
                    <option value="SUCCESS">
                      {isArabic ? "نجاح" : "Success"}
                    </option>
                    <option value="WARNING">
                      {isArabic ? "تنبيه" : "Warning"}
                    </option>
                    <option value="ERROR">{isArabic ? "خطأ" : "Error"}</option>
                    <option value="CRITICAL">
                      {isArabic ? "حرج" : "Critical"}
                    </option>
                  </select>
                </FieldBlock>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Bell className="h-4 w-4" />
                  {t.channelsInfo}
                </CardTitle>
                <CardDescription>{t.channelsDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2">
                <ToggleBox
                  icon={Bell}
                  title={t.labels.inAppEnabled}
                  description={t.labels.inAppEnabled}
                  checked={settings.inAppEnabled}
                  disabled={isReadonly || isSaving}
                  onChange={(value) => updateSetting("inAppEnabled", value)}
                />

                <ToggleBox
                  icon={Mail}
                  title={t.labels.emailEnabled}
                  description={t.labels.emailEnabled}
                  checked={settings.emailEnabled}
                  disabled={isReadonly || isSaving}
                  onChange={(value) => updateSetting("emailEnabled", value)}
                />

                <ToggleBox
                  icon={MessageCircle}
                  title={t.labels.whatsappEnabled}
                  description={t.labels.whatsappEnabled}
                  checked={settings.whatsappEnabled}
                  disabled={isReadonly || isSaving}
                  onChange={(value) => updateSetting("whatsappEnabled", value)}
                />

                <ToggleBox
                  icon={Smartphone}
                  title={t.labels.smsEnabled}
                  description={t.labels.smsEnabled}
                  checked={settings.smsEnabled}
                  disabled={isReadonly || isSaving}
                  onChange={(value) => updateSetting("smsEnabled", value)}
                />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Mail className="h-4 w-4" />
                  {t.emailInfo}
                </CardTitle>
                <CardDescription>{t.emailDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2">
                <FieldBlock
                  label={t.labels.supportEmail}
                  error={errors.supportEmail}
                >
                  <Input
                    value={settings.supportEmail}
                    disabled={isReadonly || isSaving}
                    placeholder={t.placeholders.supportEmail}
                    className="h-10 rounded-xl"
                    dir="ltr"
                    onChange={(event) =>
                      updateSetting("supportEmail", event.target.value)
                    }
                  />
                </FieldBlock>

                <FieldBlock
                  label={t.labels.senderName}
                  error={errors.senderName}
                >
                  <Input
                    value={settings.senderName}
                    disabled={isReadonly || isSaving}
                    placeholder={t.placeholders.senderName}
                    className="h-10 rounded-xl"
                    onChange={(event) =>
                      updateSetting("senderName", event.target.value)
                    }
                  />
                </FieldBlock>

                <FieldBlock
                  label={t.labels.senderEmail}
                  error={errors.senderEmail}
                >
                  <Input
                    value={settings.senderEmail}
                    disabled={isReadonly || isSaving}
                    placeholder={t.placeholders.senderEmail}
                    className="h-10 rounded-xl"
                    dir="ltr"
                    onChange={(event) =>
                      updateSetting("senderEmail", event.target.value)
                    }
                  />
                </FieldBlock>

                <FieldBlock label={t.labels.auditBcc} error={errors.auditBcc}>
                  <Input
                    value={settings.auditBcc}
                    disabled={isReadonly || isSaving}
                    placeholder={t.placeholders.auditBcc}
                    className="h-10 rounded-xl"
                    dir="ltr"
                    onChange={(event) =>
                      updateSetting("auditBcc", event.target.value)
                    }
                  />
                </FieldBlock>

                <FieldBlock
                  label={t.labels.emailLogoUrl}
                  error={errors.emailLogoUrl}
                >
                  <Input
                    value={settings.emailLogoUrl}
                    disabled={isReadonly || isSaving}
                    placeholder={t.placeholders.emailLogoUrl}
                    className="h-10 rounded-xl"
                    dir="ltr"
                    onChange={(event) =>
                      updateSetting("emailLogoUrl", event.target.value)
                    }
                  />
                </FieldBlock>

                <FieldBlock
                  label={t.labels.primeyEmailLogoUrl}
                  error={errors.primeyEmailLogoUrl}
                >
                  <Input
                    value={settings.primeyEmailLogoUrl}
                    disabled={isReadonly || isSaving}
                    placeholder={t.placeholders.primeyEmailLogoUrl}
                    className="h-10 rounded-xl"
                    dir="ltr"
                    onChange={(event) =>
                      updateSetting("primeyEmailLogoUrl", event.target.value)
                    }
                  />
                </FieldBlock>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <ShieldCheck className="h-4 w-4" />
                  {t.advancedInfo}
                </CardTitle>
                <CardDescription>{t.advancedDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <FieldBlock label={t.labels.note} error={errors.note}>
                  <Textarea
                    value={settings.note}
                    disabled={isReadonly || isSaving}
                    placeholder={t.placeholders.note}
                    className="min-h-28 rounded-xl"
                    onChange={(event) => updateSetting("note", event.target.value)}
                  />
                </FieldBlock>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">
                  {t.summaryTitle}
                </CardTitle>
                <CardDescription>{t.summaryDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-xl border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t.labels.availableChannels}
                      </p>
                      <p className="mt-1 text-2xl font-bold">
                        {formatNumber(enabledChannels)} / 4
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                      <BadgeCheck className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <SummaryItem
                  icon={Settings}
                  label={t.labels.appName}
                  value={settings.appName || "-"}
                />

                <SummaryItem
                  icon={Globe}
                  label={t.labels.frontendBaseUrl}
                  value={settings.frontendBaseUrl || t.notAvailable}
                />

                <SummaryItem
                  icon={Mail}
                  label={t.labels.emailEnabled}
                  value={statusBadge(settings.emailEnabled, locale)}
                />

                <SummaryItem
                  icon={MessageCircle}
                  label={t.labels.whatsappEnabled}
                  value={statusBadge(settings.whatsappEnabled, locale)}
                />

                <SummaryItem
                  icon={Bell}
                  label={t.labels.inAppEnabled}
                  value={statusBadge(settings.inAppEnabled, locale)}
                />

                <SummaryItem
                  icon={Smartphone}
                  label={t.labels.smsEnabled}
                  value={statusBadge(settings.smsEnabled, locale)}
                />

                <SummaryItem
                  icon={ShieldCheck}
                  label={t.labels.readonly}
                  value={settings.readonly ? t.yes : t.no}
                />

                <SummaryItem
                  icon={CheckCircle2}
                  label={t.labels.persisted}
                  value={settings.persisted ? t.yes : t.no}
                />

                {canManageSettings && !settings.readonly ? (
                  <Button
                    className="h-10 w-full rounded-xl"
                    disabled={isSaving || isLoading}
                    onClick={saveSettings}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {isSaving ? t.saving : t.save}
                  </Button>
                ) : (
                  <div className="rounded-2xl border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
                    {settings.readonly ? t.readonlyHint : t.editableHint}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">
                  {t.quickNotesTitle}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {t.quickNotes.map((item, index) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-xl border bg-background p-3"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {index + 1}
                    </div>

                    <p className="text-sm leading-6 text-muted-foreground">
                      {item}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </div>
      ) : null}
    </div>
  );
}