"use client";

/* ============================================================
   📂 app/system/profile/page.tsx
   🧠 Primey Care | System Profile Page

   ✅ المرحلة 17 + المرحلة 2
   ✅ نفس النمط المعتمد
   ✅ w-full space-y-4
   ✅ بدون main / min-h-screen / max-w
   ✅ صفحة ملف المستخدم الحالي
   ✅ Skeleton Loading
   ✅ Error State مستقل
   ✅ Empty State ذكي
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
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarClock,
  Copy,
  FileText,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Printer,
  RefreshCcw,
  Settings,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
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
type Dict = Record<string, unknown>;

type ProfileStatus = "ACTIVE" | "INACTIVE" | "PENDING" | "BLOCKED" | "UNKNOWN";

type ProfileRole =
  | "SYSTEM_ADMIN"
  | "PROVIDER_ADMIN"
  | "CUSTOMER_USER"
  | "AGENT_USER"
  | "ACCOUNTANT"
  | "SUPPORT"
  | "VIEWER"
  | "UNKNOWN";

type ProfileData = {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone: string;
  role: ProfileRole;
  user_type: string;
  workspace: string;
  status: ProfileStatus;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  permissions: string[];
  permissions_count: number;
  last_login: string;
  date_joined: string;
};

type ApiEnvelope<T> = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  data?: T;
  user?: unknown;
  profile?: unknown;
  account?: unknown;
};

const EMPTY_PROFILE: ProfileData = {
  id: "",
  full_name: "-",
  username: "-",
  email: "",
  phone: "",
  role: "UNKNOWN",
  user_type: "",
  workspace: "",
  status: "UNKNOWN",
  is_active: false,
  is_staff: false,
  is_superuser: false,
  permissions: [],
  permissions_count: 0,
  last_login: "",
  date_joined: "",
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
          "provider_admin",
          "customer_user",
          "agent_user",
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
    title: isArabic ? "الملف الشخصي" : "Profile",
    subtitle: isArabic
      ? "عرض بيانات الحساب الحالي والدور والصلاحيات وحالة الوصول."
      : "View current account details, role, permissions, and access status.",

    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    copied: isArabic ? "تم النسخ." : "Copied.",
    copyFailed: isArabic ? "تعذر النسخ." : "Copy failed.",

    profileSummary: isArabic ? "ملخص الحساب" : "Account Summary",
    accountDetails: isArabic ? "بيانات الحساب" : "Account Details",
    accessDetails: isArabic ? "الوصول والصلاحيات" : "Access & Permissions",
    quickActions: isArabic ? "اختصارات الحساب" : "Account Shortcuts",

    fullName: isArabic ? "الاسم الكامل" : "Full Name",
    username: isArabic ? "اسم المستخدم" : "Username",
    email: isArabic ? "البريد الإلكتروني" : "Email",
    phone: isArabic ? "الجوال" : "Phone",
    role: isArabic ? "الدور" : "Role",
    workspace: isArabic ? "المساحة" : "Workspace",
    userType: isArabic ? "نوع المستخدم" : "User Type",
    status: isArabic ? "الحالة" : "Status",
    permissions: isArabic ? "الصلاحيات" : "Permissions",
    lastLogin: isArabic ? "آخر دخول" : "Last Login",
    joinedAt: isArabic ? "تاريخ الانضمام" : "Joined At",

    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    pending: isArabic ? "بانتظار التفعيل" : "Pending",
    blocked: isArabic ? "محظور" : "Blocked",
    unknown: isArabic ? "غير محدد" : "Unknown",

    systemAdmin: isArabic ? "مدير النظام" : "System Admin",
    providerAdmin: isArabic ? "مدير مقدم خدمة" : "Provider Admin",
    customerUser: isArabic ? "عميل" : "Customer",
    agentUser: isArabic ? "مندوب" : "Agent",
    accountant: isArabic ? "محاسب" : "Accountant",
    support: isArabic ? "دعم" : "Support",
    viewer: isArabic ? "مشاهد" : "Viewer",

    staff: isArabic ? "داخلي" : "Staff",
    superuser: isArabic ? "صلاحية عليا" : "Superuser",
    noPermissions: isArabic
      ? "لا توجد صلاحيات مفصلة ظاهرة لهذا الحساب."
      : "No detailed permissions are visible for this account.",

    users: isArabic ? "مستخدمو النظام" : "System Users",
    settings: isArabic ? "الإعدادات" : "Settings",
    dashboard: isArabic ? "لوحة التحكم" : "Dashboard",

    usersDesc: isArabic
      ? "الانتقال لإدارة المستخدمين والصلاحيات."
      : "Open user and permissions management.",
    settingsDesc: isArabic
      ? "الانتقال لإعدادات النظام."
      : "Open system settings.",
    dashboardDesc: isArabic
      ? "العودة إلى لوحة النظام الرئيسية."
      : "Back to the main system dashboard.",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الملف" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض هذا الملف."
      : "You do not have permission to view this profile.",

    loadError: isArabic ? "تعذر تحميل بيانات الملف." : "Unable to load profile.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال ثم أعد المحاولة."
      : "Check the connection, then try again.",
    loadSuccess: isArabic ? "تم تحديث بيانات الملف." : "Profile refreshed.",

    printSuccess: isArabic ? "تم تجهيز نافذة الطباعة." : "Print window prepared.",
    printError: isArabic ? "تعذر فتح نافذة الطباعة." : "Unable to open print window.",
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

  for (const container of ["user", "account", "profile", "data", "session"]) {
    const nested = obj[container];

    if (nested && typeof nested === "object") {
      const value = getNestedValue(nested as Dict, keys);

      if (value !== undefined && value !== null && value !== "") return value;
    }
  }

  return undefined;
}

function normalizeStatus(value: unknown, isActive: boolean): ProfileStatus {
  const clean = String(value || "").toUpperCase();

  if (["ACTIVE", "ENABLED", "APPROVED"].includes(clean)) return "ACTIVE";
  if (["INACTIVE", "DISABLED"].includes(clean)) return "INACTIVE";
  if (["PENDING", "INVITED", "NEW"].includes(clean)) return "PENDING";
  if (["BLOCKED", "SUSPENDED", "BANNED"].includes(clean)) return "BLOCKED";

  return isActive ? "ACTIVE" : "INACTIVE";
}

function normalizeRole(value: unknown): ProfileRole {
  const clean = String(value || "").toLowerCase();

  if (["system_admin", "super_admin", "superadmin", "admin"].includes(clean)) {
    return "SYSTEM_ADMIN";
  }

  if (["provider_admin", "provider"].includes(clean)) return "PROVIDER_ADMIN";
  if (["customer_user", "customer"].includes(clean)) return "CUSTOMER_USER";
  if (["agent_user", "agent"].includes(clean)) return "AGENT_USER";
  if (["accountant", "finance"].includes(clean)) return "ACCOUNTANT";
  if (["support", "support_user"].includes(clean)) return "SUPPORT";
  if (["viewer", "read_only", "readonly"].includes(clean)) return "VIEWER";

  return "UNKNOWN";
}

function normalizeProfile(payload: unknown, authValue: unknown): ProfileData {
  const auth = asDict(authValue);
  const authUser = getAuthUser(authValue);
  const obj = asDict(payload);

  const source =
    Object.keys(obj).length > 0
      ? {
          ...asDict(obj.user),
          ...asDict(obj.account),
          ...asDict(obj.profile),
          ...asDict(obj.data),
          ...obj,
        }
      : {
          ...authUser,
          ...auth,
        };

  const isActive = Boolean(
    getNestedValue(source, ["is_active", "active", "isActive"]) ?? true,
  );

  const roleValue =
    getNestedValue(source, ["role", "user_role", "user_type", "type"]) ||
    getAuthRoles(authValue)[0] ||
    "";

  const permissions = uniqueStrings([
    getNestedValue(source, ["permission_codes"]),
    getNestedValue(source, ["permissions"]),
    getNestedValue(source, ["profile_permissions"]),
    getAuthPermissionCodes(authValue),
  ]);

  const fullName =
    getNestedValue(source, ["full_name", "name", "display_name"]) ||
    [
      getNestedValue(source, ["first_name"]),
      getNestedValue(source, ["last_name"]),
    ]
      .filter(Boolean)
      .join(" ");

  return {
    id: String(getNestedValue(source, ["id", "uuid", "pk"]) || ""),
    full_name: String(fullName || "-"),
    username: String(getNestedValue(source, ["username", "login"]) || "-"),
    email: String(getNestedValue(source, ["email"]) || ""),
    phone: String(getNestedValue(source, ["phone", "mobile", "phone_number"]) || ""),
    role: normalizeRole(roleValue),
    user_type: String(getNestedValue(source, ["user_type", "type"]) || ""),
    workspace: String(getNestedValue(source, ["workspace", "space"]) || ""),
    status: normalizeStatus(getNestedValue(source, ["status", "state"]), isActive),
    is_active: isActive,
    is_staff: Boolean(getNestedValue(source, ["is_staff", "staff", "isStaff"])),
    is_superuser:
      Boolean(getNestedValue(source, ["is_superuser", "superuser", "isSuperuser"])) ||
      isSystemAdmin(authValue),
    permissions,
    permissions_count: permissions.length,
    last_login: String(getNestedValue(source, ["last_login", "lastLogin"]) || ""),
    date_joined: String(
      getNestedValue(source, ["date_joined", "joined_at", "created_at"]) || "",
    ),
  };
}

function statusLabel(status: ProfileStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<ProfileStatus, string> = {
    ACTIVE: t.active,
    INACTIVE: t.inactive,
    PENDING: t.pending,
    BLOCKED: t.blocked,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function roleLabel(role: ProfileRole, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<ProfileRole, string> = {
    SYSTEM_ADMIN: t.systemAdmin,
    PROVIDER_ADMIN: t.providerAdmin,
    CUSTOMER_USER: t.customerUser,
    AGENT_USER: t.agentUser,
    ACCOUNTANT: t.accountant,
    SUPPORT: t.support,
    VIEWER: t.viewer,
    UNKNOWN: t.unknown,
  };

  return labels[role];
}

function statusBadge(status: ProfileStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

  if (status === "ACTIVE") {
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

  if (status === "INACTIVE" || status === "BLOCKED") {
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

function getInitials(profile: ProfileData) {
  const name = profile.full_name && profile.full_name !== "-" ? profile.full_name : profile.username;

  return String(name || "P")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function PageSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="space-y-4 p-5">
          <SkeletonLine className="mx-auto h-24 w-24 rounded-full" />
          <SkeletonLine className="mx-auto h-7 w-40" />
          <SkeletonLine className="mx-auto h-4 w-28" />
          <SkeletonLine className="h-12 w-full rounded-xl" />
          <SkeletonLine className="h-12 w-full rounded-xl" />
          <SkeletonLine className="h-12 w-full rounded-xl" />
        </CardContent>
      </Card>

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
          <CardContent className="space-y-3 p-5">
            <SkeletonLine className="h-7 w-48" />
            {Array.from({ length: 7 }).map((_, index) => (
              <SkeletonLine key={index} className="h-12 w-full rounded-xl" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   Print
============================================================ */

