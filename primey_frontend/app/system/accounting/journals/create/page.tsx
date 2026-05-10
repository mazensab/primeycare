"use client";

/* ============================================================
   📂 app/system/accounting/journals/create/page.tsx
   🧠 Primey Care | Create Journal Entry Page

   ✅ المسار:
      app/system/accounting/journals/create/page.tsx

   ✅ العمل:
      صفحة إنشاء قيد يومية داخل مديول المحاسبة.
      تتيح إدخال بيانات القيد وسطور المدين والدائن ومركز التكلفة والمرجع.

   ✅ الإصدار:
      Phase 17 UX Refinement + Accounting Journal Create Review

   ✅ يعتمد على:
      - /api/accounting/accounts/
      - /api/accounting/cost-centers/
      - /api/accounting/journals/create/
      - /api/accounting/journal-entries/create/ كـ fallback آمن
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Accounting module approved pattern
      - Accounting journals list page
      - Centers approved UX pattern
      - Customers approved UX pattern

   ✅ الوظائف:
      - إنشاء قيد يومية يدوي.
      - إضافة أكثر من سطر قيد.
      - دعم الحسابات ومراكز التكلفة.
      - احتساب إجمالي المدين والدائن وفرق التوازن.
      - منع الحفظ إذا كان القيد غير متوازن.
      - حماية مغادرة الصفحة عند وجود تغييرات غير محفوظة.
      - مسح النموذج بتأكيد.
      - Skeleton Loading للقوائم.
      - Error State مستقل.
      - إخفاء الحفظ حسب الصلاحيات.
      - sonner للتنبيهات.
      - استخدام رمز SAR بعد الرقم.

   ------------------------------------------------------------
   تحسينات هذا الإصدار:
      - إصلاح الخطأ السابق بعدم جعل الصفحة full-page خارج نمط النظام.
      - استخدام نفس نمط صفحات النظام: w-full space-y-4.
      - الحفاظ على تصميم Create Page المعتمد: Header actions + Main form + Sidebar summary.
      - إزالة الخلط الموجود داخل الملف مع وحدة المراكز.
      - إزالة أي عبارات تقنية أو مؤقتة من الواجهة.
      - عدم استخدام localhost أو API_BASE_URL ثابت.
      - دعم مراكز التكلفة ومصادر الترحيل اليدوية.
      - دعم fallback آمن للإنشاء بدون كسر البناء.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  FileText,
  Layers3,
  Loader2,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Trash2,
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

type OptionItem = {
  id: string;
  code: string;
  name: string;
  type?: string;
  isActive: boolean;
};

type JournalLine = {
  localId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  costCenterId: string;
  costCenterCode: string;
  costCenterName: string;
  debit: string;
  credit: string;
  description: string;
};

type FormState = {
  entryDate: string;
  reference: string;
  externalReference: string;
  description: string;
  notes: string;
  postingSource: "MANUAL" | "OPENING" | "ADJUSTMENT";
  lines: JournalLine[];
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
  accounts?: unknown[];
  cost_centers?: unknown[];
};

const SAR_ICON_PATH = "/currency/sar.svg";

function makeLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultLine(): JournalLine {
  return {
    localId: makeLocalId(),
    accountId: "",
    accountCode: "",
    accountName: "",
    costCenterId: "",
    costCenterCode: "",
    costCenterName: "",
    debit: "",
    credit: "",
    description: "",
  };
}

function defaultForm(): FormState {
  return {
    entryDate: new Date().toISOString().slice(0, 10),
    reference: "",
    externalReference: "",
    description: "",
    notes: "",
    postingSource: "MANUAL",
    lines: [defaultLine(), defaultLine()],
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
    title: isArabic ? "إنشاء قيد يومية" : "Create Journal Entry",
    subtitle: isArabic
      ? "أدخل بيانات القيد وسطور المدين والدائن مع اختيار الحساب ومركز التكلفة عند الحاجة."
      : "Enter journal details and debit-credit lines with account and cost center when needed.",

    back: isArabic ? "القيود اليومية" : "Journal Entries",
    refresh: isArabic ? "تحديث القوائم" : "Refresh Lists",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    save: isArabic ? "حفظ القيد" : "Save Entry",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    clear: isArabic ? "مسح النموذج" : "Clear Form",
    addLine: isArabic ? "إضافة سطر" : "Add Line",
    removeLine: isArabic ? "حذف السطر" : "Remove Line",

    mainInfo: isArabic ? "بيانات القيد" : "Entry Details",
    mainInfoDesc: isArabic
      ? "المعلومات الأساسية للقيد اليومي."
      : "Basic information for the journal entry.",
    linesTitle: isArabic ? "سطور القيد" : "Journal Lines",
    linesDesc: isArabic
      ? "يجب أن يكون إجمالي المدين مساويًا لإجمالي الدائن قبل الحفظ."
      : "Total debit must equal total credit before saving.",
    summaryTitle: isArabic ? "ملخص القيد" : "Entry Summary",
    summaryDesc: isArabic
      ? "مراجعة التوازن قبل حفظ القيد."
      : "Review balance before saving the entry.",

    entryDate: isArabic ? "تاريخ القيد" : "Entry Date",
    reference: isArabic ? "المرجع" : "Reference",
    externalReference: isArabic ? "مرجع خارجي" : "External Reference",
    postingSource: isArabic ? "مصدر الترحيل" : "Posting Source",
    description: isArabic ? "الوصف" : "Description",
    notes: isArabic ? "ملاحظات" : "Notes",

    account: isArabic ? "الحساب" : "Account",
    costCenter: isArabic ? "مركز التكلفة" : "Cost Center",
    debit: isArabic ? "مدين" : "Debit",
    credit: isArabic ? "دائن" : "Credit",
    lineDescription: isArabic ? "وصف السطر" : "Line Description",
    action: isArabic ? "الإجراء" : "Action",

    chooseAccount: isArabic ? "اختر الحساب" : "Choose account",
    chooseCostCenter: isArabic ? "بدون مركز تكلفة" : "No cost center",
    manual: isArabic ? "يدوي" : "Manual",
    opening: isArabic ? "رصيد افتتاحي" : "Opening Balance",
    adjustment: isArabic ? "تسوية" : "Adjustment",

    totalDebit: isArabic ? "إجمالي المدين" : "Total Debit",
    totalCredit: isArabic ? "إجمالي الدائن" : "Total Credit",
    difference: isArabic ? "فرق التوازن" : "Difference",
    balanced: isArabic ? "القيد متوازن" : "Entry is balanced",
    notBalanced: isArabic ? "القيد غير متوازن" : "Entry is not balanced",
    linesCount: isArabic ? "عدد السطور" : "Lines Count",

    accessDeniedTitle: isArabic ? "غير مصرح بإنشاء القيود" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية إنشاء قيد يومية. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to create journal entries. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل قوائم الحسابات ومراكز التكلفة."
      : "Unable to load accounts and cost centers.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    saveSuccess: isArabic
      ? "تم إنشاء القيد بنجاح."
      : "Journal entry created successfully.",
    saveError: isArabic
      ? "تعذر حفظ القيد."
      : "Unable to save journal entry.",
    validationTitle: isArabic ? "راجع بيانات القيد" : "Review entry data",
    requiredDate: isArabic ? "تاريخ القيد مطلوب." : "Entry date is required.",
    requiredDescription: isArabic
      ? "وصف القيد مطلوب."
      : "Entry description is required.",
    requiredLines: isArabic
      ? "أضف سطرين على الأقل للقيد."
      : "Add at least two journal lines.",
    requiredAccount: isArabic
      ? "كل سطر بقيمة مالية يحتاج اختيار حساب."
      : "Every line with an amount requires an account.",
    lineAmountRequired: isArabic
      ? "كل سطر يحتاج مبلغ مدين أو دائن."
      : "Every line requires either debit or credit amount.",
    oneSideOnly: isArabic
      ? "لا يمكن إدخال مدين ودائن في نفس السطر."
      : "A line cannot have both debit and credit.",
    balanceRequired: isArabic
      ? "لا يمكن حفظ قيد غير متوازن."
      : "Unbalanced entry cannot be saved.",
    confirmClear: isArabic
      ? "هل تريد مسح النموذج الحالي؟"
      : "Clear the current form?",
    unsavedChanges: isArabic
      ? "لديك تغييرات غير محفوظة. هل تريد المغادرة؟"
      : "You have unsaved changes. Do you want to leave?",

    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",
  };
}

/* ============================================================
   Helpers
============================================================ */

