"use client";

/* ============================================================
   📂 app/system/users/page.tsx
   🧠 Primey Care | System Users Overview

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
============================================================ */

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Download,
  Eye,
  FileText,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserCheck,
  UserCog,
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

type UserStatus = "ACTIVE" | "INACTIVE" | "PENDING" | "BLOCKED" | "UNKNOWN";

type UserRole =
  | "SYSTEM_ADMIN"
  | "PROVIDER_ADMIN"
  | "CUSTOMER_USER"
  | "AGENT_USER"
  | "ACCOUNTANT"
  | "SUPPORT"
  | "VIEWER"
  | "UNKNOWN";

type SystemUserRow = {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone: string;
  role: UserRole;
  user_type: string;
  workspace: string;
  status: UserStatus;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  permissions_count: number;
  last_login: string;
  date_joined: string;
  created_at: string;
};

type UsersSummary = {
  total_users: number;
  active_users: number;
  inactive_users: number;
  pending_users: number;
  blocked_users: number;
  system_admins: number;
  provider_admins: number;
  customer_users: number;
  agent_users: number;
  accountants: number;
  support_users: number;
  viewers: number;
  staff_users: number;
  superusers: number;
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
  users?: unknown[];
  summary?: Partial<UsersSummary>;
  stats?: Partial<UsersSummary>;
};

const DEFAULT_SUMMARY: UsersSummary = {
  total_users: 0,
  active_users: 0,
  inactive_users: 0,
  pending_users: 0,
  blocked_users: 0,
  system_admins: 0,
  provider_admins: 0,
  customer_users: 0,
  agent_users: 0,
  accountants: 0,
  support_users: 0,
  viewers: 0,
  staff_users: 0,
  superusers: 0,
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
    title: isArabic ? "مستخدمي النظام" : "System Users",
    subtitle: isArabic
      ? "لوحة متابعة مستخدمي النظام والأدوار والصلاحيات وحالة التفعيل."
      : "Overview for system users, roles, permissions, and account status.",

    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    usersList: isArabic ? "قائمة المستخدمين" : "Users List",
    createUser: isArabic ? "إنشاء مستخدم" : "Create User",

    totalUsers: isArabic ? "إجمالي المستخدمين" : "Total Users",
    activeUsers: isArabic ? "مستخدمون نشطون" : "Active Users",
    inactiveUsers: isArabic ? "غير نشطين" : "Inactive Users",
    pendingUsers: isArabic ? "بانتظار التفعيل" : "Pending Users",
    blockedUsers: isArabic ? "محظورون" : "Blocked Users",
    systemAdmins: isArabic ? "مدراء النظام" : "System Admins",
    providerAdmins: isArabic ? "مدراء مقدمي الخدمة" : "Provider Admins",
    customerUsers: isArabic ? "مستخدمو العملاء" : "Customer Users",
    agentUsers: isArabic ? "مستخدمو المندوبين" : "Agent Users",
    accountants: isArabic ? "المحاسبون" : "Accountants",
    supportUsers: isArabic ? "الدعم" : "Support",
    staffUsers: isArabic ? "طاقم داخلي" : "Staff Users",
    superusers: isArabic ? "صلاحية عليا" : "Superusers",

    shortcutsTitle: isArabic ? "اختصارات المستخدمين" : "User Shortcuts",
    shortcutsDesc: isArabic
      ? "الوصول السريع لقائمة المستخدمين أو إنشاء مستخدم بعد تنظيف السايدر."
      : "Quick access to user list and create page after sidebar cleanup.",

    latestTitle: isArabic ? "أحدث المستخدمين" : "Latest Users",
    latestDesc: isArabic
      ? "أحدث المستخدمين مع الدور والحالة والصلاحيات."
      : "Latest users with role, status, and permissions.",

    searchPlaceholder: isArabic
      ? "ابحث بالاسم أو اسم المستخدم أو البريد أو الجوال أو الدور..."
      : "Search by name, username, email, phone, or role...",

    table: {
      user: isArabic ? "المستخدم" : "User",
      username: isArabic ? "اسم المستخدم" : "Username",
      contact: isArabic ? "التواصل" : "Contact",
      role: isArabic ? "الدور" : "Role",
      workspace: isArabic ? "المساحة" : "Workspace",
      status: isArabic ? "الحالة" : "Status",
      permissions: isArabic ? "الصلاحيات" : "Permissions",
      lastLogin: isArabic ? "آخر دخول" : "Last Login",
      joinedAt: isArabic ? "تاريخ الانضمام" : "Joined At",
      action: isArabic ? "الإجراء" : "Action",
    },

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
    view: isArabic ? "عرض" : "View",

    emptyTitle: isArabic ? "لا توجد بيانات مستخدمين" : "No user data",
    emptyText: isArabic
      ? "ستظهر بيانات المستخدمين هنا بعد إنشاء أول مستخدم."
      : "User data will appear here after creating the first user.",
    noResultsTitle: isArabic ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث."
      : "Try changing your search terms.",

    accessDeniedTitle: isArabic
      ? "غير مصرح بعرض المستخدمين"
      : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض مستخدمي النظام. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view system users. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل بيانات المستخدمين."
      : "Unable to load users.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث بيانات المستخدمين."
      : "Users refreshed.",

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

  for (const container of ["user", "account", "profile", "data", "stats"]) {
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

  if (Array.isArray(data[key])) return data[key] as unknown[];
  if (Array.isArray(data.results)) return data.results as unknown[];
  if (Array.isArray(data.items)) return data.items as unknown[];
  if (Array.isArray(data.rows)) return data.rows as unknown[];

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
  } as Partial<UsersSummary>;
}

