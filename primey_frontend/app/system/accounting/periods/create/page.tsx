"use client";

/* ============================================================
   📂 app/system/accounting/periods/create/page.tsx
   🧠 Primey Care | Create Accounting Period Page

   ✅ المسار:
      app/system/accounting/periods/create/page.tsx

   ✅ العمل:
      صفحة إنشاء فترة محاسبية داخل مديول المحاسبة.
      تتيح إنشاء فترة مرتبطة بسنة مالية مع تاريخ البداية والنهاية والحالة والملاحظات.

   ✅ الإصدار:
      Phase 17 UX Refinement + Accounting Period Create Build

   ✅ يعتمد على:
      - /api/accounting/fiscal-years/
      - /api/accounting/periods/
      - /api/accounting/periods/create/ كـ fallback آمن
      - primey-locale
      - AuthProvider
      - sonner

   ✅ متوافق مع:
      - Accounting periods page
      - Accounting fiscal years pages
      - Accounting accounts / journals / cost centers approved pattern
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - إنشاء فترة محاسبية.
      - تحميل السنوات المالية لاختيار السنة المرتبطة.
      - توليد اسم الفترة تلقائيًا حسب السنة ورقم الفترة.
      - توليد تاريخ البداية والنهاية تلقائيًا للفترة الشهرية.
      - دعم حالة الفترة: مفتوحة / مغلقة / مقفلة.
      - حماية مغادرة الصفحة عند وجود تغييرات غير محفوظة.
      - مسح النموذج بتأكيد.
      - Error State مستقل.
      - Skeleton Loading للسنوات المالية.
      - صلاحيات آمنة بدون كسر system_admin/superuser.
      - أرقام إنجليزية دائمًا.
      - استخدام sonner للتنبيهات.

   ------------------------------------------------------------
   تحسينات هذا الإصدار:
      - الملف المرفق كان تفاصيل قيد يومية وليس صفحة إنشاء فترة.
      - تم بناء الصفحة من الصفر بنفس النمط المعتمد.
      - الالتزام بالقاعدة: w-full space-y-4 بدون main/min-h-screen/max-w.
      - إزالة أي عبارات تقنية أو مؤقتة من واجهة المستخدم.
      - إزالة localhost و API_BASE_URL الثابت.
============================================================ */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  FileText,
  Layers3,
  Loader2,
  LockKeyhole,
  RefreshCcw,
  RotateCcw,
  Save,
  ShieldCheck,
  UnlockKeyhole,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";
type Dict = Record<string, unknown>;

type PeriodStatus = "OPEN" | "CLOSED" | "LOCKED";

type FiscalYearOption = {
  id: string;
  year: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  isCurrent: boolean;
  periodsCount: number;
};

type FormState = {
  fiscalYearId: string;
  periodNumber: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  isClosed: boolean;
  notes: string;
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
  fiscal_years?: unknown[];
  years?: unknown[];
};

function makeDefaultForm(): FormState {
  return {
    fiscalYearId: "",
    periodNumber: "1",
    name: "",
    startDate: "",
    endDate: "",
    status: "OPEN",
    isClosed: false,
    notes: "",
  };
}

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

