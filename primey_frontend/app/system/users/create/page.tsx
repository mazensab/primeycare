"use client";

/* ============================================================
   📂 app/system/users/create/page.tsx
   🧠 Primey Care | Create System User
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ مبني بنفس نمط إنشاء المراكز/العملاء المعتمد
   ✅ Full Width Layout
   ✅ Main Form + Sidebar Summary
   ✅ حماية زر الإنشاء وطلبات الحفظ حسب الصلاحيات
   ✅ fallback آمن لـ system_admin / superadmin
   ✅ Error Alert داخلي
   ✅ Field-level validation
   ✅ beforeunload protection
   ✅ حفظ واستعادة مسودة محلية
   ✅ تعطيل الحقول أثناء الحفظ
   ✅ تنظيف البيانات قبل الإرسال
   ✅ إرسال رابط كلمة المرور عند الإنشاء عند اختيار ذلك
   ✅ استخدام toast من sonner
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ بدون localhost hardcoded
   ✅ لا توجد روابط تقارير داخل الوحدة
   ✅ لا توجد نصوص تقنية ظاهرة في الواجهة
   ✅ الأرقام بالإنجليزية
============================================================ */

import { useRouter } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  RefreshCcw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  UserCog,
  UserRound,
  Users,
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

type UserRole =
  | "system_admin"
  | "provider_admin"
  | "customer_user"
  | "agent_user"
  | "accountant"
  | "support"
  | "viewer";

type UserWorkspace = "system" | "provider" | "customer" | "agent";

type UserFormData = {
  first_name: string;
  last_name: string;
  full_name: string;
  username: string;
  email: string;
  phone: string;
  role: UserRole;
  user_type: UserRole;
  workspace: UserWorkspace;
  password: string;
  confirm_password: string;
  permission_codes: string;
  notes: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  send_password_link: boolean;
};

type UserFormErrors = Partial<Record<keyof UserFormData, string>>;

type CreateUserApiResponse = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[] | string>;
  id?: number | string;
  user?: {
    id?: number | string;
  };
  data?: {
    id?: number | string;
    user?: {
      id?: number | string;
    };
  };
};