function normalizeStatus(value: unknown, isActive: boolean): UserStatus {
  const clean = String(value || "").toUpperCase();

  if (["ACTIVE", "ENABLED", "APPROVED"].includes(clean)) return "ACTIVE";
  if (["INACTIVE", "DISABLED"].includes(clean)) return "INACTIVE";
  if (["PENDING", "INVITED", "NEW"].includes(clean)) return "PENDING";
  if (["BLOCKED", "SUSPENDED", "BANNED"].includes(clean)) return "BLOCKED";

  return isActive ? "ACTIVE" : "INACTIVE";
}

function normalizeRole(value: unknown): UserRole {
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

function normalizeUser(item: unknown, index: number): SystemUserRow {
  const obj = asDict(item);

  const isActive = Boolean(
    getNestedValue(obj, ["is_active", "active", "isActive"]) ?? true,
  );

  const roleValue =
    getNestedValue(obj, ["role", "user_role", "user_type", "type"]) || "";

  const permissionsValue = getNestedValue(obj, [
    "permissions_count",
    "permission_count",
  ]);

  const permissionsArray = getNestedValue(obj, [
    "permission_codes",
    "permissions",
    "profile_permissions",
  ]);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    full_name: String(
      getNestedValue(obj, ["full_name", "name", "display_name"]) || "-",
    ),
    username: String(getNestedValue(obj, ["username", "login"]) || "-"),
    email: String(getNestedValue(obj, ["email"]) || ""),
    phone: String(getNestedValue(obj, ["phone", "mobile", "phone_number"]) || ""),
    role: normalizeRole(roleValue),
    user_type: String(getNestedValue(obj, ["user_type", "type"]) || ""),
    workspace: String(getNestedValue(obj, ["workspace", "space"]) || ""),
    status: normalizeStatus(getNestedValue(obj, ["status", "state"]), isActive),
    is_active: isActive,
    is_staff: Boolean(getNestedValue(obj, ["is_staff", "staff", "isStaff"])),
    is_superuser: Boolean(
      getNestedValue(obj, ["is_superuser", "superuser", "isSuperuser"]),
    ),
    permissions_count: Array.isArray(permissionsArray)
      ? permissionsArray.length
      : toNumber(permissionsValue),
    last_login: String(getNestedValue(obj, ["last_login", "lastLogin"]) || ""),
    date_joined: String(
      getNestedValue(obj, ["date_joined", "joined_at", "created_at"]) || "",
    ),
    created_at: String(getNestedValue(obj, ["created_at", "created"]) || ""),
  };
}