function getCookie(name: string) {
  try {
    if (typeof document === "undefined") return "";

    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);

    if (parts.length === 2) {
      return parts.pop()?.split(";").shift() || "";
    }

    return "";
  } catch {
    return "";
  }
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

    if (value && typeof value === "object") {
      return value as Dict;
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

function hasSafePermission(
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
      ["system_admin", "superuser", "super_admin", "accountant"].includes(role),
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
    title: isArabic ? "إنشاء فترة محاسبية" : "Create Accounting Period",
    subtitle: isArabic
      ? "أضف فترة محاسبية جديدة مرتبطة بسنة مالية مع تحديد البداية والنهاية وحالة الإقفال."
      : "Add a new accounting period linked to a fiscal year with start, end, and closing status.",

    back: isArabic ? "الفترات المحاسبية" : "Accounting Periods",
    fiscalYears: isArabic ? "السنوات المالية" : "Fiscal Years",
    save: isArabic ? "حفظ الفترة" : "Save Period",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    clear: isArabic ? "مسح النموذج" : "Clear Form",
    refresh: isArabic ? "تحديث السنوات" : "Refresh Years",

    mainInfo: isArabic ? "بيانات الفترة" : "Period Details",
    mainInfoDesc: isArabic
      ? "المعلومات الأساسية للفترة المحاسبية."
      : "Basic accounting period information.",
    periodInfo: isArabic ? "السنة المالية والحالة" : "Fiscal Year and Status",
    periodInfoDesc: isArabic
      ? "حدد السنة المالية المرتبطة وحالة الفترة."
      : "Select the linked fiscal year and period status.",
    summaryTitle: isArabic ? "ملخص الفترة" : "Period Summary",
    summaryDesc: isArabic
      ? "مراجعة بيانات الفترة قبل الحفظ."
      : "Review period data before saving.",

    fiscalYear: isArabic ? "السنة المالية" : "Fiscal Year",
    chooseFiscalYear: isArabic ? "اختر السنة المالية" : "Choose Fiscal Year",
    periodNumber: isArabic ? "رقم الفترة" : "Period Number",
    name: isArabic ? "اسم الفترة" : "Period Name",
    startDate: isArabic ? "تاريخ البداية" : "Start Date",
    endDate: isArabic ? "تاريخ النهاية" : "End Date",
    status: isArabic ? "الحالة" : "Status",
    notes: isArabic ? "ملاحظات" : "Notes",

    open: isArabic ? "مفتوحة" : "Open",
    closed: isArabic ? "مغلقة" : "Closed",
    locked: isArabic ? "مقفلة" : "Locked",

    isClosed: isArabic ? "الفترة مغلقة" : "Period is closed",
    selectedFiscalYear: isArabic ? "السنة المحددة" : "Selected Fiscal Year",
    selectedStatus: isArabic ? "الحالة المحددة" : "Selected Status",
    durationDays: isArabic ? "مدة الفترة بالأيام" : "Duration in Days",

    accessDeniedTitle: isArabic ? "غير مصرح بإنشاء فترة محاسبية" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية إنشاء الفترات المحاسبية. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to create accounting periods. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل السنوات المالية."
      : "Unable to load fiscal years.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث السنوات المالية بنجاح."
      : "Fiscal years refreshed successfully.",

    validationTitle: isArabic ? "راجع بيانات الفترة" : "Review period data",
    requiredFiscalYear: isArabic
      ? "السنة المالية مطلوبة."
      : "Fiscal year is required.",
    requiredPeriodNumber: isArabic
      ? "رقم الفترة مطلوب."
      : "Period number is required.",
    invalidPeriodNumber: isArabic
      ? "رقم الفترة يجب أن يكون رقمًا صحيحًا أكبر من صفر."
      : "Period number must be a valid number greater than zero.",
    requiredName: isArabic ? "اسم الفترة مطلوب." : "Period name is required.",
    requiredStartDate: isArabic ? "تاريخ البداية مطلوب." : "Start date is required.",
    requiredEndDate: isArabic ? "تاريخ النهاية مطلوب." : "End date is required.",
    invalidDateRange: isArabic
      ? "تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية."
      : "Start date cannot be after end date.",

    saveSuccess: isArabic
      ? "تم إنشاء الفترة المحاسبية بنجاح."
      : "Accounting period created successfully.",
    saveError: isArabic
      ? "تعذر حفظ الفترة المحاسبية."
      : "Unable to save accounting period.",

    confirmClear: isArabic
      ? "هل تريد مسح النموذج الحالي؟"
      : "Clear the current form?",
    unsavedChanges: isArabic
      ? "لديك تغييرات غير محفوظة. هل تريد المغادرة؟"
      : "You have unsaved changes. Do you want to leave?",

    notSet: isArabic ? "غير محدد" : "Not set",
    availableYears: isArabic ? "السنوات المتاحة" : "Available Years",
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

function getDaysBetween(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  const diff = end.getTime() - start.getTime();

  if (diff < 0) return 0;

  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());

  return `${year}-${month}-${day}`;
}

function getLastDayOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0);
}

