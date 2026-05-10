"use client";

/* ============================================================
   📂 app/system/accounting/fiscal-years/create/page.tsx
   🧠 Primey Care | Create Accounting Fiscal Year Page

   ✅ المسار:
      app/system/accounting/fiscal-years/create/page.tsx

   ✅ العمل:
      صفحة إنشاء سنة مالية داخل مديول المحاسبة.
      تتيح إنشاء سنة مالية جديدة مع الفترات المحاسبية، التاريخ، الحالة، وجعلها السنة الحالية عند الحاجة.

   ✅ الإصدار:
      Phase 17 UX Refinement + Accounting Fiscal Year Create Build

   ✅ يعتمد على:
      - /api/accounting/fiscal-years/
      - /api/accounting/fiscal-years/create/ كـ fallback آمن
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Accounting fiscal years page
      - Accounting cost centers pages
      - Accounting accounts pages
      - Accounting journals approved pattern
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - إنشاء سنة مالية جديدة.
      - توليد اسم السنة تلقائيًا حسب سنة البداية.
      - تحديد تاريخ البداية والنهاية.
      - دعم سنة تقويمية أو سنة مخصصة.
      - تحديد الحالة: مفتوحة / مغلقة / مؤرشفة.
      - إنشاء الفترات الشهرية تلقائيًا كخيار.
      - جعل السنة المالية هي السنة الحالية كخيار.
      - حماية مغادرة الصفحة عند وجود تغييرات غير محفوظة.
      - مسح النموذج بتأكيد.
      - Error State مستقل.
      - صلاحيات آمنة بدون كسر system_admin/superuser.
      - أرقام إنجليزية دائمًا.
      - استخدام sonner للتنبيهات.

   ------------------------------------------------------------
   تحسينات هذا الإصدار:
      - بناء الصفحة من الصفر لأن الملف المرفق كان غير مكتمل.
      - الالتزام بالقاعدة: w-full space-y-4 بدون main/min-h-screen/max-w.
      - إزالة أي عبارات مؤقتة أو تقنية من واجهة المستخدم.
      - إزالة localhost و API_BASE_URL الثابت.
      - الحفاظ على نمط صفحات الإنشاء المعتمد.
============================================================ */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

type FiscalYearStatus = "OPEN" | "CLOSED" | "ARCHIVED";
type FiscalYearMode = "CALENDAR" | "CUSTOM";

type FormState = {
  year: string;
  name: string;
  startDate: string;
  endDate: string;
  status: FiscalYearStatus;
  mode: FiscalYearMode;
  isCurrent: boolean;
  createMonthlyPeriods: boolean;
  notes: string;
};

type ApiEnvelope<T> = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  data?: T;
};

