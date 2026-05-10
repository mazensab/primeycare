"use client";

/* ============================================================
   📂 app/system/accounting/cost-centers/create/page.tsx
   🧠 Primey Care | Create Accounting Cost Center Page

   ✅ المسار:
      app/system/accounting/cost-centers/create/page.tsx

   ✅ العمل:
      صفحة إنشاء مركز تكلفة داخل مديول المحاسبة.
      تتيح إنشاء مركز تكلفة جديد مع كود تلقائي، نوع المركز، المركز الأب، المسؤول، الميزانية، والحالة.

   ✅ الإصدار:
      Phase 17 UX Refinement + Accounting Cost Center Create Build

   ✅ يعتمد على:
      - /api/accounting/cost-centers/
      - /api/accounting/cost-centers/create/ كـ fallback آمن
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Accounting cost centers page
      - Accounting accounts create page
      - Accounting journals approved pattern
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - إنشاء مركز تكلفة جديد.
      - توليد كود مركز التكلفة تلقائيًا بالتسلسل.
      - منع كتابة الكود يدويًا.
      - تحميل مراكز التكلفة الحالية لاختيار المركز الأب.
      - دعم الأنواع: تشغيلي، إداري، مبيعات، خدمة، أخرى.
      - دعم الحالة النشطة وغير النشطة.
      - دعم المسؤول والميزانية التقديرية والوصف.
      - حماية مغادرة الصفحة عند وجود تغييرات غير محفوظة.
      - مسح النموذج بتأكيد.
      - Error State مستقل.
      - Skeleton Loading للمراكز الأب.
      - صلاحيات آمنة بدون كسر system_admin/superuser.
      - أرقام إنجليزية دائمًا.
      - رمز SAR من /currency/sar.svg بعد الرقم.

   ------------------------------------------------------------
   تحسينات هذا الإصدار:
      - بناء صفحة إنشاء مركز تكلفة فعلية بدل الصفحة المؤقتة.
      - الالتزام بالقاعدة: w-full space-y-4 بدون main/min-h-screen/max-w.
      - إزالة أي عبارات مؤقتة أو تقنية من الواجهة.
      - إزالة localhost و API_BASE_URL الثابت.
      - استخدام sonner للتنبيهات.
      - الحفاظ على نمط صفحات النظام المعتمد.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  Layers3,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Save,
  ShieldCheck,
  WalletCards,
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

type CostCenterKind =
  | "OPERATIONAL"
  | "ADMINISTRATIVE"
  | "SALES"
  | "SERVICE"
  | "OTHER";

type ParentCostCenter = {
  id: string;
  code: string;
  name: string;
  kind: string;
  parentId: string;
  isActive: boolean;
};

type FormState = {
  code: string;
  name: string;
  kind: CostCenterKind;
  parentId: string;
  managerName: string;
  estimatedBudget: string;
  description: string;
  isActive: boolean;
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
  cost_centers?: unknown[];
  tree?: unknown[];
};

const SAR_ICON_PATH = "/currency/sar.svg";

function makeDefaultForm(): FormState {
  return {
    code: "",
    name: "",
    kind: "OPERATIONAL",
    parentId: "",
    managerName: "",
    estimatedBudget: "",
    description: "",
    isActive: true,
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
    title: isArabic ? "إنشاء مركز تكلفة" : "Create Cost Center",
    subtitle: isArabic
      ? "أضف مركز تكلفة جديدًا لتتبع المصروفات والإيرادات والحركات المحاسبية حسب الإدارة أو النشاط."
      : "Add a new cost center to track expenses, revenues, and accounting movements by department or activity.",

    back: isArabic ? "مراكز التكلفة" : "Cost Centers",
    refresh: isArabic ? "تحديث المراكز" : "Refresh Centers",
    save: isArabic ? "حفظ مركز التكلفة" : "Save Cost Center",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    clear: isArabic ? "مسح النموذج" : "Clear Form",

    mainInfo: isArabic ? "بيانات مركز التكلفة" : "Cost Center Details",
    mainInfoDesc: isArabic
      ? "المعلومات الأساسية لمركز التكلفة."
      : "Basic cost center information.",
    classification: isArabic ? "تصنيف مركز التكلفة" : "Cost Center Classification",
    classificationDesc: isArabic
      ? "حدد نوع المركز وموقعه داخل شجرة مراكز التكلفة."
      : "Set the center type and its position in the cost center tree.",
    summaryTitle: isArabic ? "ملخص مركز التكلفة" : "Cost Center Summary",
    summaryDesc: isArabic
      ? "مراجعة بيانات مركز التكلفة قبل الحفظ."
      : "Review cost center data before saving.",

    code: isArabic ? "كود مركز التكلفة" : "Cost Center Code",
    autoCode: isArabic ? "يتولد تلقائيًا" : "Generated automatically",
    name: isArabic ? "اسم مركز التكلفة" : "Cost Center Name",
    kind: isArabic ? "نوع المركز" : "Center Type",
    parentCenter: isArabic ? "المركز الأب" : "Parent Center",
    withoutParent: isArabic ? "بدون مركز أب" : "No Parent Center",
    managerName: isArabic ? "المسؤول" : "Manager",
    estimatedBudget: isArabic ? "الميزانية التقديرية" : "Estimated Budget",
    description: isArabic ? "الوصف" : "Description",

    isActive: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",

    operational: isArabic ? "تشغيلي" : "Operational",
    administrative: isArabic ? "إداري" : "Administrative",
    sales: isArabic ? "مبيعات" : "Sales",
    service: isArabic ? "خدمة" : "Service",
    other: isArabic ? "أخرى" : "Other",

    parentCentersCount: isArabic ? "المراكز المتاحة كأب" : "Available Parent Centers",
    selectedKind: isArabic ? "النوع المحدد" : "Selected Type",
    selectedParent: isArabic ? "المركز الأب المحدد" : "Selected Parent",
    selectedStatus: isArabic ? "الحالة المحددة" : "Selected Status",

    accessDeniedTitle: isArabic ? "غير مصرح بإنشاء مركز تكلفة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية إنشاء مراكز تكلفة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to create cost centers. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل مراكز التكلفة الحالية."
      : "Unable to load current cost centers.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث مراكز التكلفة الحالية."
      : "Current cost centers refreshed.",
    saveSuccess: isArabic
      ? "تم إنشاء مركز التكلفة بنجاح."
      : "Cost center created successfully.",
    saveError: isArabic
      ? "تعذر حفظ مركز التكلفة."
      : "Unable to save cost center.",

    validationTitle: isArabic ? "راجع بيانات مركز التكلفة" : "Review cost center data",
    requiredCode: isArabic
      ? "كود مركز التكلفة لم يتولد بعد."
      : "Cost center code has not been generated yet.",
    requiredName: isArabic
      ? "اسم مركز التكلفة مطلوب."
      : "Cost center name is required.",
    invalidBudget: isArabic
      ? "الميزانية التقديرية يجب أن تكون رقمًا صحيحًا."
      : "Estimated budget must be a valid number.",
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

function formatMoney(value: unknown): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function escapeNumberInput(value: string) {
  return value
    .replace(/[^\d.-]/g, "")
    .replace(/(?!^)-/g, "")
    .replace(/(\..*)\./g, "$1");
}

function extractArray(payload: unknown): unknown[] {
  const obj = asDict(payload);
  const data = asDict(obj.data);

  if (Array.isArray(obj.results)) return obj.results;
  if (Array.isArray(obj.items)) return obj.items;
  if (Array.isArray(obj.rows)) return obj.rows;
  if (Array.isArray(obj.cost_centers)) return obj.cost_centers;
  if (Array.isArray(obj.tree)) return obj.tree;

  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.cost_centers)) return data.cost_centers;
  if (Array.isArray(data.tree)) return data.tree;

  if (Array.isArray(payload)) return payload;

  return [];
}

function flattenUnknownRows(items: unknown[]): unknown[] {
  return items.flatMap((item) => {
    const obj = asDict(item);
    const children = Array.isArray(obj.children)
      ? obj.children
      : Array.isArray(obj.items)
        ? obj.items
        : Array.isArray(obj.cost_centers)
          ? obj.cost_centers
          : [];

    return [item, ...flattenUnknownRows(children)];
  });
}

function normalizeParentCostCenter(item: unknown): ParentCostCenter {
  const obj = asDict(item);
  const center = asDict(obj.cost_center || obj.costCenter || obj.center);
  const parent = asDict(obj.parent || obj.parent_cost_center);

  return {
    id: String(obj.id || obj.uuid || obj.pk || center.id || ""),
    code: String(obj.code || obj.cost_center_code || center.code || ""),
    name: String(
      obj.name ||
        obj.cost_center_name ||
        obj.title ||
        obj.name_ar ||
        center.name ||
        "",
    ),
    kind: String(obj.kind || obj.type || obj.category || center.kind || ""),
    parentId: String(
      obj.parent_id ||
        obj.parent_cost_center_id ||
        center.parent_id ||
        parent.id ||
        "",
    ),
    isActive:
      obj.is_active === undefined &&
      obj.active === undefined &&
      center.is_active === undefined
        ? true
        : Boolean(obj.is_active ?? obj.active ?? center.is_active),
  };
}

function kindLabel(kind: CostCenterKind, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<CostCenterKind, string> = {
    OPERATIONAL: t.operational,
    ADMINISTRATIVE: t.administrative,
    SALES: t.sales,
    SERVICE: t.service,
    OTHER: t.other,
  };

  return labels[kind];
}

function kindPrefix(kind: CostCenterKind) {
  const prefixes: Record<CostCenterKind, string> = {
    OPERATIONAL: "CC1",
    ADMINISTRATIVE: "CC2",
    SALES: "CC3",
    SERVICE: "CC4",
    OTHER: "CC5",
  };

  return prefixes[kind];
}

function nextSequentialCode(codes: string[], baseCode: string, minLength: number) {
  const numericCodes = codes
    .map((code) => String(code || "").replace(/\D/g, ""))
    .filter(Boolean)
    .map((code) => Number(code))
    .filter((value) => Number.isFinite(value));

  const baseNumber = Number(baseCode.replace(/\D/g, ""));
  const maxNumber =
    numericCodes.length > 0 ? Math.max(...numericCodes) : baseNumber;

  const next = maxNumber + 1;
  return String(next).padStart(minLength, "0");
}

function generateSequentialCostCenterCode({
  centers,
  parentId,
  kind,
}: {
  centers: ParentCostCenter[];
  parentId: string;
  kind: CostCenterKind;
}) {
  const activeCenters = centers.filter((center) => center.code);

  if (parentId) {
    const parent = activeCenters.find((center) => center.id === parentId);
    const parentCode = parent?.code?.trim() || "";

    if (!parentCode) return "";

    const directChildren = activeCenters.filter(
      (center) => center.parentId === parentId,
    );

    const childCodes = directChildren.map((center) => center.code);

    if (childCodes.length > 0) {
      const nextNumber = nextSequentialCode(
        childCodes,
        `${parentCode}00`,
        parentCode.replace(/\D/g, "").length + 2,
      );

      return `${parentCode}-${nextNumber.slice(-2)}`;
    }

    return `${parentCode}-01`;
  }

  const prefix = kindPrefix(kind);
  const rootCenters = activeCenters.filter((center) => {
    const code = center.code.trim();
    const hasNoParent = !center.parentId;

    return hasNoParent && code.startsWith(prefix);
  });

  const rootCodes = rootCenters.map((center) => center.code);

  if (rootCodes.length > 0) {
    const nextNumber = nextSequentialCode(rootCodes, `${prefix}000`, 3);
    return `${prefix}-${nextNumber.slice(-3)}`;
  }

  return `${prefix}-001`;
}

function SarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Image
      src={SAR_ICON_PATH}
      alt=""
      width={16}
      height={16}
      className={className}
    />
  );
}

function MoneyText({ value }: { value: unknown }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span>{formatMoney(value)}</span>
      <SarIcon className="h-3.5 w-3.5" />
    </span>
  );
}

/* ============================================================
   Page
============================================================ */

export default function CreateAccountingCostCenterPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [form, setForm] = useState<FormState>(() => makeDefaultForm());
  const [parentCenters, setParentCenters] = useState<ParentCostCenter[]>([]);
  const [isLoadingParents, setIsLoadingParents] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canCreate = hasSafePermission(
    auth,
    [
      "accounting.create",
      "accounting.cost_centers.create",
      "accounting.manage",
    ],
    "action",
  );

  const activeParentCenters = useMemo(
    () =>
      parentCenters
        .filter((item) => item.id && item.name && item.isActive)
        .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`)),
    [parentCenters],
  );

  const selectedParent = useMemo(
    () => activeParentCenters.find((item) => item.id === form.parentId),
    [activeParentCenters, form.parentId],
  );

  const generatedCode = useMemo(
    () =>
      generateSequentialCostCenterCode({
        centers: activeParentCenters,
        parentId: form.parentId,
        kind: form.kind,
      }),
    [activeParentCenters, form.kind, form.parentId],
  );

  const estimatedBudgetNumber = useMemo(
    () => toNumber(form.estimatedBudget || 0),
    [form.estimatedBudget],
  );

  const canSubmit = canCreate && !isSaving && Boolean(form.code);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setIsDirty(true);
  }

  function handleKindChange(value: CostCenterKind) {
    setForm((current) => ({
      ...current,
      kind: value,
      parentId: "",
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

    if (!form.code.trim()) errors.push(t.requiredCode);
    if (!form.name.trim()) errors.push(t.requiredName);

    if (
      form.estimatedBudget.trim() &&
      !Number.isFinite(Number(form.estimatedBudget))
    ) {
      errors.push(t.invalidBudget);
    }

    return Array.from(new Set(errors));
  }

  function buildPayload() {
    return {
      code: form.code.trim(),
      cost_center_code: form.code.trim(),
      name: form.name.trim(),
      cost_center_name: form.name.trim(),
      kind: form.kind,
      type: form.kind,
      category: form.kind,
      parent_id: form.parentId || null,
      parent: form.parentId || null,
      manager_name: form.managerName.trim(),
      responsible_name: form.managerName.trim(),
      estimated_budget: estimatedBudgetNumber,
      budget_amount: estimatedBudgetNumber,
      description: form.description.trim(),
      notes: form.description.trim(),
      is_active: form.isActive,
      active: form.isActive,
      status: form.isActive ? "ACTIVE" : "INACTIVE",
    };
  }

  const loadParentCenters = useCallback(
    async (showToast = false) => {
      try {
        setIsLoadingParents(true);
        setLoadError("");

        const endpoints = [
          "/api/accounting/cost-centers/?page_size=500",
          "/api/accounting/reports/cost-centers/?page_size=500",
        ];

        let loadedRows: ParentCostCenter[] = [];
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

          loadedRows = flattenUnknownRows(extractArray(payload))
            .map(normalizeParentCostCenter)
            .filter((item) => item.id && item.name && item.code);

          loaded = true;
          break;
        }

        if (!loaded) {
          throw new Error(lastError || t.loadError);
        }

        setParentCenters(loadedRows);

        if (showToast) {
          toast.success(t.loadSuccess);
        }
      } catch (error) {
        console.error("Parent cost centers load error:", error);
        setParentCenters([]);
        setLoadError(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoadingParents(false);
      }
    },
    [t.loadError, t.loadSuccess],
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
        "/api/accounting/cost-centers/create/",
        "/api/accounting/cost-centers/",
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
      await loadParentCenters(false);
    } catch (error) {
      console.error("Create cost center submit error:", error);
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
    loadParentCenters(false);
  }, [authResolving, loadParentCenters]);

  useEffect(() => {
    if (!generatedCode) return;

    setForm((current) => {
      if (current.code === generatedCode) return current;

      return {
        ...current,
        code: generatedCode,
      };
    });
  }, [generatedCode]);

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
            href="/system/accounting/cost-centers"
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
            onClick={() => loadParentCenters(true)}
            disabled={isLoadingParents || isSaving}
          >
            {isLoadingParents ? (
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
              onClick={() => loadParentCenters(true)}
              disabled={isLoadingParents}
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
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.code}</label>
                <Input
                  value={form.code}
                  readOnly
                  disabled={isSaving || isLoadingParents}
                  dir="ltr"
                  className="h-11 rounded-xl bg-muted/40"
                />
                <p className="text-xs text-muted-foreground">{t.autoCode}</p>
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
                <label className="text-sm font-medium">{t.managerName}</label>
                <Input
                  value={form.managerName}
                  onChange={(event) =>
                    updateForm("managerName", event.target.value)
                  }
                  disabled={isSaving}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t.estimatedBudget}
                </label>
                <div className="relative">
                  <Input
                    inputMode="decimal"
                    value={form.estimatedBudget}
                    onChange={(event) =>
                      updateForm(
                        "estimatedBudget",
                        escapeNumberInput(event.target.value),
                      )
                    }
                    disabled={isSaving}
                    dir="ltr"
                    className="h-11 rounded-xl pe-10"
                  />
                  <SarIcon
                    className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                      isArabic ? "left-3" : "right-3"
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">{t.description}</label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateForm("description", event.target.value)
                  }
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
                <Building2 className="h-4 w-4" />
                {t.classification}
              </CardTitle>
              <CardDescription>{t.classificationDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.kind}</label>
                <select
                  value={form.kind}
                  onChange={(event) =>
                    handleKindChange(event.target.value as CostCenterKind)
                  }
                  disabled={isSaving}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="OPERATIONAL">{t.operational}</option>
                  <option value="ADMINISTRATIVE">{t.administrative}</option>
                  <option value="SALES">{t.sales}</option>
                  <option value="SERVICE">{t.service}</option>
                  <option value="OTHER">{t.other}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.parentCenter}</label>
                {isLoadingParents ? (
                  <div className="h-11 animate-pulse rounded-xl bg-muted" />
                ) : (
                  <select
                    value={form.parentId}
                    onChange={(event) =>
                      updateForm("parentId", event.target.value)
                    }
                    disabled={isSaving}
                    className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">{t.withoutParent}</option>
                    {activeParentCenters.map((center) => (
                      <option key={center.id} value={center.id}>
                        {[center.code, center.name].filter(Boolean).join(" - ")}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-background p-3 text-sm">
                  <Checkbox
                    checked={form.isActive}
                    onCheckedChange={(checked) =>
                      updateForm("isActive", Boolean(checked))
                    }
                    disabled={isSaving}
                  />
                  <span>{t.isActive}</span>
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
                <p className="text-xs text-muted-foreground">{t.code}</p>
                <p className="mt-2 font-semibold" dir="ltr">
                  {form.code || "-"}
                </p>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">{t.name}</p>
                <p className="mt-2 font-semibold">{form.name || "-"}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.selectedKind}
                  </p>
                  <p className="mt-2 font-semibold">
                    {kindLabel(form.kind, locale)}
                  </p>
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.selectedStatus}
                  </p>
                  <p className="mt-2 font-semibold">
                    {form.isActive ? t.isActive : t.inactive}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">
                  {t.selectedParent}
                </p>
                <p className="mt-2 text-sm font-semibold leading-6">
                  {selectedParent
                    ? [selectedParent.code, selectedParent.name]
                        .filter(Boolean)
                        .join(" - ")
                    : t.withoutParent}
                </p>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">
                  {t.estimatedBudget}
                </p>
                <div className="mt-2 text-xl font-bold">
                  <MoneyText value={estimatedBudgetNumber} />
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
                <Layers3 className="h-4 w-4" />
                {t.parentCentersCount}
              </div>

              <div className="text-2xl font-bold">
                {isLoadingParents
                  ? "..."
                  : formatNumber(activeParentCenters.length)}
              </div>

              <p className="text-sm leading-6 text-muted-foreground">
                {selectedParent
                  ? [selectedParent.code, selectedParent.name]
                      .filter(Boolean)
                      .join(" - ")
                  : t.withoutParent}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4" />
                {form.isActive ? t.isActive : t.inactive}
              </div>

              <p className="text-sm leading-6 text-muted-foreground">
                {kindLabel(form.kind, locale)}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <WalletCards className="h-4 w-4" />
                {t.estimatedBudget}
              </div>

              <div className="text-2xl font-bold">
                <MoneyText value={estimatedBudgetNumber} />
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}