function calculateMonthlyPeriodDates(
  fiscalYear: FiscalYearOption | undefined,
  periodNumber: string,
) {
  const number = Math.max(1, Math.floor(toNumber(periodNumber || 1)));

  if (!fiscalYear?.startDate) {
    const currentYear = new Date().getFullYear();
    const start = new Date(currentYear, number - 1, 1);
    const end = getLastDayOfMonth(currentYear, number - 1);

    return {
      startDate: toDateInputValue(start),
      endDate: toDateInputValue(end),
    };
  }

  const fiscalStart = new Date(fiscalYear.startDate);

  if (Number.isNaN(fiscalStart.getTime())) {
    return { startDate: "", endDate: "" };
  }

  const start = addMonths(fiscalStart, number - 1);
  const end = getLastDayOfMonth(start.getFullYear(), start.getMonth());

  if (fiscalYear.endDate) {
    const fiscalEnd = new Date(fiscalYear.endDate);

    if (!Number.isNaN(fiscalEnd.getTime()) && end > fiscalEnd) {
      return {
        startDate: toDateInputValue(start),
        endDate: toDateInputValue(fiscalEnd),
      };
    }
  }

  return {
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end),
  };
}

function fiscalPeriodName(
  fiscalYear: FiscalYearOption | undefined,
  periodNumber: string,
  locale: AppLocale,
) {
  const number = Math.max(1, Math.floor(toNumber(periodNumber || 1)));
  const year = fiscalYear?.year || new Date().getFullYear();

  if (locale === "ar") {
    return `الفترة ${formatNumber(number)} - ${year}`;
  }

  return `Period ${number} - ${year}`;
}

function extractRows(payload: ApiEnvelope<unknown> | null): unknown[] {
  if (!payload) return [];

  const data = asDict(payload.data);

  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.fiscal_years)) return payload.fiscal_years;
  if (Array.isArray(payload.years)) return payload.years;

  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.fiscal_years)) return data.fiscal_years;
  if (Array.isArray(data.years)) return data.years;

  if (Array.isArray(payload.data)) return payload.data;

  return [];
}

function getNestedValue(obj: Dict, keys: string[]): unknown {
  for (const key of keys) {
    const value = obj[key];

    if (value !== undefined && value !== null && value !== "") return value;
  }

  for (const container of ["fiscal_year", "fiscalYear", "year", "item", "data"]) {
    const nested = obj[container];

    if (nested && typeof nested === "object") {
      const value = getNestedValue(nested as Dict, keys);

      if (value !== undefined && value !== null && value !== "") return value;
    }
  }

  return undefined;
}

function normalizeFiscalYear(item: unknown): FiscalYearOption {
  const obj = asDict(item);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || ""),
    year: String(
      getNestedValue(obj, ["year", "fiscal_year", "number", "code"]) || "",
    ),
    name: String(
      getNestedValue(obj, ["name", "title", "label", "name_ar"]) || "",
    ),
    startDate: String(
      getNestedValue(obj, ["start_date", "date_from", "from_date"]) || "",
    ),
    endDate: String(
      getNestedValue(obj, ["end_date", "date_to", "to_date"]) || "",
    ),
    status: String(getNestedValue(obj, ["status", "state"]) || ""),
    isCurrent: Boolean(
      getNestedValue(obj, ["is_current", "current", "is_active"]),
    ),
    periodsCount: toNumber(
      getNestedValue(obj, ["periods_count", "accounting_periods_count"]),
    ),
  };
}

function statusLabel(status: PeriodStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<PeriodStatus, string> = {
    OPEN: t.open,
    CLOSED: t.closed,
    LOCKED: t.locked,
  };

  return labels[status];
}