function buildSummary(
  rows: SystemUserRow[],
  apiSummary?: Partial<UsersSummary>,
): UsersSummary {
  const fallback: UsersSummary = {
    total_users: rows.length,
    active_users: rows.filter((item) => item.status === "ACTIVE").length,
    inactive_users: rows.filter((item) => item.status === "INACTIVE").length,
    pending_users: rows.filter((item) => item.status === "PENDING").length,
    blocked_users: rows.filter((item) => item.status === "BLOCKED").length,
    system_admins: rows.filter((item) => item.role === "SYSTEM_ADMIN").length,
    provider_admins: rows.filter((item) => item.role === "PROVIDER_ADMIN").length,
    customer_users: rows.filter((item) => item.role === "CUSTOMER_USER").length,
    agent_users: rows.filter((item) => item.role === "AGENT_USER").length,
    accountants: rows.filter((item) => item.role === "ACCOUNTANT").length,
    support_users: rows.filter((item) => item.role === "SUPPORT").length,
    viewers: rows.filter((item) => item.role === "VIEWER").length,
    staff_users: rows.filter((item) => item.is_staff).length,
    superusers: rows.filter((item) => item.is_superuser).length,
  };

  const api = asDict(apiSummary);

  return {
    total_users:
      toNumber(api.total_users) ||
      toNumber(api.users_count) ||
      toNumber(api.count) ||
      fallback.total_users,
    active_users: toNumber(api.active_users) || fallback.active_users,
    inactive_users: toNumber(api.inactive_users) || fallback.inactive_users,
    pending_users: toNumber(api.pending_users) || fallback.pending_users,
    blocked_users: toNumber(api.blocked_users) || fallback.blocked_users,
    system_admins: toNumber(api.system_admins) || fallback.system_admins,
    provider_admins: toNumber(api.provider_admins) || fallback.provider_admins,
    customer_users: toNumber(api.customer_users) || fallback.customer_users,
    agent_users: toNumber(api.agent_users) || fallback.agent_users,
    accountants: toNumber(api.accountants) || fallback.accountants,
    support_users: toNumber(api.support_users) || fallback.support_users,
    viewers: toNumber(api.viewers) || fallback.viewers,
    staff_users: toNumber(api.staff_users) || fallback.staff_users,
    superusers: toNumber(api.superusers) || fallback.superusers,
  };
}

function statusLabel(status: UserStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<UserStatus, string> = {
    ACTIVE: t.active,
    INACTIVE: t.inactive,
    PENDING: t.pending,
    BLOCKED: t.blocked,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function roleLabel(role: UserRole, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<UserRole, string> = {
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

function statusBadge(status: UserStatus, locale: AppLocale) {
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
  summary: UsersSummary;
  rows: SystemUserRow[];
}) {
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";
  const t = dictionary(locale);

  const rowsHtml = rows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.full_name)}</td>
          <td>${escapeHtml(item.username)}</td>
          <td>${escapeHtml(item.email || "-")}</td>
          <td>${escapeHtml(item.phone || "-")}</td>
          <td>${escapeHtml(roleLabel(item.role, locale))}</td>
          <td>${escapeHtml(item.workspace || "-")}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(formatNumber(item.permissions_count))}</td>
          <td>${escapeHtml(item.is_staff ? t.staff : "-")}</td>
          <td>${escapeHtml(item.is_superuser ? t.superuser : "-")}</td>
          <td>${escapeHtml(formatDate(item.last_login, locale))}</td>
          <td>${escapeHtml(formatDate(item.date_joined, locale))}</td>
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
          <tr><td class="title" colspan="12">${escapeHtml(title)}</td></tr>
          <tr><td colspan="12"></td></tr>
          <tr><td class="section" colspan="12">${escapeHtml(t.generatedAt)}: ${escapeHtml(new Date().toLocaleString("en-US"))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalUsers)}</td><td colspan="11">${escapeHtml(formatNumber(summary.total_users))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.activeUsers)}</td><td colspan="11">${escapeHtml(formatNumber(summary.active_users))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.systemAdmins)}</td><td colspan="11">${escapeHtml(formatNumber(summary.system_admins))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.staffUsers)}</td><td colspan="11">${escapeHtml(formatNumber(summary.staff_users))}</td></tr>

          <tr><td colspan="12"></td></tr>
          <tr>
            <th>${escapeHtml(t.table.user)}</th>
            <th>${escapeHtml(t.table.username)}</th>
            <th>${escapeHtml("Email")}</th>
            <th>${escapeHtml("Phone")}</th>
            <th>${escapeHtml(t.table.role)}</th>
            <th>${escapeHtml(t.table.workspace)}</th>
            <th>${escapeHtml(t.table.status)}</th>
            <th>${escapeHtml(t.table.permissions)}</th>
            <th>${escapeHtml(t.staff)}</th>
            <th>${escapeHtml(t.superuser)}</th>
            <th>${escapeHtml(t.table.lastLogin)}</th>
            <th>${escapeHtml(t.table.joinedAt)}</th>
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
  summary: UsersSummary;
  rows: SystemUserRow[];
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);

  const tableRows = rows
    .slice(0, 40)
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.full_name)}</td>
          <td>${escapeHtml(item.username)}</td>
          <td>${escapeHtml(roleLabel(item.role, locale))}</td>
          <td>${escapeHtml(statusLabel(item.status, locale))}</td>
          <td>${escapeHtml(formatNumber(item.permissions_count))}</td>
          <td>${escapeHtml(formatDate(item.last_login, locale))}</td>
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
          <div class="box"><span>${escapeHtml(t.totalUsers)}</span><strong>${escapeHtml(formatNumber(summary.total_users))}</strong></div>
          <div class="box"><span>${escapeHtml(t.activeUsers)}</span><strong>${escapeHtml(formatNumber(summary.active_users))}</strong></div>
          <div class="box"><span>${escapeHtml(t.systemAdmins)}</span><strong>${escapeHtml(formatNumber(summary.system_admins))}</strong></div>
          <div class="box"><span>${escapeHtml(t.staffUsers)}</span><strong>${escapeHtml(formatNumber(summary.staff_users))}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t.table.user)}</th>
              <th>${escapeHtml(t.table.username)}</th>
              <th>${escapeHtml(t.table.role)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.permissions)}</th>
              <th>${escapeHtml(t.table.lastLogin)}</th>
            </tr>
          </thead>
          <tbody>${tableRows || `<tr><td colspan="6">${escapeHtml(t.emptyTitle)}</td></tr>`}</tbody>
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