const DRAFT_STORAGE_KEY = "primey-care-system-user-create-draft";

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
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "إضافة مستخدم جديد" : "Create New User",
    subtitle: isArabic
      ? "إنشاء حساب مستخدم وربطه بالدور ومساحة العمل والصلاحيات المناسبة."
      : "Create a user account and assign the proper role, workspace, and permissions.",

    back: isArabic ? "العودة للمستخدمين" : "Back to Users",
    usersList: isArabic ? "قائمة المستخدمين" : "Users List",
    create: isArabic ? "إنشاء المستخدم" : "Create User",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    saveDraft: isArabic ? "حفظ كمسودة محلية" : "Save Local Draft",
    restoreDraft: isArabic ? "استعادة المسودة" : "Restore Draft",
    clearForm: isArabic ? "تفريغ النموذج" : "Clear Form",

    identityInfo: isArabic ? "بيانات المستخدم" : "User Information",
    identityDesc: isArabic
      ? "الاسم واسم المستخدم والبريد ورقم التواصل."
      : "Name, username, email, and contact number.",

    accessInfo: isArabic ? "الدور ومساحة العمل" : "Role & Workspace",
    accessDesc: isArabic
      ? "تحديد دور المستخدم ومساحة العمل المرتبطة به."
      : "Assign the user role and related workspace.",

    securityInfo: isArabic ? "الأمان وكلمة المرور" : "Security & Password",
    securityDesc: isArabic
      ? "إعداد كلمة مرور أولية أو إرسال رابط تعيين كلمة المرور."
      : "Set an initial password or send a password setup link.",

    permissionsInfo: isArabic ? "الصلاحيات والملاحظات" : "Permissions & Notes",
    permissionsDesc: isArabic
      ? "إضافة صلاحيات مخصصة أو ملاحظات داخلية عند الحاجة."
      : "Add custom permission codes or internal notes when needed.",

    optionsInfo: isArabic ? "إعدادات الحساب" : "Account Options",
    optionsDesc: isArabic
      ? "تحديد حالة الحساب ومؤشرات الوصول."
      : "Configure account status and access flags.",

    summaryTitle: isArabic ? "ملخص المستخدم" : "User Summary",
    summaryDesc: isArabic
      ? "مراجعة سريعة قبل إنشاء الحساب."
      : "Quick review before creating the account.",

    stepsTitle: isArabic ? "إرشادات قبل الحفظ" : "Before Saving",
    formErrorTitle: isArabic ? "تعذر حفظ البيانات" : "Unable to save data",

    accessDeniedTitle: isArabic ? "غير مصرح بإضافة مستخدم" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية إنشاء مستخدمي النظام. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to create system users. Contact your system administrator if you need access.",

    labels: {
      firstName: isArabic ? "الاسم الأول" : "First Name",
      lastName: isArabic ? "اسم العائلة" : "Last Name",
      fullName: isArabic ? "الاسم الكامل" : "Full Name",
      username: isArabic ? "اسم المستخدم" : "Username",
      email: isArabic ? "البريد الإلكتروني" : "Email",
      phone: isArabic ? "الجوال" : "Phone",
      role: isArabic ? "الدور" : "Role",
      userType: isArabic ? "نوع المستخدم" : "User Type",
      workspace: isArabic ? "مساحة العمل" : "Workspace",
      password: isArabic ? "كلمة المرور" : "Password",
      confirmPassword: isArabic ? "تأكيد كلمة المرور" : "Confirm Password",
      permissionCodes: isArabic ? "أكواد الصلاحيات" : "Permission Codes",
      notes: isArabic ? "الملاحظات" : "Notes",
      isActive: isArabic ? "تفعيل الحساب مباشرة" : "Activate account immediately",
      isStaff: isArabic ? "مستخدم إداري" : "Staff user",
      isSuperuser: isArabic ? "صلاحية عليا" : "Superuser",
      sendPasswordLink: isArabic
        ? "إرسال رابط تعيين كلمة المرور"
        : "Send password setup link",
    },

    placeholders: {
      firstName: isArabic ? "مثال: مازن" : "Example: Mazen",
      lastName: isArabic ? "مثال: الأحمدي" : "Example: Alahmadi",
      fullName: isArabic ? "يتم توليده تلقائيًا عند تركه فارغًا" : "Auto-generated if left empty",
      username: isArabic ? "مثال: mazen.admin" : "Example: mazen.admin",
      email: "user@example.com",
      phone: "05xxxxxxxx",
      password: isArabic ? "اختياري عند إرسال رابط كلمة المرور" : "Optional when sending password link",
      confirmPassword: isArabic ? "أعد كتابة كلمة المرور" : "Repeat password",
      permissionCodes: isArabic
        ? "مثال: users.view, users.create, invoices.view"
        : "Example: users.view, users.create, invoices.view",
      notes: isArabic
        ? "ملاحظات داخلية عن المستخدم..."
        : "Internal notes about this user...",
    },

    roles: {
      system_admin: isArabic ? "مدير النظام" : "System Admin",
      provider_admin: isArabic ? "مدير مقدم خدمة" : "Provider Admin",
      customer_user: isArabic ? "مستخدم عميل" : "Customer User",
      agent_user: isArabic ? "مندوب" : "Agent User",
      accountant: isArabic ? "محاسب" : "Accountant",
      support: isArabic ? "دعم" : "Support",
      viewer: isArabic ? "مشاهد" : "Viewer",
    } satisfies Record<UserRole, string>,

    workspaces: {
      system: isArabic ? "النظام" : "System",
      provider: isArabic ? "مقدم الخدمة" : "Provider",
      customer: isArabic ? "العميل" : "Customer",
      agent: isArabic ? "المندوب" : "Agent",
    } satisfies Record<UserWorkspace, string>,

    validation: {
      firstName: isArabic ? "الاسم الأول مطلوب." : "First name is required.",
      username: isArabic ? "اسم المستخدم مطلوب." : "Username is required.",
      usernameInvalid: isArabic
        ? "اسم المستخدم يجب أن يحتوي حروفًا أو أرقامًا أو نقاطًا أو شرطات فقط."
        : "Username can contain letters, numbers, dots, underscores, or hyphens only.",
      email: isArabic ? "البريد الإلكتروني مطلوب." : "Email is required.",
      emailInvalid: isArabic ? "صيغة البريد غير صحيحة." : "Invalid email format.",
      phoneInvalid: isArabic ? "رقم الجوال غير صحيح." : "Invalid phone number.",
      passwordRequired: isArabic
        ? "كلمة المرور مطلوبة إذا لم يتم اختيار إرسال رابط كلمة المرور."
        : "Password is required when password link is not selected.",
      passwordMin: isArabic
        ? "كلمة المرور يجب ألا تقل عن 8 أحرف."
        : "Password must be at least 8 characters.",
      passwordMatch: isArabic
        ? "تأكيد كلمة المرور غير مطابق."
        : "Password confirmation does not match.",
    },

    success: isArabic ? "تم إنشاء المستخدم بنجاح." : "User created successfully.",
    draftSaved: isArabic ? "تم حفظ المسودة محليًا." : "Draft saved locally.",
    draftRestored: isArabic ? "تمت استعادة المسودة." : "Draft restored.",
    noDraft: isArabic ? "لا توجد مسودة محفوظة." : "No saved draft found.",
    formCleared: isArabic ? "تم تفريغ النموذج." : "Form cleared.",
    apiError: isArabic
      ? "تعذر إنشاء المستخدم. تحقق من البيانات وحاول مرة أخرى."
      : "Unable to create user. Please check the data and try again.",
    validationToast: isArabic
      ? "يرجى تصحيح الحقول المطلوبة قبل المتابعة."
      : "Please fix the required fields before continuing.",
    confirmLeave: isArabic
      ? "لديك بيانات غير محفوظة. هل تريد المغادرة؟"
      : "You have unsaved changes. Do you want to leave?",
    confirmClear: isArabic
      ? "سيتم تفريغ النموذج الحالي. هل تريد المتابعة؟"
      : "The current form will be cleared. Do you want to continue?",

    completion: isArabic ? "نسبة الاكتمال" : "Completion",
    ready: isArabic ? "جاهز للحفظ" : "Ready to save",
    missingData: isArabic ? "ينقصه بيانات أساسية" : "Missing required data",

    quickNotes: [
      isArabic
        ? "اختر الدور الصحيح لأن صلاحيات المستخدم تعتمد عليه."
        : "Choose the correct role because user access depends on it.",
      isArabic
        ? "استخدم رابط كلمة المرور إذا كنت لا تريد إدخال كلمة مرور أولية."
        : "Use the password link option if you do not want to set an initial password.",
      isArabic
        ? "الصلاحيات المخصصة تكتب مفصولة بفواصل عند الحاجة فقط."
        : "Custom permission codes are comma-separated and only used when needed.",
      isArabic
        ? "لا يتم عرض أزرار غير مصرح بها داخل الواجهة."
        : "Unauthorized actions are not displayed in the interface.",
    ],
  };
}