function statusBadge(status: PeriodStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

  if (status === "OPEN") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        <UnlockKeyhole className="me-1 h-3.5 w-3.5" />
        {label}
      </Badge>
    );
  }

  if (status === "CLOSED") {
    return (
      <Badge className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <LockKeyhole className="me-1 h-3.5 w-3.5" />
        {label}
      </Badge>
    );
  }

  return (
    <Badge className="rounded-full border-violet-200 bg-violet-50 px-3 py-1 text-violet-700 hover:bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300">
      <ShieldCheck className="me-1 h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}

/* ============================================================
   Page
============================================================ */

export default function CreateAccountingPeriodPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [form, setForm] = useState<FormState>(() => makeDefaultForm());
  const [fiscalYears, setFiscalYears] = useState<FiscalYearOption[]>([]);
  const [isLoadingYears, setIsLoadingYears] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canCreate = hasSafePermission(
    auth,
    ["accounting.create", "accounting.periods.create", "accounting.manage"],
    "action",
  );

  const sortedFiscalYears = useMemo(
    () =>
      [...fiscalYears].sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
        return String(b.year).localeCompare(String(a.year));
      }),
    [fiscalYears],
  );

  const selectedFiscalYear = useMemo(
    () => sortedFiscalYears.find((item) => item.id === form.fiscalYearId),
    [form.fiscalYearId, sortedFiscalYears],
  );

  const durationDays = useMemo(
    () => getDaysBetween(form.startDate, form.endDate),
    [form.startDate, form.endDate],
  );

  const canSubmit = canCreate && !isSaving;

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setIsDirty(true);
  }

  function syncPeriodAutoFields(
    fiscalYearId: string,
    periodNumber: string,
    shouldMarkDirty = true,
  ) {
    const year = sortedFiscalYears.find((item) => item.id === fiscalYearId);
    const dates = calculateMonthlyPeriodDates(year, periodNumber);

    setForm((current) => ({
      ...current,
      fiscalYearId,
      periodNumber,
      name: fiscalPeriodName(year, periodNumber, locale),
      startDate: dates.startDate,
      endDate: dates.endDate,
    }));

    if (shouldMarkDirty) setIsDirty(true);
  }

  function handleFiscalYearChange(value: string) {
    const year = sortedFiscalYears.find((item) => item.id === value);
    const nextPeriod = String(Math.max(1, toNumber(year?.periodsCount) + 1));

    syncPeriodAutoFields(value, nextPeriod);
  }

  function handlePeriodNumberChange(value: string) {
    const clean = value.replace(/\D/g, "").slice(0, 3) || "1";
    syncPeriodAutoFields(form.fiscalYearId, clean);
  }

  function handleStatusChange(value: PeriodStatus) {
    setForm((current) => ({
      ...current,
      status: value,
      isClosed: value === "CLOSED" || value === "LOCKED",
    }));

    setIsDirty(true);
  }

  function clearForm() {
    if (isDirty && !window.confirm(t.confirmClear)) return;

    setForm(makeDefaultForm());
    setSubmitError("");
    setIsDirty(false);
  }

  function validateForm() {
    const errors: string[] = [];
    const periodNumber = toNumber(form.periodNumber);

    if (!form.fiscalYearId) errors.push(t.requiredFiscalYear);
    if (!form.periodNumber.trim()) errors.push(t.requiredPeriodNumber);
    if (!Number.isFinite(periodNumber) || periodNumber <= 0) {
      errors.push(t.invalidPeriodNumber);
    }
    if (!form.name.trim()) errors.push(t.requiredName);
    if (!form.startDate) errors.push(t.requiredStartDate);
    if (!form.endDate) errors.push(t.requiredEndDate);

    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      errors.push(t.invalidDateRange);
    }

    return Array.from(new Set(errors));
  }

  function buildPayload() {
    return {
      fiscal_year_id: form.fiscalYearId,
      fiscal_year: form.fiscalYearId,
      period_number: Number(form.periodNumber),
      number: Number(form.periodNumber),
      name: form.name.trim(),
      title: form.name.trim(),
      start_date: form.startDate,
      date_from: form.startDate,
      end_date: form.endDate,
      date_to: form.endDate,
      status: form.status,
      state: form.status,
      is_closed: form.isClosed || form.status === "CLOSED" || form.status === "LOCKED",
      closed: form.isClosed || form.status === "CLOSED" || form.status === "LOCKED",
      notes: form.notes.trim(),
      description: form.notes.trim(),
    };
  }

  const loadFiscalYears = useCallback(
    async (showToast = false) => {
      try {
        setIsLoadingYears(true);
        setLoadError("");

        const endpoints = [
          "/api/accounting/fiscal-years/?page_size=500",
          "/api/accounting/reports/fiscal-years/?page_size=500",
        ];

        let loadedRows: FiscalYearOption[] = [];
        let loaded = false;
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

          if ([400, 404, 405].includes(response.status)) {
            lastError =
              payload?.message ||
              payload?.detail ||
              payload?.error ||
              `HTTP ${response.status}`;
            continue;
          }

          if (
            !response.ok ||
            payload?.ok === false ||
            payload?.success === false
          ) {
            throw new Error(
              payload?.message ||
                payload?.detail ||
                payload?.error ||
                `HTTP ${response.status}`,
            );
          }

          loadedRows = extractRows(payload)
            .map(normalizeFiscalYear)
            .filter((item) => item.id && (item.year || item.name));

          loaded = true;
          break;
        }

        if (!loaded) {
          throw new Error(lastError || t.loadError);
        }

        setFiscalYears(loadedRows);

        if (!form.fiscalYearId && loadedRows.length > 0) {
          const sorted = [...loadedRows].sort((a, b) => {
            if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
            return String(b.year).localeCompare(String(a.year));
          });

          const first = sorted[0];
          const nextPeriod = String(Math.max(1, toNumber(first.periodsCount) + 1));
          const dates = calculateMonthlyPeriodDates(first, nextPeriod);

          setForm((current) => ({
            ...current,
            fiscalYearId: first.id,
            periodNumber: nextPeriod,
            name: fiscalPeriodName(first, nextPeriod, locale),
            startDate: dates.startDate,
            endDate: dates.endDate,
          }));
        }

        if (showToast) {
          toast.success(t.loadSuccess);
        }
      } catch (error) {
        console.error("Fiscal years load error:", error);
        setFiscalYears([]);
        setLoadError(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoadingYears(false);
      }
    },
    [form.fiscalYearId, locale, t.loadError, t.loadSuccess],
  );

  async function submitForm() {
    if (!canCreate) return;

    const errors = validateForm();

    if (errors.length > 0) {
      setSubmitError(errors.join("\n"));
      toast.error(t.validationTitle);
      return;
    }

    try {
      setIsSaving(true);
      setSubmitError("");

      const payload = buildPayload();
      const csrfToken = getCookie("csrftoken");

      const endpoints = [
        "/api/accounting/periods/create/",
        "/api/accounting/periods/",
        "/api/accounting/fiscal-periods/create/",
        "/api/accounting/fiscal-periods/",
      ];

      let saved = false;
      let lastMessage = "";

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

        const responsePayload = (await response.json().catch(() => null)) as
          | ApiEnvelope<unknown>
          | null;

        if ([400, 404, 405].includes(response.status)) {
          lastMessage =
            responsePayload?.message ||
            responsePayload?.detail ||
            responsePayload?.error ||
            `HTTP ${response.status}`;

          if (response.status === 400) break;

          continue;
        }

        if (
          !response.ok ||
          responsePayload?.ok === false ||
          responsePayload?.success === false
        ) {
          throw new Error(
            responsePayload?.message ||
              responsePayload?.detail ||
              responsePayload?.error ||
              `HTTP ${response.status}`,
          );
        }

        saved = true;
        break;
      }

      if (!saved) {
        throw new Error(lastMessage || t.saveError);
      }

      toast.success(t.saveSuccess);
      setForm(makeDefaultForm());
      setIsDirty(false);
      await loadFiscalYears(false);
    } catch (error) {
      console.error("Create accounting period submit error:", error);
      const message = error instanceof Error ? error.message : t.saveError;

      setSubmitError(message || t.saveError);
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
    loadFiscalYears(false);
  }, [authResolving, loadFiscalYears]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty || isSaving) return;

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);

    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [isDirty, isSaving]);

  if (!authResolving && !canCreate) {
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
          <Link
            href="/system/accounting/periods"
            onClick={(event) => {
              if (isDirty && !window.confirm(t.unsavedChanges)) {
                event.preventDefault();
              }
            }}
          >
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Link
            href="/system/accounting/fiscal-years"
            onClick={(event) => {
              if (isDirty && !window.confirm(t.unsavedChanges)) {
                event.preventDefault();
              }
            }}
          >
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <CalendarDays className="h-4 w-4" />
              <span>{t.fiscalYears}</span>
            </Button>
          </Link>

          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadFiscalYears(true)}
            disabled={isLoadingYears || isSaving}
          >
            {isLoadingYears ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            onClick={clearForm}
            disabled={isSaving}
          >
            <RotateCcw className="h-4 w-4" />
            <span>{t.clear}</span>
          </Button>

          <Button
            type="button"
            className="h-10 rounded-xl"
            onClick={submitForm}
            disabled={!canSubmit}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{isSaving ? t.saving : t.save}</span>
          </Button>
        </div>
      </div>

      {loadError ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <XCircle className="h-5 w-5" />
              </div>

              <div>
                <p className="font-semibold text-destructive">{loadError}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.loadErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadFiscalYears(true)}
              disabled={isLoadingYears}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.refresh}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {submitError ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5" />
            </div>

            <div>
              <p className="font-semibold text-destructive">
                {t.validationTitle}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                {submitError}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <FileText className="h-4 w-4" />
                {t.mainInfo}
              </CardTitle>
              <CardDescription>{t.mainInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">{t.fiscalYear}</label>

                {isLoadingYears ? (
                  <div className="h-11 animate-pulse rounded-xl bg-muted" />
                ) : (
                  <select
                    value={form.fiscalYearId}
                    onChange={(event) => handleFiscalYearChange(event.target.value)}
                    disabled={isSaving}
                    className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">{t.chooseFiscalYear}</option>
                    {sortedFiscalYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {[year.year, year.name].filter(Boolean).join(" - ")}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.periodNumber}</label>
                <Input
                  value={form.periodNumber}
                  onChange={(event) => handlePeriodNumberChange(event.target.value)}
                  disabled={isSaving}
                  inputMode="numeric"
                  dir="ltr"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.name}</label>
                <Input
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  disabled={isSaving}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.startDate}</label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => updateForm("startDate", event.target.value)}
                  disabled={isSaving}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.endDate}</label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(event) => updateForm("endDate", event.target.value)}
                  disabled={isSaving}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">{t.notes}</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  disabled={isSaving}
                  rows={3}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <CalendarClock className="h-4 w-4" />
                {t.periodInfo}
              </CardTitle>
              <CardDescription>{t.periodInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.status}</label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    handleStatusChange(event.target.value as PeriodStatus)
                  }
                  disabled={isSaving}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="OPEN">{t.open}</option>
                  <option value="CLOSED">{t.closed}</option>
                  <option value="LOCKED">{t.locked}</option>
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl border bg-background px-3 text-sm">
                  <Checkbox
                    checked={form.isClosed}
                    onCheckedChange={(checked) =>
                      updateForm("isClosed", Boolean(checked))
                    }
                    disabled={isSaving}
                  />
                  <span>{t.isClosed}</span>
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <CheckCircle2 className="h-4 w-4" />
                {t.summaryTitle}
              </CardTitle>
              <CardDescription>{t.summaryDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">
                  {t.selectedFiscalYear}
                </p>
                <p className="mt-2 text-sm font-semibold leading-6">
                  {selectedFiscalYear
                    ? [selectedFiscalYear.year, selectedFiscalYear.name]
                        .filter(Boolean)
                        .join(" - ")
                    : t.notSet}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.periodNumber}
                  </p>
                  <p className="mt-2 text-lg font-bold" dir="ltr">
                    {formatNumber(form.periodNumber || 0)}
                  </p>
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.selectedStatus}
                  </p>
                  <div className="mt-2">{statusBadge(form.status, locale)}</div>
                </div>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">{t.name}</p>
                <p className="mt-2 font-semibold">{form.name || "-"}</p>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">{t.startDate}</p>
                <p className="mt-2 font-semibold">
                  {formatDate(form.startDate, locale)}
                </p>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">{t.endDate}</p>
                <p className="mt-2 font-semibold">
                  {formatDate(form.endDate, locale)}
                </p>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">{t.durationDays}</p>
                <p className="mt-2 text-lg font-bold">
                  {formatNumber(durationDays)}
                </p>
              </div>

              <div className="grid gap-2 pt-2">
                <Button
                  type="button"
                  className="h-11 rounded-2xl"
                  onClick={submitForm}
                  disabled={!canSubmit}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSaving ? t.saving : t.save}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-2xl"
                  onClick={clearForm}
                  disabled={isSaving}
                >
                  <RotateCcw className="h-4 w-4" />
                  {t.clear}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Layers3 className="h-4 w-4" />
                {t.availableYears}
              </div>

              <div className="text-2xl font-bold">
                {isLoadingYears ? "..." : formatNumber(sortedFiscalYears.length)}
              </div>

              <p className="text-sm leading-6 text-muted-foreground">
                {selectedFiscalYear
                  ? `${formatDate(selectedFiscalYear.startDate, locale)} - ${formatDate(
                      selectedFiscalYear.endDate,
                      locale,
                    )}`
                  : t.chooseFiscalYear}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                {form.status === "OPEN" ? (
                  <UnlockKeyhole className="h-4 w-4" />
                ) : (
                  <LockKeyhole className="h-4 w-4" />
                )}
                {t.selectedStatus}
              </div>

              <p className="text-sm leading-6 text-muted-foreground">
                {statusLabel(form.status, locale)}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}