export default function SystemUsersPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<SystemUserRow[]>([]);
  const [summary, setSummary] = useState<UsersSummary>(DEFAULT_SUMMARY);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasAnyPermission(auth, ["users.view", "users.list"], "view");
  const canCreate = hasAnyPermission(auth, ["users.create"], "action");

  const canExport = hasAnyPermission(
    auth,
    ["users.export", "reports.export"],
    "action",
  );

  const canPrint = hasAnyPermission(
    auth,
    ["users.print", "reports.print"],
    "action",
  );

  const canViewDetails = hasAnyPermission(auth, ["users.view"], "view");

  const filteredRows = useMemo(() => {
    const clean = query.trim().toLowerCase();

    const sorted = [...rows].sort((a, b) =>
      String(b.created_at || b.date_joined).localeCompare(
        String(a.created_at || a.date_joined),
      ),
    );

    if (!clean) return sorted.slice(0, 12);

    return sorted
      .filter((item) =>
        [
          item.full_name,
          item.username,
          item.email,
          item.phone,
          item.user_type,
          item.workspace,
          roleLabel(item.role, locale),
          statusLabel(item.status, locale),
        ]
          .join(" ")
          .toLowerCase()
          .includes(clean),
      )
      .slice(0, 12);
  }, [locale, query, rows]);

  const activeSummary = useMemo(() => buildSummary(filteredRows), [filteredRows]);

  const displaySummary = query.trim() ? activeSummary : summary;
  const hasData = rows.length > 0;
  const hasSearch = query.trim().length > 0;

  const loadUsers = useCallback(
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
          "/api/users/list/?page_size=500",
          "/api/users/?page_size=500",
        ]);

        if (!payload) {
          throw new Error(t.loadError);
        }

        const normalizedRows = extractRows(payload, "users")
          .map(normalizeUser)
          .filter((item) => item.id || item.username || item.email);

        setRows(normalizedRows);
        setSummary(buildSummary(normalizedRows, extractSummary(payload)));

        if (showToast) toast.success(t.loadSuccess);
      } catch (error) {
        console.error("Users overview load error:", error);
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
      filename: `primey-care-users-${new Date().toISOString().slice(0, 10)}.xls`,
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
    loadUsers(false);
  }, [authResolving, loadUsers]);

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
            onClick={() => loadUsers(true)}
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
              onClick={() => loadUsers(true)}
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
              title={t.totalUsers}
              value={formatNumber(displaySummary.total_users)}
              icon={<Users className="h-5 w-5" />}
            />
            <KpiCard
              title={t.activeUsers}
              value={formatNumber(displaySummary.active_users)}
              icon={<UserCheck className="h-5 w-5" />}
            />
            <KpiCard
              title={t.systemAdmins}
              value={formatNumber(displaySummary.system_admins)}
              icon={<ShieldCheck className="h-5 w-5" />}
            />
            <KpiCard
              title={t.staffUsers}
              value={formatNumber(displaySummary.staff_users)}
              icon={<UserCog className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MiniStat title={t.providerAdmins} value={displaySummary.provider_admins} />
            <MiniStat title={t.customerUsers} value={displaySummary.customer_users} />
            <MiniStat title={t.agentUsers} value={displaySummary.agent_users} />
            <MiniStat title={t.pendingUsers} value={displaySummary.pending_users} />
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
                <Link href="/system/users/list">
                  <Card className="h-full rounded-2xl border bg-background/70 shadow-sm transition hover:bg-muted/40">
                    <CardContent className="flex h-full items-start gap-3 p-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <FileText className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold">{t.usersList}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {isArabic
                            ? "عرض المستخدمين مع البحث والفلاتر والإجراءات."
                            : "Open users with search, filters, and actions."}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {canCreate ? (
                  <Link href="/system/users/create">
                    <Card className="h-full rounded-2xl border bg-background/70 shadow-sm transition hover:bg-muted/40">
                      <CardContent className="flex h-full items-start gap-3 p-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <PlusCircle className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold">{t.createUser}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {isArabic
                              ? "إضافة مستخدم جديد وتحديد الدور والصلاحيات."
                              : "Add a new user and assign role and permissions."}
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
                <Users className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-semibold">{t.emptyTitle}</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  {t.emptyText}
                </p>

                {canCreate ? (
                  <Link href="/system/users/create">
                    <Button className="mt-2 rounded-xl">
                      <PlusCircle className="h-4 w-4" />
                      {t.createUser}
                    </Button>
                  </Link>
                ) : null}
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

                <Link href="/system/users/list">
                  <Button variant="outline" className="h-10 rounded-xl">
                    <ArrowUpRight className="h-4 w-4" />
                    {t.usersList}
                  </Button>
                </Link>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-hidden rounded-xl border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[230px]">
                          {t.table.user}
                        </TableHead>
                        <TableHead className="min-w-[140px]">
                          {t.table.username}
                        </TableHead>
                        <TableHead className="min-w-[190px]">
                          {t.table.contact}
                        </TableHead>
                        <TableHead className="min-w-[150px]">
                          {t.table.role}
                        </TableHead>
                        <TableHead className="min-w-[130px]">
                          {t.table.status}
                        </TableHead>
                        <TableHead className="min-w-[110px]">
                          {t.table.permissions}
                        </TableHead>
                        <TableHead className="min-w-[130px]">
                          {t.table.lastLogin}
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
                          <TableRow key={`${item.id}-${item.username}`}>
                            <TableCell>
                              <div className="min-w-[210px]">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold">{item.full_name}</p>

                                  {item.is_superuser ? (
                                    <Badge variant="outline" className="rounded-full">
                                      <ShieldCheck className="h-3 w-3" />
                                      {t.superuser}
                                    </Badge>
                                  ) : null}

                                  {item.is_staff ? (
                                    <Badge variant="outline" className="rounded-full">
                                      <BadgeCheck className="h-3 w-3" />
                                      {t.staff}
                                    </Badge>
                                  ) : null}
                                </div>

                                <p className="mt-1 text-xs text-muted-foreground">
                                  {item.workspace || item.user_type || "-"}
                                </p>
                              </div>
                            </TableCell>

                            <TableCell className="font-medium" dir="ltr">
                              {item.username}
                            </TableCell>

                            <TableCell>
                              <div className="min-w-[170px]">
                                <p
                                  className="inline-flex items-center gap-1.5 text-sm"
                                  dir="ltr"
                                >
                                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                  {item.email || "-"}
                                </p>

                                <p
                                  className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                                  dir="ltr"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                  {item.phone || "-"}
                                </p>
                              </div>
                            </TableCell>

                            <TableCell>
                              <Badge variant="outline" className="rounded-full">
                                <KeyRound className="h-3 w-3" />
                                {roleLabel(item.role, locale)}
                              </Badge>
                            </TableCell>

                            <TableCell>{statusBadge(item.status, locale)}</TableCell>

                            <TableCell>
                              {formatNumber(item.permissions_count)}
                            </TableCell>

                            <TableCell>
                              {formatDate(item.last_login, locale)}
                            </TableCell>

                            {canViewDetails ? (
                              <TableCell>
                                {isValidId(item.id) ? (
                                  <Link href={`/system/users/${item.id}`}>
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
                            colSpan={canViewDetails ? 8 : 7}
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

  console.warn("Users endpoint fallback failed:", lastError);
  return null;
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