/* ============================================================
   Defaults
============================================================ */

const initialFormData: UserFormData = {
  first_name: "",
  last_name: "",
  full_name: "",
  username: "",
  email: "",
  phone: "",
  role: "viewer",
  user_type: "viewer",
  workspace: "system",
  password: "",
  confirm_password: "",
  permission_codes: "",
  notes: "",
  is_active: true,
  is_staff: false,
  is_superuser: false,
  send_password_link: true,
};

/* ============================================================
   Data Helpers
============================================================ */

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ".");
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "").trim();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhone(value: string) {
  if (!value.trim()) return true;

  const normalized = normalizePhone(value);

  return /^(\+9665|9665|05|5)\d{8}$/.test(normalized);
}

function isValidUsername(value: string) {
  return /^[a-zA-Z0-9._-]+$/.test(value.trim());
}

function parsePermissionCodes(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,،\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function hasFormChanges(formData: UserFormData) {
  return JSON.stringify(formData) !== JSON.stringify(initialFormData);
}

function roleToWorkspace(role: UserRole): UserWorkspace {
  if (role === "provider_admin") return "provider";
  if (role === "customer_user") return "customer";
  if (role === "agent_user") return "agent";

  return "system";
}

function normalizePayload(formData: UserFormData) {
  const fullName =
    normalizeName(formData.full_name) ||
    normalizeName(`${formData.first_name} ${formData.last_name}`);

  return {
    first_name: normalizeName(formData.first_name),
    last_name: normalizeName(formData.last_name),
    full_name: fullName,
    name: fullName,
    username: normalizeUsername(formData.username),
    email: formData.email.trim().toLowerCase(),
    phone: normalizePhone(formData.phone),
    mobile: normalizePhone(formData.phone),
    role: formData.role,
    user_role: formData.role,
    user_type: formData.user_type,
    workspace: formData.workspace,
    password: formData.send_password_link ? undefined : formData.password,
    permission_codes: parsePermissionCodes(formData.permission_codes),
    notes: formData.notes.trim(),
    is_active: formData.is_active,
    is_staff: formData.is_staff,
    is_superuser: formData.is_superuser,
    send_password_link: formData.send_password_link,
  };
}

function resolveCreatedId(result: CreateUserApiResponse) {
  return (
    result.user?.id ||
    result.data?.user?.id ||
    result.data?.id ||
    result.id ||
    null
  );
}

function mapApiFieldErrors(errors: CreateUserApiResponse["errors"]) {
  const nextErrors: UserFormErrors = {};

  if (!errors) return nextErrors;

  Object.entries(errors).forEach(([key, value]) => {
    const message = Array.isArray(value) ? value[0] : value;

    if (!message) return;

    if (key in initialFormData) {
      nextErrors[key as keyof UserFormData] = String(message);
    }
  });

  return nextErrors;
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

function FieldBlock({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label}
        {required ? <span className="ms-1 text-destructive">*</span> : null}
      </Label>

      {children}

      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
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

function ToggleBox({
  icon: Icon,
  checked,
  disabled,
  title,
  description,
  onChange,
}: {
  icon: ComponentType<{ className?: string }>;
  checked: boolean;
  disabled?: boolean;
  title: string;
  description: string;
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

/* ============================================================
   Page
============================================================ */

export default function SystemCreateUserPage() {
  const router = useRouter();
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canCreateUsers = hasSafePermission(
    auth,
    ["users.create", "system.users.create"],
    "action",
  );

  const canViewUsers = hasSafePermission(
    auth,
    ["users.view", "users.list", "system.users.view"],
    "view",
  );

  const isDirty = useMemo(() => hasFormChanges(formData), [formData]);

  const fullNamePreview =
    normalizeName(formData.full_name) ||
    normalizeName(`${formData.first_name} ${formData.last_name}`) ||
    "-";

  const permissionCodes = useMemo(
    () => parsePermissionCodes(formData.permission_codes),
    [formData.permission_codes],
  );

  const completedFields = useMemo(() => {
    const keys: Array<keyof UserFormData> = [
      "first_name",
      "username",
      "email",
      "role",
      "workspace",
    ];

    const baseCount = keys.filter((key) =>
      String(formData[key] || "").trim(),
    ).length;

    const passwordReady =
      formData.send_password_link ||
      (formData.password.length >= 8 &&
        formData.password === formData.confirm_password);

    return baseCount + (passwordReady ? 1 : 0);
  }, [formData]);

  const progressPercent = Math.round((completedFields / 6) * 100);

  const isReadyToSave =
    normalizeName(formData.first_name).length > 0 &&
    normalizeUsername(formData.username).length > 0 &&
    isValidUsername(formData.username) &&
    isValidEmail(formData.email) &&
    (formData.send_password_link ||
      (formData.password.length >= 8 &&
        formData.password === formData.confirm_password));

  function updateField<K extends keyof UserFormData>(
    key: K,
    value: UserFormData[K],
  ) {
    setFormData((current) => ({
      ...current,
      [key]: value,
    }));

    setErrors((current) => ({
      ...current,
      [key]: undefined,
    }));

    if (submitError) {
      setSubmitError("");
    }
  }

  function updateRole(role: UserRole) {
    setFormData((current) => ({
      ...current,
      role,
      user_type: role,
      workspace: roleToWorkspace(role),
      is_staff:
        role === "system_admin" ||
        role === "provider_admin" ||
        role === "accountant" ||
        role === "support",
      is_superuser: role === "system_admin" ? current.is_superuser : false,
    }));

    setErrors((current) => ({
      ...current,
      role: undefined,
      user_type: undefined,
      workspace: undefined,
    }));
  }

  function validateForm() {
    const nextErrors: UserFormErrors = {};

    if (!normalizeName(formData.first_name)) {
      nextErrors.first_name = t.validation.firstName;
    }

    if (!normalizeUsername(formData.username)) {
      nextErrors.username = t.validation.username;
    } else if (!isValidUsername(formData.username)) {
      nextErrors.username = t.validation.usernameInvalid;
    }

    if (!formData.email.trim()) {
      nextErrors.email = t.validation.email;
    } else if (!isValidEmail(formData.email)) {
      nextErrors.email = t.validation.emailInvalid;
    }

    if (!isValidPhone(formData.phone)) {
      nextErrors.phone = t.validation.phoneInvalid;
    }

    if (!formData.send_password_link) {
      if (!formData.password) {
        nextErrors.password = t.validation.passwordRequired;
      } else if (formData.password.length < 8) {
        nextErrors.password = t.validation.passwordMin;
      }

      if (formData.password !== formData.confirm_password) {
        nextErrors.confirm_password = t.validation.passwordMatch;
      }
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function postUser(payload: Record<string, unknown>) {
    const csrfToken = readCookie("csrftoken");
    const endpoints = ["/api/users/create/", "/api/users/"];

    let lastResult: CreateUserApiResponse | null = null;

    for (const endpoint of endpoints) {
      const response = await fetch(apiUrl(endpoint), {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as
        | CreateUserApiResponse
        | null;

      lastResult = result;

      if (response.status === 404 || response.status === 405) {
        continue;
      }

      if (!response.ok || result?.ok === false) {
        throw result || { message: `HTTP ${response.status}` };
      }

      return result || {};
    }

    throw lastResult || { message: t.apiError };
  }

  async function submitForm() {
    setSubmitError("");

    if (!validateForm()) {
      toast.error(t.validationToast);
      return;
    }

    try {
      setIsSubmitting(true);

      const result = await postUser(normalizePayload(formData));
      const createdId = resolveCreatedId(result);

      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      toast.success(t.success);

      if (createdId) {
        router.push(`/system/users/${createdId}`);
        return;
      }

      router.push("/system/users");
    } catch (error) {
      const result = error as CreateUserApiResponse;
      const apiErrors = mapApiFieldErrors(result?.errors);
      const message = result?.message || t.apiError;

      console.error("Create system user error:", error);

      setErrors((current) => ({
        ...current,
        ...apiErrors,
      }));

      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function saveDraft() {
    try {
      const draft: UserFormData = {
        ...formData,
        password: "",
        confirm_password: "",
      };

      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      toast.success(t.draftSaved);
    } catch (error) {
      console.error("Save user draft error:", error);
      toast.error(t.apiError);
    }
  }

  function restoreDraft() {
    try {
      const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);

      if (!rawDraft) {
        toast.error(t.noDraft);
        return;
      }

      const parsed = JSON.parse(rawDraft) as UserFormData;

      setFormData({
        ...initialFormData,
        ...parsed,
        password: "",
        confirm_password: "",
      });

      setErrors({});
      setSubmitError("");
      toast.success(t.draftRestored);
    } catch (error) {
      console.error("Restore user draft error:", error);
      toast.error(t.apiError);
    }
  }

  function clearForm() {
    if (isDirty && !window.confirm(t.confirmClear)) return;

    setFormData(initialFormData);
    setErrors({});
    setSubmitError("");
    toast.success(t.formCleared);
  }

  const confirmNavigate = useCallback(
    (path: string) => {
      if (isSubmitting) return;

      if (isDirty && !window.confirm(t.confirmLeave)) {
        return;
      }

      router.push(path);
    },
    [isDirty, isSubmitting, router, t.confirmLeave],
  );

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
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty || isSubmitting) return;

      event.preventDefault();
      event.returnValue = t.confirmLeave;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty, isSubmitting, t.confirmLeave]);

  if (!authResolving && !canCreateUsers) {
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
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl sm:w-auto"
            disabled={isSubmitting}
            onClick={() => confirmNavigate("/system/users")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.back}</span>
          </Button>

          {canViewUsers ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
              disabled={isSubmitting}
              onClick={() => confirmNavigate("/system/users")}
            >
              <ClipboardList className="h-4 w-4" />
              <span>{t.usersList}</span>
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl sm:w-auto"
            disabled={isSubmitting}
            onClick={saveDraft}
          >
            <Save className="h-4 w-4" />
            <span>{t.saveDraft}</span>
          </Button>

          <Button
            type="button"
            className="h-10 w-full rounded-xl sm:w-auto"
            disabled={isSubmitting}
            onClick={submitForm}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span>{isSubmitting ? t.saving : t.create}</span>
          </Button>
        </div>
      </div>

      {submitError ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5 text-destructive">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">{t.formErrorTitle}</p>
              <p className="mt-1 text-sm">{submitError}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main Form */}
        <div className="space-y-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <UserRound className="h-4 w-4" />
                {t.identityInfo}
              </CardTitle>
              <CardDescription>{t.identityDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock
                label={t.labels.firstName}
                error={errors.first_name}
                required
              >
                <Input
                  value={formData.first_name}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.firstName}
                  className="h-10 rounded-xl"
                  onChange={(event) =>
                    updateField("first_name", event.target.value)
                  }
                  onBlur={() =>
                    updateField("first_name", normalizeName(formData.first_name))
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.labels.lastName} error={errors.last_name}>
                <Input
                  value={formData.last_name}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.lastName}
                  className="h-10 rounded-xl"
                  onChange={(event) =>
                    updateField("last_name", event.target.value)
                  }
                  onBlur={() =>
                    updateField("last_name", normalizeName(formData.last_name))
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.labels.fullName} error={errors.full_name}>
                <Input
                  value={formData.full_name}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.fullName}
                  className="h-10 rounded-xl"
                  onChange={(event) =>
                    updateField("full_name", event.target.value)
                  }
                  onBlur={() =>
                    updateField("full_name", normalizeName(formData.full_name))
                  }
                />
              </FieldBlock>

              <FieldBlock
                label={t.labels.username}
                error={errors.username}
                required
              >
                <Input
                  value={formData.username}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.username}
                  className="h-10 rounded-xl"
                  dir="ltr"
                  onChange={(event) =>
                    updateField("username", event.target.value)
                  }
                  onBlur={() =>
                    updateField("username", normalizeUsername(formData.username))
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.labels.email} error={errors.email} required>
                <Input
                  value={formData.email}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.email}
                  className="h-10 rounded-xl"
                  dir="ltr"
                  onChange={(event) => updateField("email", event.target.value)}
                  onBlur={() =>
                    updateField("email", formData.email.trim().toLowerCase())
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.labels.phone} error={errors.phone}>
                <Input
                  value={formData.phone}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.phone}
                  className="h-10 rounded-xl"
                  dir="ltr"
                  onChange={(event) => updateField("phone", event.target.value)}
                  onBlur={() =>
                    updateField("phone", normalizePhone(formData.phone))
                  }
                />
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <ShieldCheck className="h-4 w-4" />
                {t.accessInfo}
              </CardTitle>
              <CardDescription>{t.accessDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-3">
              <FieldBlock label={t.labels.role} error={errors.role} required>
                <select
                  value={formData.role}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) => updateRole(event.target.value as UserRole)}
                >
                  {Object.entries(t.roles).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock label={t.labels.userType} error={errors.user_type}>
                <select
                  value={formData.user_type}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) =>
                    updateField("user_type", event.target.value as UserRole)
                  }
                >
                  {Object.entries(t.roles).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock label={t.labels.workspace} error={errors.workspace}>
                <select
                  value={formData.workspace}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) =>
                    updateField(
                      "workspace",
                      event.target.value as UserWorkspace,
                    )
                  }
                >
                  {Object.entries(t.workspaces).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <KeyRound className="h-4 w-4" />
                {t.securityInfo}
              </CardTitle>
              <CardDescription>{t.securityDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock label={t.labels.password} error={errors.password}>
                <Input
                  type="password"
                  value={formData.password}
                  disabled={isSubmitting || formData.send_password_link}
                  placeholder={t.placeholders.password}
                  className="h-10 rounded-xl"
                  onChange={(event) =>
                    updateField("password", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock
                label={t.labels.confirmPassword}
                error={errors.confirm_password}
              >
                <Input
                  type="password"
                  value={formData.confirm_password}
                  disabled={isSubmitting || formData.send_password_link}
                  placeholder={t.placeholders.confirmPassword}
                  className="h-10 rounded-xl"
                  onChange={(event) =>
                    updateField("confirm_password", event.target.value)
                  }
                />
              </FieldBlock>

              <div className="md:col-span-2">
                <ToggleBox
                  icon={Send}
                  checked={formData.send_password_link}
                  disabled={isSubmitting}
                  title={t.labels.sendPasswordLink}
                  description={t.labels.sendPasswordLink}
                  onChange={(value) => {
                    setFormData((current) => ({
                      ...current,
                      send_password_link: value,
                      password: value ? "" : current.password,
                      confirm_password: value ? "" : current.confirm_password,
                    }));
                    setErrors((current) => ({
                      ...current,
                      password: undefined,
                      confirm_password: undefined,
                    }));
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <BadgeCheck className="h-4 w-4" />
                {t.optionsInfo}
              </CardTitle>
              <CardDescription>{t.optionsDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-3">
              <ToggleBox
                icon={CheckCircle2}
                checked={formData.is_active}
                disabled={isSubmitting}
                title={t.labels.isActive}
                description={t.labels.isActive}
                onChange={(value) => updateField("is_active", value)}
              />

              <ToggleBox
                icon={UserCog}
                checked={formData.is_staff}
                disabled={isSubmitting}
                title={t.labels.isStaff}
                description={t.labels.isStaff}
                onChange={(value) => updateField("is_staff", value)}
              />

              <ToggleBox
                icon={ShieldCheck}
                checked={formData.is_superuser}
                disabled={isSubmitting || formData.role !== "system_admin"}
                title={t.labels.isSuperuser}
                description={t.labels.isSuperuser}
                onChange={(value) => updateField("is_superuser", value)}
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <ClipboardList className="h-4 w-4" />
                {t.permissionsInfo}
              </CardTitle>
              <CardDescription>{t.permissionsDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4">
              <FieldBlock
                label={t.labels.permissionCodes}
                error={errors.permission_codes}
              >
                <Textarea
                  value={formData.permission_codes}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.permissionCodes}
                  className="min-h-24 rounded-xl"
                  dir="ltr"
                  onChange={(event) =>
                    updateField("permission_codes", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.labels.notes} error={errors.notes}>
                <Textarea
                  value={formData.notes}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.notes}
                  className="min-h-28 rounded-xl"
                  onChange={(event) => updateField("notes", event.target.value)}
                />
              </FieldBlock>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Summary */}
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
                      {t.completion}
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      {formatNumber(progressPercent)}%
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

                <div className="mt-3">
                  {isReadyToSave ? (
                    <Badge className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t.ready}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-full">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {t.missingData}
                    </Badge>
                  )}
                </div>
              </div>

              <SummaryItem
                icon={UserRound}
                label={t.labels.fullName}
                value={fullNamePreview}
              />

              <SummaryItem
                icon={Mail}
                label={t.labels.email}
                value={formData.email || "-"}
              />

              <SummaryItem
                icon={Phone}
                label={t.labels.phone}
                value={formData.phone || "-"}
              />

              <SummaryItem
                icon={ShieldCheck}
                label={t.labels.role}
                value={t.roles[formData.role]}
              />

              <SummaryItem
                icon={Users}
                label={t.labels.workspace}
                value={t.workspaces[formData.workspace]}
              />

              <SummaryItem
                icon={KeyRound}
                label={t.labels.permissionCodes}
                value={formatNumber(permissionCodes.length)}
              />

              <div className="grid gap-2">
                <Button
                  type="button"
                  className="h-10 rounded-xl"
                  disabled={isSubmitting}
                  onClick={submitForm}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {isSubmitting ? t.saving : t.create}
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl"
                    disabled={isSubmitting}
                    onClick={restoreDraft}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {t.restoreDraft}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl"
                    disabled={isSubmitting}
                    onClick={clearForm}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t.clearForm}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {t.stepsTitle}
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
    </div>
  );
}