function toNumber(value: unknown): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0.00";

  return numericValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeNumberInput(value: string) {
  return value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
}

function extractArray(payload: unknown): unknown[] {
  const obj = asDict(payload);
  const data = asDict(obj.data);

  if (Array.isArray(obj.results)) return obj.results;
  if (Array.isArray(obj.items)) return obj.items;
  if (Array.isArray(obj.rows)) return obj.rows;
  if (Array.isArray(obj.accounts)) return obj.accounts;
  if (Array.isArray(obj.cost_centers)) return obj.cost_centers;

  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.accounts)) return data.accounts;
  if (Array.isArray(data.cost_centers)) return data.cost_centers;

  if (Array.isArray(payload)) return payload;

  return [];
}

function normalizeOption(item: unknown): OptionItem {
  const obj = asDict(item);

  return {
    id: String(obj.id || obj.uuid || obj.pk || ""),
    code: String(obj.code || obj.account_code || obj.number || ""),
    name: String(obj.name || obj.account_name || obj.title || ""),
    type: String(obj.type || obj.account_type || ""),
    isActive:
      obj.is_active === undefined && obj.active === undefined
        ? true
        : Boolean(obj.is_active ?? obj.active),
  };
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

function MoneyText({ value }: { value: number | string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{formatMoney(value)}</span>
      <SarIcon className="h-3.5 w-3.5" />
    </span>
  );
}

/* ============================================================
   Page
============================================================ */

export default function CreateJournalEntryPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [form, setForm] = useState<FormState>(() => defaultForm());
  const [accounts, setAccounts] = useState<OptionItem[]>([]);
  const [costCenters, setCostCenters] = useState<OptionItem[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canCreate = hasSafePermission(
    auth,
    ["accounting.create", "accounting.journals.create", "accounting.post"],
    "action",
  );

  const totals = useMemo(() => {
    const totalDebit = form.lines.reduce(
      (sum, line) => sum + toNumber(line.debit),
      0,
    );
    const totalCredit = form.lines.reduce(
      (sum, line) => sum + toNumber(line.credit),
      0,
    );
    const difference = totalDebit - totalCredit;

    return {
      totalDebit,
      totalCredit,
      difference,
      isBalanced:
        totalDebit > 0 &&
        totalCredit > 0 &&
        Math.abs(difference) < 0.005,
    };
  }, [form.lines]);

  const activeAccounts = useMemo(
    () =>
      accounts
        .filter((item) => item.id && item.name && item.isActive)
        .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`)),
    [accounts],
  );

  const activeCostCenters = useMemo(
    () =>
      costCenters
        .filter((item) => item.id && item.name && item.isActive)
        .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`)),
    [costCenters],
  );

  const canSubmit = canCreate && !isSaving && totals.isBalanced;

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setIsDirty(true);
  }

  function updateLine(localId: string, updates: Partial<JournalLine>) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.localId === localId ? { ...line, ...updates } : line,
      ),
    }));
    setIsDirty(true);
  }

  function handleAccountChange(localId: string, accountId: string) {
    const account = activeAccounts.find((item) => item.id === accountId);

    updateLine(localId, {
      accountId,
      accountCode: account?.code || "",
      accountName: account?.name || "",
    });
  }

  function handleCostCenterChange(localId: string, costCenterId: string) {
    const costCenter = activeCostCenters.find((item) => item.id === costCenterId);

    updateLine(localId, {
      costCenterId,
      costCenterCode: costCenter?.code || "",
      costCenterName: costCenter?.name || "",
    });
  }

  function addLine() {
    setForm((current) => ({
      ...current,
      lines: [...current.lines, defaultLine()],
    }));
    setIsDirty(true);
  }

  function removeLine(localId: string) {
    setForm((current) => ({
      ...current,
      lines:
        current.lines.length <= 2
          ? current.lines
          : current.lines.filter((line) => line.localId !== localId),
    }));
    setIsDirty(true);
  }

  function clearForm() {
    if (isDirty && !window.confirm(t.confirmClear)) return;

    setForm(defaultForm());
    setSubmitError("");
    setIsDirty(false);
  }

  function validateForm() {
    const errors: string[] = [];

    if (!form.entryDate) errors.push(t.requiredDate);
    if (!form.description.trim()) errors.push(t.requiredDescription);

    const usedLines = form.lines.filter(
      (line) => toNumber(line.debit) > 0 || toNumber(line.credit) > 0,
    );

    if (usedLines.length < 2) errors.push(t.requiredLines);

    usedLines.forEach((line) => {
      const debit = toNumber(line.debit);
      const credit = toNumber(line.credit);

      if (!line.accountId) errors.push(t.requiredAccount);
      if (debit <= 0 && credit <= 0) errors.push(t.lineAmountRequired);
      if (debit > 0 && credit > 0) errors.push(t.oneSideOnly);
    });

    if (!totals.isBalanced) errors.push(t.balanceRequired);

    return Array.from(new Set(errors));
  }

  function buildPayload() {
    const lines = form.lines
      .filter((line) => toNumber(line.debit) > 0 || toNumber(line.credit) > 0)
      .map((line) => ({
        account_id: line.accountId,
        account: line.accountId,
        cost_center_id: line.costCenterId || null,
        cost_center: line.costCenterId || null,
        debit: toNumber(line.debit),
        debit_amount: toNumber(line.debit),
        credit: toNumber(line.credit),
        credit_amount: toNumber(line.credit),
        description: line.description.trim() || form.description.trim(),
      }));

    return {
      entry_date: form.entryDate,
      date: form.entryDate,
      reference: form.reference.trim(),
      external_reference: form.externalReference.trim(),
      description: form.description.trim(),
      notes: form.notes.trim(),
      posting_source: form.postingSource,
      source: form.postingSource,
      lines,
      entries: lines,
      items: lines,
    };
  }

  const loadOptions = useCallback(
    async (showToast = false) => {
      try {
        setIsLoadingOptions(true);
        setLoadError("");

        const [accountsResult, costCentersResult] = await Promise.allSettled([
          fetch(apiUrl("/api/accounting/accounts/?page_size=500"), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          }),
          fetch(apiUrl("/api/accounting/cost-centers/?page_size=500"), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          }),
        ]);

        async function readList(result: PromiseSettledResult<Response>) {
          if (result.status !== "fulfilled") return [];

          if (!result.value.ok) {
            if (result.value.status === 404 || result.value.status === 405) {
              return [];
            }

            throw new Error(`HTTP ${result.value.status}`);
          }

          const payload = await result.value.json().catch(() => null);

          return extractArray(payload).map(normalizeOption);
        }

        const [accountRows, costCenterRows] = await Promise.all([
          readList(accountsResult),
          readList(costCentersResult),
        ]);

        setAccounts(accountRows);
        setCostCenters(costCenterRows);

        if (showToast) {
          toast.success(locale === "ar" ? "تم تحديث القوائم." : "Lists refreshed.");
        }
      } catch (error) {
        console.error("Create journal options load error:", error);
        setLoadError(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoadingOptions(false);
      }
    },
    [locale, t.loadError],
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
        "/api/accounting/journals/create/",
        "/api/accounting/journal-entries/create/",
        "/api/accounting/journals/",
        "/api/accounting/journal-entries/",
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

        if (response.status === 404 || response.status === 405) {
          lastMessage = responsePayload?.message || responsePayload?.detail || "";
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
      setIsDirty(false);
      setForm(defaultForm());
    } catch (error) {
      console.error("Create journal submit error:", error);
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
    loadOptions(false);
  }, [authResolving, loadOptions]);

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
            href="/system/accounting/journals"
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
            onClick={() => loadOptions(true)}
            disabled={isLoadingOptions || isSaving}
          >
            {isLoadingOptions ? (
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
              onClick={() => loadOptions(true)}
              disabled={isLoadingOptions}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
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
                <label className="text-sm font-medium">{t.entryDate}</label>
                <Input
                  type="date"
                  value={form.entryDate}
                  onChange={(event) =>
                    updateForm("entryDate", event.target.value)
                  }
                  disabled={isSaving}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.postingSource}</label>
                <select
                  value={form.postingSource}
                  onChange={(event) =>
                    updateForm(
                      "postingSource",
                      event.target.value as FormState["postingSource"],
                    )
                  }
                  disabled={isSaving}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="MANUAL">{t.manual}</option>
                  <option value="OPENING">{t.opening}</option>
                  <option value="ADJUSTMENT">{t.adjustment}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.reference}</label>
                <Input
                  value={form.reference}
                  onChange={(event) =>
                    updateForm("reference", event.target.value)
                  }
                  disabled={isSaving}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t.externalReference}
                </label>
                <Input
                  value={form.externalReference}
                  onChange={(event) =>
                    updateForm("externalReference", event.target.value)
                  }
                  disabled={isSaving}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">{t.description}</label>
                <Input
                  value={form.description}
                  onChange={(event) =>
                    updateForm("description", event.target.value)
                  }
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
            <CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <WalletCards className="h-4 w-4" />
                  {t.linesTitle}
                </CardTitle>
                <CardDescription>{t.linesDesc}</CardDescription>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={addLine}
                disabled={isSaving}
              >
                <Plus className="h-4 w-4" />
                {t.addLine}
              </Button>
            </CardHeader>

            <CardContent>
              <div className="overflow-hidden rounded-xl border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.account}</TableHead>
                        <TableHead>{t.costCenter}</TableHead>
                        <TableHead>{t.debit}</TableHead>
                        <TableHead>{t.credit}</TableHead>
                        <TableHead>{t.lineDescription}</TableHead>
                        <TableHead>{t.action}</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {isLoadingOptions ? (
                        Array.from({ length: 2 }).map((_, index) => (
                          <TableRow key={index}>
                            {Array.from({ length: 6 }).map((__, cellIndex) => (
                              <TableCell key={cellIndex}>
                                <div className="h-9 animate-pulse rounded-lg bg-muted" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        form.lines.map((line) => (
                          <TableRow key={line.localId}>
                            <TableCell>
                              <select
                                value={line.accountId}
                                onChange={(event) =>
                                  handleAccountChange(
                                    line.localId,
                                    event.target.value,
                                  )
                                }
                                disabled={isSaving}
                                className="h-10 min-w-[220px] rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                              >
                                <option value="">{t.chooseAccount}</option>
                                {activeAccounts.map((account) => (
                                  <option key={account.id} value={account.id}>
                                    {[account.code, account.name]
                                      .filter(Boolean)
                                      .join(" - ")}
                                  </option>
                                ))}
                              </select>
                            </TableCell>

                            <TableCell>
                              <select
                                value={line.costCenterId}
                                onChange={(event) =>
                                  handleCostCenterChange(
                                    line.localId,
                                    event.target.value,
                                  )
                                }
                                disabled={isSaving}
                                className="h-10 min-w-[190px] rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                              >
                                <option value="">{t.chooseCostCenter}</option>
                                {activeCostCenters.map((costCenter) => (
                                  <option
                                    key={costCenter.id}
                                    value={costCenter.id}
                                  >
                                    {[costCenter.code, costCenter.name]
                                      .filter(Boolean)
                                      .join(" - ")}
                                  </option>
                                ))}
                              </select>
                            </TableCell>

                            <TableCell>
                              <Input
                                inputMode="decimal"
                                value={line.debit}
                                onChange={(event) => {
                                  const value = escapeNumberInput(
                                    event.target.value,
                                  );

                                  updateLine(line.localId, {
                                    debit: value,
                                    credit: value ? "" : line.credit,
                                  });
                                }}
                                disabled={isSaving}
                                className="h-10 min-w-[120px] rounded-xl"
                              />
                            </TableCell>

                            <TableCell>
                              <Input
                                inputMode="decimal"
                                value={line.credit}
                                onChange={(event) => {
                                  const value = escapeNumberInput(
                                    event.target.value,
                                  );

                                  updateLine(line.localId, {
                                    credit: value,
                                    debit: value ? "" : line.debit,
                                  });
                                }}
                                disabled={isSaving}
                                className="h-10 min-w-[120px] rounded-xl"
                              />
                            </TableCell>

                            <TableCell>
                              <Input
                                value={line.description}
                                onChange={(event) =>
                                  updateLine(line.localId, {
                                    description: event.target.value,
                                  })
                                }
                                disabled={isSaving}
                                className="h-10 min-w-[180px] rounded-xl"
                              />
                            </TableCell>

                            <TableCell>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 rounded-xl"
                                onClick={() => removeLine(line.localId)}
                                disabled={isSaving || form.lines.length <= 2}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">{t.removeLine}</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
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
                <p className="text-xs text-muted-foreground">{t.totalDebit}</p>
                <div className="mt-2 text-xl font-bold">
                  <MoneyText value={totals.totalDebit} />
                </div>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">{t.totalCredit}</p>
                <div className="mt-2 text-xl font-bold">
                  <MoneyText value={totals.totalCredit} />
                </div>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">{t.difference}</p>
                <div className="mt-2 text-xl font-bold">
                  <MoneyText value={totals.difference} />
                </div>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">{t.linesCount}</p>
                <div className="mt-2 text-2xl font-bold">
                  {form.lines.length.toLocaleString("en-US")}
                </div>
              </div>

              {totals.isBalanced ? (
                <Badge className="w-full justify-center rounded-2xl border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  {t.balanced}
                </Badge>
              ) : (
                <Badge
                  variant="destructive"
                  className="w-full justify-center rounded-2xl px-3 py-2"
                >
                  <XCircle className="h-4 w-4" />
                  {t.notBalanced}
                </Badge>
              )}

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
                {t.costCenter}
              </div>

              <p className="text-sm leading-6 text-muted-foreground">
                {activeCostCenters.length > 0
                  ? `${activeCostCenters.length.toLocaleString("en-US")} ${t.costCenter}`
                  : t.chooseCostCenter}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}