"use client";

/* ============================================================
   📂 app/system/users/[id]/page.tsx
   🧠 Primey Care | System User Details
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ مبني بنفس نمط تفاصيل المراكز/العملاء المعتمد
   ✅ Side Profile Card + Main Content
   ✅ Error State مستقل عن Not Found
   ✅ Skeleton Loading
   ✅ Web PDF Print
   ✅ تفعيل / تعطيل المستخدم حسب الصلاحية
   ✅ إرسال رابط كلمة المرور حسب الصلاحية
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
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  Eye,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Printer,
  RefreshCcw,
  Send,
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
type AuthRecord = Record<string, unknown>;

type UserStatus = "ACTIVE" | "INACTIVE" | "PENDING" | "UNKNOWN";

type UserRole =
  | "SYSTEM_ADMIN"
  | "PROVIDER_ADMIN"
  | "CUSTOMER_USER"
  | "AGENT_USER"
  | "ACCOUNTANT"
  | "SUPPORT"
  | "VIEWER"
  | "UNKNOWN";

type SystemUserDetail = {
  id: number | string;
  fullName: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  role: UserRole;
  userType: string;
  workspace: string;
  status: UserStatus;
  isActive: boolean;
  isStaff: boolean;
  isSuperuser: boolean;
  permissions: string[];
  permissionsCount: number;
  profilePermissions: string[];
  lastLogin: string;
  dateJoined: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  raw: Record<string, unknown>;
};

type UserDetailResponse = {
  ok?: boolean;
  message?: string;
  data?: unknown;
  user?: unknown;
  item?: unknown;
};

type ActionResponse = {
  ok?: boolean;
  message?: string;
  data?: unknown;
  user?: unknown;
};

const USER_DETAIL_ENDPOINTS = ["/api/users"];

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
      ["system_admin", "superuser", "super_admin"].includes(role),
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

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;

  const clean = String(value || "").toLowerCase();

  return ["1", "true", "yes", "active", "enabled"].includes(clean);
}

function normalizeStatus(value: unknown, isActive?: unknown): UserStatus {
  const status = String(value || "").toUpperCase();

  if (status === "ACTIVE") return "ACTIVE";
  if (status === "INACTIVE" || status === "DISABLED") return "INACTIVE";
  if (status === "PENDING") return "PENDING";

  if (typeof isActive === "boolean") {
    return isActive ? "ACTIVE" : "INACTIVE";
  }

  return "UNKNOWN";
}

function normalizeRole(value: unknown): UserRole {
  const role = String(value || "").toUpperCase();

  if (["SYSTEM_ADMIN", "SUPERUSER", "SUPER_ADMIN", "ADMIN"].includes(role)) {
    return "SYSTEM_ADMIN";
  }

  if (["PROVIDER_ADMIN", "CENTER_ADMIN", "COMPANY_ADMIN"].includes(role)) {
    return "PROVIDER_ADMIN";
  }

  if (["CUSTOMER_USER", "CUSTOMER"].includes(role)) return "CUSTOMER_USER";
  if (["AGENT_USER", "AGENT"].includes(role)) return "AGENT_USER";
  if (role === "ACCOUNTANT") return "ACCOUNTANT";
  if (role === "SUPPORT") return "SUPPORT";
  if (role === "VIEWER") return "VIEWER";

  return "UNKNOWN";
}

function getObjectValue(obj: Record<string, unknown>, key: string): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  const containers = ["user", "profile", "account", "data", "item"];

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

function normalizePermissionCodes(value: unknown): string[] {
  return uniqueStrings([value]);
}

function unwrapUser(payload: unknown): Record<string, unknown> {
  const wrapper = (payload || {}) as UserDetailResponse;
  const value = wrapper.data || wrapper.user || wrapper.item || payload || {};

  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return {};
}

function normalizeUserDetail(payload: unknown): SystemUserDetail {
  const obj = unwrapUser(payload);

  const id = getObjectValue(obj, "id") ?? "";
  const firstName = String(getObjectValue(obj, "first_name") ?? "");
  const lastName = String(getObjectValue(obj, "last_name") ?? "");

  const roleRaw =
    getObjectValue(obj, "role") ??
    getObjectValue(obj, "user_role") ??
    getObjectValue(obj, "user_type") ??
    getObjectValue(obj, "type");

  const isActiveRaw = getObjectValue(obj, "is_active");

  const permissions = normalizePermissionCodes(
    getObjectValue(obj, "permission_codes") ??
      getObjectValue(obj, "permissions") ??
      getObjectValue(obj, "codes"),
  );

  const profilePermissions = normalizePermissionCodes(
    getObjectValue(obj, "profile_permissions"),
  );

  return {
    id: id as number | string,
    fullName: String(
      getObjectValue(obj, "full_name") ||
        getObjectValue(obj, "name") ||
        `${firstName} ${lastName}`.trim() ||
        getObjectValue(obj, "username") ||
        getObjectValue(obj, "email") ||
        "-",
    ),
    firstName,
    lastName,
    username: String(getObjectValue(obj, "username") ?? "-"),
    email: String(getObjectValue(obj, "email") ?? ""),
    phone: String(
      getObjectValue(obj, "phone") ??
        getObjectValue(obj, "mobile") ??
        getObjectValue(obj, "mobile_number") ??
        "",
    ),
    role: normalizeRole(roleRaw),
    userType: String(getObjectValue(obj, "user_type") ?? roleRaw ?? "-"),
    workspace: String(getObjectValue(obj, "workspace") ?? "-"),
    status: normalizeStatus(getObjectValue(obj, "status"), isActiveRaw),
    isActive: toBoolean(isActiveRaw),
    isStaff: toBoolean(getObjectValue(obj, "is_staff")),
    isSuperuser: toBoolean(getObjectValue(obj, "is_superuser")),
    permissions,
    permissionsCount: permissions.length || profilePermissions.length,
    profilePermissions,
    lastLogin: String(getObjectValue(obj, "last_login") ?? ""),
    dateJoined: String(getObjectValue(obj, "date_joined") ?? ""),
    createdAt: String(
      getObjectValue(obj, "created_at") ??
        getObjectValue(obj, "date_joined") ??
        "",
    ),
    updatedAt: String(getObjectValue(obj, "updated_at") ?? ""),
    notes: String(getObjectValue(obj, "notes") ?? ""),
    raw: obj,
  };
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "تفاصيل مستخدم النظام" : "System User Details",
    subtitle: isArabic
      ? "عرض بيانات المستخدم، الدور، مساحة العمل، حالة الحساب، الصلاحيات، وسجل الدخول."
      : "View user data, role, workspace, account status, permissions, and login history.",

    back: isArabic ? "مستخدمو النظام" : "System Users",
    list: isArabic ? "قائمة المستخدمين" : "Users List",
    refresh: isArabic ? "تحديث" : "Refresh",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    activate: isArabic ? "تفعيل المستخدم" : "Activate User",
    deactivate: isArabic ? "تعطيل المستخدم" : "Deactivate User",
    sendPasswordLink: isArabic ? "إرسال رابط كلمة المرور" : "Send Password Link",
    activating: isArabic ? "جاري التفعيل..." : "Activating...",
    deactivating: isArabic ? "جاري التعطيل..." : "Deactivating...",
    sending: isArabic ? "جاري الإرسال..." : "Sending...",
    copy: isArabic ? "نسخ" : "Copy",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    overview: isArabic ? "نظرة عامة" : "Overview",
    overviewDesc: isArabic
      ? "بيانات الحساب الأساسية والحالة التشغيلية."
      : "Basic account data and operational status.",

    account: isArabic ? "بيانات الحساب" : "Account Information",
    accountDesc: isArabic
      ? "اسم المستخدم والبريد والجوال والدور ومساحة العمل."
      : "Username, email, phone, role, and workspace.",

    access: isArabic ? "الصلاحيات والوصول" : "Permissions & Access",
    accessDesc: isArabic
      ? "صلاحيات المستخدم ومؤشرات الوصول داخل النظام."
      : "User permissions and access indicators inside the system.",

    dates: isArabic ? "التواريخ" : "Dates",
    datesDesc: isArabic
      ? "تاريخ إنشاء الحساب وآخر دخول وآخر تحديث."
      : "Account creation, last login, and last update dates.",

    notes: isArabic ? "الملاحظات" : "Notes",
    notesDesc: isArabic
      ? "ملاحظات داخلية مرتبطة بحساب المستخدم."
      : "Internal notes linked to this user account.",

    quickInfo: isArabic ? "معلومات سريعة" : "Quick Info",
    permissionsList: isArabic ? "قائمة الصلاحيات" : "Permissions List",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تفاصيل المستخدمين. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view user details. Contact your system administrator if you need access.",

    notFoundTitle: isArabic ? "المستخدم غير موجود" : "User not found",
    notFoundText: isArabic
      ? "لم يتم العثور على المستخدم المطلوب أو قد يكون غير متاح."
      : "The requested user could not be found or may not be available.",

    loadError: isArabic
      ? "تعذر تحميل تفاصيل المستخدم."
      : "Unable to load user details.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث تفاصيل المستخدم بنجاح."
      : "User details refreshed successfully.",
    printReady: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",
    activateSuccess: isArabic
      ? "تم تفعيل المستخدم بنجاح."
      : "User activated successfully.",
    deactivateSuccess: isArabic
      ? "تم تعطيل المستخدم بنجاح."
      : "User deactivated successfully.",
    passwordLinkSuccess: isArabic
      ? "تم إرسال رابط كلمة المرور بنجاح."
      : "Password link sent successfully.",
    actionError: isArabic
      ? "تعذر تنفيذ الإجراء المطلوب."
      : "Unable to complete the requested action.",
    confirmActivate: isArabic
      ? "هل تريد تفعيل هذا المستخدم؟"
      : "Do you want to activate this user?",
    confirmDeactivate: isArabic
      ? "هل تريد تعطيل هذا المستخدم؟"
      : "Do you want to deactivate this user?",
    confirmSendPassword: isArabic
      ? "هل تريد إرسال رابط كلمة المرور لهذا المستخدم؟"
      : "Do you want to send a password link to this user?",

    fields: {
      id: isArabic ? "المعرف" : "ID",
      fullName: isArabic ? "الاسم الكامل" : "Full Name",
      firstName: isArabic ? "الاسم الأول" : "First Name",
      lastName: isArabic ? "اسم العائلة" : "Last Name",
      username: isArabic ? "اسم المستخدم" : "Username",
      email: isArabic ? "البريد الإلكتروني" : "Email",
      phone: isArabic ? "الجوال" : "Phone",
      role: isArabic ? "الدور" : "Role",
      userType: isArabic ? "نوع المستخدم" : "User Type",
      workspace: isArabic ? "مساحة العمل" : "Workspace",
      status: isArabic ? "الحالة" : "Status",
      isActive: isArabic ? "الحساب نشط" : "Active Account",
      isStaff: isArabic ? "مستخدم إداري" : "Staff User",
      isSuperuser: isArabic ? "صلاحية عليا" : "Superuser",
      permissions: isArabic ? "الصلاحيات" : "Permissions",
      permissionsCount: isArabic ? "عدد الصلاحيات" : "Permissions Count",
      lastLogin: isArabic ? "آخر دخول" : "Last Login",
      dateJoined: isArabic ? "تاريخ الانضمام" : "Date Joined",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isArabic ? "آخر تحديث" : "Updated At",
      notes: isArabic ? "الملاحظات" : "Notes",
    },

    statuses: {
      ACTIVE: isArabic ? "نشط" : "Active",
      INACTIVE: isArabic ? "غير نشط" : "Inactive",
      PENDING: isArabic ? "بانتظار التفعيل" : "Pending",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<UserStatus, string>,

    roles: {
      SYSTEM_ADMIN: isArabic ? "مدير النظام" : "System Admin",
      PROVIDER_ADMIN: isArabic ? "مدير مقدم خدمة" : "Provider Admin",
      CUSTOMER_USER: isArabic ? "مستخدم عميل" : "Customer User",
      AGENT_USER: isArabic ? "مندوب" : "Agent User",
      ACCOUNTANT: isArabic ? "محاسب" : "Accountant",
      SUPPORT: isArabic ? "دعم" : "Support",
      VIEWER: isArabic ? "مشاهد" : "Viewer",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<UserRole, string>,

    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",
    empty: isArabic ? "لا توجد بيانات" : "No data",
    noPermissions: isArabic ? "لا توجد صلاحيات مسجلة" : "No permissions recorded",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
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

function isValidId(id: unknown) {
  const value = String(id || "").trim();

  return value.length > 0 && value !== "-" && value !== "undefined";
}

function statusLabel(status: UserStatus, locale: AppLocale) {
  return dictionary(locale).statuses[status];
}

function roleLabel(role: UserRole, locale: AppLocale) {
  return dictionary(locale).roles[role];
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
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "INACTIVE") {
    return (
      <Badge variant="outline" className="rounded-full px-3 py-1">
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

function roleBadge(role: UserRole, locale: AppLocale) {
  if (role === "SYSTEM_ADMIN") {
    return (
      <Badge className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
        {roleLabel(role, locale)}
      </Badge>
    );
  }

  if (role === "ACCOUNTANT" || role === "SUPPORT") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {roleLabel(role, locale)}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="rounded-full px-3 py-1">
      {roleLabel(role, locale)}
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
  user,
  t,
}: {
  locale: AppLocale;
  user: SystemUserDetail;
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const rows: Array<[string, string]> = [
    [t.fields.id, String(user.id)],
    [t.fields.fullName, user.fullName],
    [t.fields.username, user.username],
    [t.fields.email, user.email || "-"],
    [t.fields.phone, user.phone || "-"],
    [t.fields.role, roleLabel(user.role, locale)],
    [t.fields.userType, user.userType || "-"],
    [t.fields.workspace, user.workspace || "-"],
    [t.fields.status, statusLabel(user.status, locale)],
    [t.fields.isActive, user.isActive ? t.yes : t.no],
    [t.fields.isStaff, user.isStaff ? t.yes : t.no],
    [t.fields.isSuperuser, user.isSuperuser ? t.yes : t.no],
    [t.fields.permissionsCount, formatNumber(user.permissionsCount)],
    [t.fields.lastLogin, formatDate(user.lastLogin)],
    [t.fields.dateJoined, formatDate(user.dateJoined)],
    [t.fields.createdAt, formatDate(user.createdAt)],
    [t.fields.updatedAt, formatDate(user.updatedAt)],
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
            <h1>${escapeHtml(user.fullName)}</h1>
            <div class="meta">
              <div>${escapeHtml(t.fields.email)}: ${escapeHtml(user.email || "-")}</div>
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

        <div class="section-title">${escapeHtml(t.fields.permissions)}</div>
        <div class="text-block">${escapeHtml(user.permissions.join("\\n") || "-")}</div>

        <div class="section-title">${escapeHtml(t.fields.notes)}</div>
        <div class="text-block">${escapeHtml(user.notes || "-")}</div>

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

export default function SystemUserDetailsPage() {
  const params = useParams();
  const auth = useAuth() as unknown;

  const userId = String(params?.id || "");

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [user, setUser] = useState<SystemUserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<
    "activate" | "deactivate" | "password" | ""
  >("");
  const [errorMessage, setErrorMessage] = useState("");
  const [notFound, setNotFound] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canViewUsers = hasSafePermission(
    auth,
    ["users.view", "users.detail", "users.list", "system.users.view"],
    "view",
  );

  const canViewUsersList = hasSafePermission(
    auth,
    ["users.view", "users.list", "system.users.view"],
    "view",
  );

  const canPrintUsers = hasSafePermission(
    auth,
    ["users.print", "system.users.print", "reports.print"],
    "action",
  );

  const canActivateUsers = hasSafePermission(
    auth,
    ["users.activate", "system.users.activate"],
    "action",
  );

  const canDeactivateUsers = hasSafePermission(
    auth,
    ["users.deactivate", "system.users.deactivate"],
    "action",
  );

  const canSendPasswordLink = hasSafePermission(
    auth,
    ["users.password_link", "users.send_password_link", "system.users.password_link"],
    "action",
  );

  const canActivateCurrentUser =
    Boolean(user) && canActivateUsers && user?.status !== "ACTIVE";

  const canDeactivateCurrentUser =
    Boolean(user) && canDeactivateUsers && user?.status === "ACTIVE";

  const loadUser = useCallback(
    async (showToast = false) => {
      if (!canViewUsers) {
        setIsLoading(false);
        setUser(null);
        return;
      }

      if (!isValidId(userId)) {
        setIsLoading(false);
        setUser(null);
        setNotFound(true);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        setNotFound(false);

        let loadedPayload: UserDetailResponse | null = null;
        let loaded = false;
        let found404 = false;

        for (const endpoint of USER_DETAIL_ENDPOINTS) {
          const response = await fetch(
            apiUrl(`${endpoint}/${encodeURIComponent(userId)}/`),
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
            | UserDetailResponse
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
            setUser(null);
            setNotFound(true);
            return;
          }

          throw new Error(loadedPayload?.message || "Unable to load user");
        }

        const normalized = normalizeUserDetail(loadedPayload);

        if (!isValidId(normalized.id)) {
          setUser(null);
          setNotFound(true);
          return;
        }

        setUser(normalized);

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load user details:", error);
        setUser(null);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewUsers, t.loadError, t.refreshSuccess, userId],
  );

  async function postUserAction(action: "activate" | "deactivate" | "password") {
    if (!user) return;

    const confirmMessage =
      action === "activate"
        ? t.confirmActivate
        : action === "deactivate"
          ? t.confirmDeactivate
          : t.confirmSendPassword;

    if (!window.confirm(confirmMessage)) return;

    const actionPath =
      action === "activate"
        ? "activate"
        : action === "deactivate"
          ? "deactivate"
          : "send-password-link";

    try {
      setIsActionLoading(action);

      const csrfToken = readCookie("csrftoken");

      const response = await fetch(
        apiUrl(`/api/users/${encodeURIComponent(String(user.id))}/${actionPath}/`),
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
          },
          body: JSON.stringify({}),
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | ActionResponse
        | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      if (action === "activate") {
        toast.success(t.activateSuccess);
      } else if (action === "deactivate") {
        toast.success(t.deactivateSuccess);
      } else {
        toast.success(t.passwordLinkSuccess);
      }

      await loadUser(false);
    } catch (error) {
      console.error("User action error:", error);
      toast.error(t.actionError);
    } finally {
      setIsActionLoading("");
    }
  }

  function printUser() {
    if (!canPrintUsers || !user) return;

    const printWindow = window.open("", "_blank", "width=1000,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        locale,
        user,
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
    loadUser(false);
  }, [authResolving, loadUser]);

  if (!authResolving && !canViewUsers) {
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
            {user?.fullName || t.title}
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/system/users">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          {canViewUsersList ? (
            <Link href="/system/users">
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
            onClick={() => loadUser(true)}
            disabled={isLoading || Boolean(isActionLoading)}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canPrintUsers && user ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printUser}
              disabled={
                isLoading ||
                Boolean(errorMessage) ||
                notFound ||
                Boolean(isActionLoading)
              }
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}

          {canSendPasswordLink && user ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={() => postUserAction("password")}
              disabled={Boolean(isActionLoading)}
            >
              {isActionLoading === "password" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>
                {isActionLoading === "password" ? t.sending : t.sendPasswordLink}
              </span>
            </Button>
          ) : null}

          {canActivateCurrentUser ? (
            <Button
              className="h-10 rounded-xl"
              onClick={() => postUserAction("activate")}
              disabled={Boolean(isActionLoading)}
            >
              {isActionLoading === "activate" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>
                {isActionLoading === "activate" ? t.activating : t.activate}
              </span>
            </Button>
          ) : null}

          {canDeactivateCurrentUser ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => postUserAction("deactivate")}
              disabled={Boolean(isActionLoading)}
            >
              {isActionLoading === "deactivate" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span>
                {isActionLoading === "deactivate"
                  ? t.deactivating
                  : t.deactivate}
              </span>
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
              onClick={() => loadUser(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && notFound ? (
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Users className="h-7 w-7 text-muted-foreground" />
            </div>

            <div>
              <p className="text-lg font-semibold">{t.notFoundTitle}</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {t.notFoundText}
              </p>
            </div>

            {canViewUsersList ? (
              <Link href="/system/users">
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

      {!isLoading && !errorMessage && user && !notFound ? (
        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          {/* Side Profile */}
          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="space-y-5 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border bg-muted">
                    {user.isSuperuser ? (
                      <ShieldCheck className="h-8 w-8" />
                    ) : (
                      <UserRound className="h-8 w-8" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold">{user.fullName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {user.email || user.username || "-"}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {statusBadge(user.status, locale)}
                      {roleBadge(user.role, locale)}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.fields.permissionsCount}
                  </p>

                  <p className="mt-1 text-2xl font-bold">
                    {formatNumber(user.permissionsCount)}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {user.isStaff ? (
                      <Badge variant="outline" className="rounded-full">
                        {t.fields.isStaff}
                      </Badge>
                    ) : null}

                    {user.isSuperuser ? (
                      <Badge variant="outline" className="rounded-full">
                        {t.fields.isSuperuser}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() => copyToClipboard(user.fullName, t.copied)}
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy} {t.fields.fullName}
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() => copyToClipboard(String(user.id), t.copied)}
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy} {t.fields.id}
                  </Button>

                  {user.email ? (
                    <Button
                      variant="outline"
                      className="justify-start rounded-xl"
                      onClick={() => copyToClipboard(user.email, t.copied)}
                    >
                      <Copy className="h-4 w-4" />
                      {t.copy} {t.fields.email}
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
                  icon={Mail}
                  label={t.fields.email}
                  value={user.email || "-"}
                />

                <QuickInfoItem
                  icon={Phone}
                  label={t.fields.phone}
                  value={user.phone || "-"}
                />

                <QuickInfoItem
                  icon={CalendarDays}
                  label={t.fields.lastLogin}
                  value={formatDate(user.lastLogin)}
                />

                <QuickInfoItem
                  icon={CalendarDays}
                  label={t.fields.createdAt}
                  value={formatDate(user.createdAt || user.dateJoined)}
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
                        value={String(user.id)}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.fullName}
                        value={user.fullName}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.username}
                        value={user.username}
                        copyable={user.username !== "-"}
                        copiedMessage={t.copied}
                      />
                      <TableRow>
                        <TableCell className="w-[220px] text-muted-foreground">
                          {t.fields.status}
                        </TableCell>
                        <TableCell>{statusBadge(user.status, locale)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="w-[220px] text-muted-foreground">
                          {t.fields.role}
                        </TableCell>
                        <TableCell>{roleBadge(user.role, locale)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <UserCog className="h-4 w-4" />
                  {t.account}
                </CardTitle>
                <CardDescription>{t.accountDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableBody>
                      <InfoRow
                        label={t.fields.firstName}
                        value={user.firstName || "-"}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.lastName}
                        value={user.lastName || "-"}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.email}
                        value={user.email || "-"}
                        copyable={Boolean(user.email)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.phone}
                        value={user.phone || "-"}
                        copyable={Boolean(user.phone)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.userType}
                        value={user.userType || "-"}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.workspace}
                        value={user.workspace || "-"}
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
                  <ShieldCheck className="h-4 w-4" />
                  {t.access}
                </CardTitle>
                <CardDescription>{t.accessDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    icon={CheckCircle2}
                    label={t.fields.isActive}
                    value={user.isActive ? t.yes : t.no}
                  />
                  <MetricCard
                    icon={UserCog}
                    label={t.fields.isStaff}
                    value={user.isStaff ? t.yes : t.no}
                  />
                  <MetricCard
                    icon={ShieldCheck}
                    label={t.fields.isSuperuser}
                    value={user.isSuperuser ? t.yes : t.no}
                  />
                  <MetricCard
                    icon={KeyRound}
                    label={t.fields.permissionsCount}
                    value={formatNumber(user.permissionsCount)}
                  />
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-sm font-semibold">{t.permissionsList}</p>

                  {user.permissions.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {user.permissions.map((permission) => (
                        <Badge
                          key={permission}
                          variant="outline"
                          className="rounded-full"
                        >
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t.noPermissions}
                    </p>
                  )}
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
                  label={t.fields.lastLogin}
                  value={formatDate(user.lastLogin)}
                />
                <MetricCard
                  icon={CalendarDays}
                  label={t.fields.dateJoined}
                  value={formatDate(user.dateJoined)}
                />
                <MetricCard
                  icon={CalendarDays}
                  label={t.fields.createdAt}
                  value={formatDate(user.createdAt || user.dateJoined)}
                />
                <MetricCard
                  icon={CalendarDays}
                  label={t.fields.updatedAt}
                  value={formatDate(user.updatedAt)}
                />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Mail className="h-4 w-4" />
                  {t.notes}
                </CardTitle>
                <CardDescription>{t.notesDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <TextSection
                  label={t.fields.notes}
                  value={user.notes}
                  empty={t.empty}
                />
              </CardContent>
            </Card>
          </main>
        </div>
      ) : null}
    </div>
  );
}