function buildPrintHtml({
  locale,
  profile,
}: {
  locale: AppLocale;
  profile: ProfileData;
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);

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
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
          th { background: #f3f4f6; font-weight: 700; width: 240px; }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 9px;
            text-align: ${isArabic ? "right" : "left"};
          }
          @page { size: A4; margin: 12mm; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${escapeHtml(t.title)}</h1>
            <div class="meta">${escapeHtml(t.printedAt)}: ${escapeHtml(new Date().toLocaleString("en-US"))}</div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <table>
          <tbody>
            <tr><th>${escapeHtml(t.fullName)}</th><td>${escapeHtml(profile.full_name)}</td></tr>
            <tr><th>${escapeHtml(t.username)}</th><td>${escapeHtml(profile.username)}</td></tr>
            <tr><th>${escapeHtml(t.email)}</th><td>${escapeHtml(profile.email || "-")}</td></tr>
            <tr><th>${escapeHtml(t.phone)}</th><td>${escapeHtml(profile.phone || "-")}</td></tr>
            <tr><th>${escapeHtml(t.role)}</th><td>${escapeHtml(roleLabel(profile.role, locale))}</td></tr>
            <tr><th>${escapeHtml(t.workspace)}</th><td>${escapeHtml(profile.workspace || "-")}</td></tr>
            <tr><th>${escapeHtml(t.status)}</th><td>${escapeHtml(statusLabel(profile.status, locale))}</td></tr>
            <tr><th>${escapeHtml(t.permissions)}</th><td>${escapeHtml(formatNumber(profile.permissions_count))}</td></tr>
            <tr><th>${escapeHtml(t.lastLogin)}</th><td>${escapeHtml(formatDate(profile.last_login, locale))}</td></tr>
            <tr><th>${escapeHtml(t.joinedAt)}</th><td>${escapeHtml(formatDate(profile.date_joined, locale))}</td></tr>
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
   Page
============================================================ */

export default function SystemProfilePage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasAnyPermission(
    auth,
    ["system.view", "profile.view", "users.view"],
    "view",
  );

  const canViewUsers = hasAnyPermission(auth, ["users.view"], "view");
  const canViewSettings = hasAnyPermission(
    auth,
    ["settings.view", "system.settings"],
    "view",
  );

  const visiblePermissions = useMemo(
    () => profile.permissions.slice(0, 24),
    [profile.permissions],
  );

  const loadProfile = useCallback(
    async (showToast = false) => {
      if (!canView) {
        setProfile(EMPTY_PROFILE);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch(apiUrl("/api/auth/whoami/"), {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        const payload = (await response.json().catch(() => null)) as
          | ApiEnvelope<unknown>
          | null;

        if (!response.ok || payload?.ok === false || payload?.success === false) {
          throw new Error(payload?.message || payload?.detail || t.loadError);
        }

        setProfile(normalizeProfile(payload, auth));

        if (showToast) toast.success(t.loadSuccess);
      } catch (error) {
        console.error("Profile load error:", error);
        setProfile(normalizeProfile(null, auth));
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [auth, canView, t.loadError, t.loadSuccess],
  );

  function printPage() {
    const printWindow = window.open("", "_blank", "width=900,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildPrintHtml({ locale, profile }));
    printWindow.document.close();

    toast.success(t.printSuccess);
  }

  async function copyValue(value: string) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      toast.success(t.copied);
    } catch (error) {
      console.error("Copy profile value error:", error);
      toast.error(t.copyFailed);
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
    loadProfile(false);
  }, [authResolving, loadProfile]);

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
            onClick={() => loadProfile(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={printPage}
            disabled={isLoading}
          >
            <Printer className="h-4 w-4" />
            <span>{t.print}</span>
          </Button>
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
              onClick={() => loadProfile(true)}
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
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-5 p-5">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-3xl font-bold text-primary">
                  {getInitials(profile)}
                </div>

                <h2 className="mt-4 text-lg font-bold">{profile.full_name}</h2>

                <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                  {profile.username}
                </p>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {statusBadge(profile.status, locale)}

                  <Badge variant="outline" className="rounded-full">
                    <KeyRound className="h-3.5 w-3.5" />
                    {roleLabel(profile.role, locale)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border bg-background/70 p-4">
                <InfoLine
                  icon={<Mail className="h-4 w-4" />}
                  label={t.email}
                  value={profile.email || "-"}
                  onCopy={profile.email ? () => copyValue(profile.email) : undefined}
                />

                <InfoLine
                  icon={<Phone className="h-4 w-4" />}
                  label={t.phone}
                  value={profile.phone || "-"}
                  onCopy={profile.phone ? () => copyValue(profile.phone) : undefined}
                />

                <InfoLine
                  icon={<Briefcase className="h-4 w-4" />}
                  label={t.workspace}
                  value={profile.workspace || "-"}
                />
              </div>

              <div className="grid gap-3">
                <Link href="/system">
                  <Button variant="outline" className="h-10 w-full rounded-xl">
                    <Building2 className="h-4 w-4" />
                    {t.dashboard}
                  </Button>
                </Link>

                {canViewUsers ? (
                  <Link href="/system/users">
                    <Button variant="outline" className="h-10 w-full rounded-xl">
                      <Users className="h-4 w-4" />
                      {t.users}
                    </Button>
                  </Link>
                ) : null}

                {canViewSettings ? (
                  <Link href="/system/settings">
                    <Button variant="outline" className="h-10 w-full rounded-xl">
                      <Settings className="h-4 w-4" />
                      {t.settings}
                    </Button>
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title={t.status}
                value={statusLabel(profile.status, locale)}
                icon={<BadgeCheck className="h-5 w-5" />}
              />
              <KpiCard
                title={t.role}
                value={roleLabel(profile.role, locale)}
                icon={<ShieldCheck className="h-5 w-5" />}
              />
              <KpiCard
                title={t.permissions}
                value={formatNumber(profile.permissions_count)}
                icon={<KeyRound className="h-5 w-5" />}
              />
              <KpiCard
                title={t.userType}
                value={profile.user_type || "-"}
                icon={<UserCog className="h-5 w-5" />}
              />
            </div>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">
                  {t.accountDetails}
                </CardTitle>
                <CardDescription>{t.profileSummary}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableBody>
                      <DetailRow label={t.fullName} value={profile.full_name} />
                      <DetailRow label={t.username} value={profile.username} dir="ltr" />
                      <DetailRow label={t.email} value={profile.email || "-"} dir="ltr" />
                      <DetailRow label={t.phone} value={profile.phone || "-"} dir="ltr" />
                      <DetailRow label={t.role} value={roleLabel(profile.role, locale)} />
                      <DetailRow label={t.workspace} value={profile.workspace || "-"} />
                      <DetailRow label={t.userType} value={profile.user_type || "-"} />
                      <TableRow>
                        <TableCell className="w-[220px] bg-muted/30 font-semibold">
                          {t.status}
                        </TableCell>
                        <TableCell>{statusBadge(profile.status, locale)}</TableCell>
                      </TableRow>
                      <DetailRow
                        label={t.lastLogin}
                        value={formatDate(profile.last_login, locale)}
                      />
                      <DetailRow
                        label={t.joinedAt}
                        value={formatDate(profile.date_joined, locale)}
                      />
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">
                  {t.accessDetails}
                </CardTitle>
                <CardDescription>
                  {formatNumber(profile.permissions_count)} {t.permissions}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {profile.is_superuser ? (
                    <Badge variant="outline" className="rounded-full">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {t.superuser}
                    </Badge>
                  ) : null}

                  {profile.is_staff ? (
                    <Badge variant="outline" className="rounded-full">
                      <UserRound className="h-3.5 w-3.5" />
                      {t.staff}
                    </Badge>
                  ) : null}

                  <Badge variant="outline" className="rounded-full">
                    <KeyRound className="h-3.5 w-3.5" />
                    {roleLabel(profile.role, locale)}
                  </Badge>
                </div>

                {visiblePermissions.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {visiblePermissions.map((permission) => (
                      <div
                        key={permission}
                        className="rounded-xl border bg-background/70 px-3 py-2 text-sm"
                        dir="ltr"
                      >
                        {permission}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-background/70 p-8 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      {t.noPermissions}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">
                  {t.quickActions}
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  <ShortcutCard
                    href="/system"
                    icon={<Building2 className="h-5 w-5" />}
                    title={t.dashboard}
                    description={t.dashboardDesc}
                  />

                  {canViewUsers ? (
                    <ShortcutCard
                      href="/system/users"
                      icon={<Users className="h-5 w-5" />}
                      title={t.users}
                      description={t.usersDesc}
                    />
                  ) : null}

                  {canViewSettings ? (
                    <ShortcutCard
                      href="/system/settings"
                      icon={<Settings className="h-5 w-5" />}
                      title={t.settings}
                      description={t.settingsDesc}
                    />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Small Components
============================================================ */

function InfoLine({
  icon,
  label,
  value,
  onCopy,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-medium">{value}</p>
        </div>
      </div>

      {onCopy ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-lg"
          onClick={onCopy}
        >
          <Copy className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  dir,
}: {
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <TableRow>
      <TableCell className="w-[220px] bg-muted/30 font-semibold">
        {label}
      </TableCell>
      <TableCell dir={dir}>{value}</TableCell>
    </TableRow>
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
        <CardContent className="flex h-full items-start gap-3 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {icon}
          </div>

          <div className="min-w-0">
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