function makeDefaultForm(): FormState {
  const currentYear = new Date().getFullYear();

  return {
    year: String(currentYear),
    name: `FY ${currentYear}`,
    startDate: `${currentYear}-01-01`,
    endDate: `${currentYear}-12-31`,
    status: "OPEN",
    mode: "CALENDAR",
    isCurrent: false,
    createMonthlyPeriods: true,
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
    title: isArabic ? "إنشاء سنة مالية" : "Create Fiscal Year",
    subtitle: isArabic
      ? "أضف سنة مالية جديدة وحدد تاريخ البداية والنهاية وحالة الإقفال والفترات المحاسبية."
      : "Add a new fiscal year and define start date, end date, closing status, and accounting periods.",

    back: isArabic ? "السنوات المالية" : "Fiscal Years",
    save: isArabic ? "حفظ السنة المالية" : "Save Fiscal Year",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    clear: isArabic ? "مسح النموذج" : "Clear Form",

    mainInfo: isArabic ? "بيانات السنة المالية" : "Fiscal Year Details",
    mainInfoDesc: isArabic
      ? "المعلومات الأساسية للسنة المالية."
      : "Basic fiscal year information.",
    periodInfo: isArabic ? "الفترة والحالة" : "Period and Status",
    periodInfoDesc: isArabic
      ? "حدد بداية ونهاية السنة المالية وحالة الإقفال."
      : "Set fiscal year start, end, and closing status.",
    summaryTitle: isArabic ? "ملخص السنة المالية" : "Fiscal Year Summary",
    summaryDesc: isArabic
      ? "مراجعة بيانات السنة المالية قبل الحفظ."
      : "Review fiscal year data before saving.",

    year: isArabic ? "السنة" : "Year",
    name: isArabic ? "اسم السنة المالية" : "Fiscal Year Name",
    startDate: isArabic ? "تاريخ البداية" : "Start Date",
    endDate: isArabic ? "تاريخ النهاية" : "End Date",
    status: isArabic ? "الحالة" : "Status",
    mode: isArabic ? "نوع السنة" : "Year Type",
    notes: isArabic ? "ملاحظات" : "Notes",

    calendarYear: isArabic ? "سنة تقويمية" : "Calendar Year",
    customYear: isArabic ? "سنة مخصصة" : "Custom Year",

    open: isArabic ? "مفتوحة" : "Open",
    closed: isArabic ? "مغلقة" : "Closed",
    archived: isArabic ? "مؤرشفة" : "Archived",

    isCurrent: isArabic ? "تعيين كسنة مالية حالية" : "Set as current fiscal year",
    createMonthlyPeriods: isArabic
      ? "إنشاء الفترات الشهرية تلقائيًا"
      : "Create monthly periods automatically",

    expectedPeriods: isArabic ? "عدد الفترات المتوقع" : "Expected Periods",
    durationDays: isArabic ? "مدة السنة بالأيام" : "Duration in Days",
    selectedStatus: isArabic ? "الحالة المحددة" : "Selected Status",
    selectedMode: isArabic ? "النوع المحدد" : "Selected Type",

    accessDeniedTitle: isArabic ? "غير مصرح بإنشاء سنة مالية" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية إنشاء السنوات المالية. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to create fiscal years. Contact your system administrator if you need access.",

    validationTitle: isArabic ? "راجع بيانات السنة المالية" : "Review fiscal year data",
    requiredYear: isArabic ? "السنة مطلوبة." : "Year is required.",
    requiredName: isArabic ? "اسم السنة المالية مطلوب." : "Fiscal year name is required.",
    requiredStartDate: isArabic ? "تاريخ البداية مطلوب." : "Start date is required.",
    requiredEndDate: isArabic ? "تاريخ النهاية مطلوب." : "End date is required.",
    invalidYear: isArabic ? "السنة يجب أن تكون رقمًا صحيحًا." : "Year must be a valid number.",
    invalidDateRange: isArabic
      ? "تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية."
      : "Start date cannot be after end date.",

    saveSuccess: isArabic
      ? "تم إنشاء السنة المالية بنجاح."
      : "Fiscal year created successfully.",
    saveError: isArabic
      ? "تعذر حفظ السنة المالية."
      : "Unable to save fiscal year.",

    confirmClear: isArabic
      ? "هل تريد مسح النموذج الحالي؟"
      : "Clear the current form?",
    unsavedChanges: isArabic
      ? "لديك تغييرات غير محفوظة. هل تريد المغادرة؟"
      : "You have unsaved changes. Do you want to leave?",
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
  if (!value) return "-";

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

function getExpectedPeriods(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (start > end) return 0;

  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1
  );
}

function statusLabel(status: FiscalYearStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<FiscalYearStatus, string> = {
    OPEN: t.open,
    CLOSED: t.closed,
    ARCHIVED: t.archived,
  };

  return labels[status];
}

function modeLabel(mode: FiscalYearMode, locale: AppLocale) {
  const t = dictionary(locale);

  return mode === "CALENDAR" ? t.calendarYear : t.customYear;
}

function statusBadge(status: FiscalYearStatus, locale: AppLocale) {
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
    <Badge variant="secondary" className="rounded-full px-3 py-1">
      {label}
    </Badge>
  );
}

/* ============================================================
   Page
============================================================ */

export default function CreateAccountingFiscalYearPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [form, setForm] = useState<FormState>(() => makeDefaultForm());
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canCreate = hasSafePermission(
    auth,
    [
      "accounting.create",
      "accounting.fiscal_years.create",
      "accounting.manage",
    ],
    "action",
  );

  const expectedPeriods = useMemo(
    () => getExpectedPeriods(form.startDate, form.endDate),
    [form.startDate, form.endDate],
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

  function handleYearChange(value: string) {
    const cleanYear = value.replace(/\D/g, "").slice(0, 4);
    const parsedYear = Number(cleanYear);

    setForm((current) => {
      if (current.mode === "CALENDAR" && cleanYear.length === 4 && parsedYear > 0) {
        return {
          ...current,
          year: cleanYear,
          name: `FY ${cleanYear}`,
          startDate: `${cleanYear}-01-01`,
          endDate: `${cleanYear}-12-31`,
        };
      }

      return {
        ...current,
        year: cleanYear,
        name: cleanYear.length === 4 ? `FY ${cleanYear}` : current.name,
      };
    });

    setIsDirty(true);
  }

  function handleModeChange(value: FiscalYearMode) {
    setForm((current) => {
      const year = current.year || String(new Date().getFullYear());

      if (value === "CALENDAR") {
        return {
          ...current,
          mode: value,
          startDate: `${year}-01-01`,
          endDate: `${year}-12-31`,
        };
      }

      return {
        ...current,
        mode: value,
      };
    });

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

    if (!form.year.trim()) errors.push(t.requiredYear);
    if (!Number.isFinite(Number(form.year))) errors.push(t.invalidYear);
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
      year: Number(form.year),
      fiscal_year: Number(form.year),
      code: form.year.trim(),
      name: form.name.trim(),
      title: form.name.trim(),
      start_date: form.startDate,
      date_from: form.startDate,
      end_date: form.endDate,
      date_to: form.endDate,
      status: form.status,
      state: form.status,
      is_current: form.isCurrent,
      current: form.isCurrent,
      is_closed: form.status === "CLOSED",
      create_monthly_periods: form.createMonthlyPeriods,
      auto_create_periods: form.createMonthlyPeriods,
      periods_count: expectedPeriods,
      notes: form.notes.trim(),
      description: form.notes.trim(),
    };
  }

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
        "/api/accounting/fiscal-years/create/",
        "/api/accounting/fiscal-years/",
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
    } catch (error) {
      console.error("Create fiscal year submit error:", error);
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
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

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
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.year}</label>
                <Input
                  value={form.year}
                  onChange={(event) => handleYearChange(event.target.value)}
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
                <label className="text-sm font-medium">{t.mode}</label>
                <select
                  value={form.mode}
                  onChange={(event) =>
                    handleModeChange(event.target.value as FiscalYearMode)
                  }
                  disabled={isSaving}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="CALENDAR">{t.calendarYear}</option>
                  <option value="CUSTOM">{t.customYear}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.status}</label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    updateForm("status", event.target.value as FiscalYearStatus)
                  }
                  disabled={isSaving}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="OPEN">{t.open}</option>
                  <option value="CLOSED">{t.closed}</option>
                  <option value="ARCHIVED">{t.archived}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.startDate}</label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => updateForm("startDate", event.target.value)}
                  disabled={isSaving || form.mode === "CALENDAR"}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.endDate}</label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(event) => updateForm("endDate", event.target.value)}
                  disabled={isSaving || form.mode === "CALENDAR"}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-3 md:col-span-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-background p-3 text-sm">
                  <Checkbox
                    checked={form.isCurrent}
                    onCheckedChange={(checked) =>
                      updateForm("isCurrent", Boolean(checked))
                    }
                    disabled={isSaving}
                  />
                  <span>{t.isCurrent}</span>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-background p-3 text-sm">
                  <Checkbox
                    checked={form.createMonthlyPeriods}
                    onCheckedChange={(checked) =>
                      updateForm("createMonthlyPeriods", Boolean(checked))
                    }
                    disabled={isSaving}
                  />
                  <span>{t.createMonthlyPeriods}</span>
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
                <p className="text-xs text-muted-foreground">{t.year}</p>
                <p className="mt-2 font-semibold" dir="ltr">
                  {form.year || "-"}
                </p>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">{t.name}</p>
                <p className="mt-2 font-semibold">{form.name || "-"}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.selectedMode}
                  </p>
                  <p className="mt-2 font-semibold">
                    {modeLabel(form.mode, locale)}
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

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.expectedPeriods}
                  </p>
                  <p className="mt-2 text-lg font-bold">
                    {formatNumber(expectedPeriods)}
                  </p>
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.durationDays}
                  </p>
                  <p className="mt-2 text-lg font-bold">
                    {formatNumber(durationDays)}
                  </p>
                </div>
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
                <ShieldCheck className="h-4 w-4" />
                {form.isCurrent ? t.isCurrent : t.selectedStatus}
              </div>

              <p className="text-sm leading-6 text-muted-foreground">
                {statusLabel(form.status, locale)}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Layers3 className="h-4 w-4" />
                {t.createMonthlyPeriods}
              </div>

              <p className="text-2xl font-bold">
                {form.createMonthlyPeriods ? formatNumber(expectedPeriods) : "0"}
              </p>

              <p className="text-sm leading-6 text-muted-foreground">
                {form.createMonthlyPeriods ? t.expectedPeriods : t.customYear}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}