"use client";

/* ============================================================
   📂 app/system/treasury/transactions/create/page.tsx
   🧠 Primey Care | Create Treasury Transaction Page

   ✅ المسار:
      app/system/treasury/transactions/create/page.tsx

   ✅ العمل:
      صفحة إنشاء حركة خزينة داخل النظام.
      تدعم إنشاء سند قبض، سند صرف، تحويل داخلي، وتسوية مالية.

   ✅ الإصدار:
      Phase 17 UX Refinement + Treasury Transaction Create Build

   ✅ يعتمد على:
      - /api/treasury/transactions/create/
      - /api/treasury/transactions/
      - /api/treasury/accounts/
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Treasury overview page
      - Treasury transactions page
      - Treasury transaction details page
      - Treasury accounts page
      - Treasury account statement page
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - إنشاء سند قبض.
      - إنشاء سند صرف.
      - إنشاء تحويل داخلي.
      - إنشاء تسوية.
      - اختيار حساب الخزينة.
      - اختيار حساب التحويل المستلم عند نوع التحويل.
      - مبلغ الحركة.
      - تاريخ الحركة.
      - مرجع خارجي اختياري.
      - وصف وملاحظات.
      - حفظ كمسودة أو تأكيد مباشر حسب دعم الباكند.
      - حماية مغادرة الصفحة عند وجود تغييرات غير محفوظة.
      - مسح النموذج بتأكيد.
      - Error State مستقل.
      - صلاحيات آمنة بدون كسر system_admin/superuser.
      - أرقام إنجليزية دائمًا.
      - رمز SAR من /currency/sar.svg بعد الرقم.
      - استخدام sonner للتنبيهات.

   ------------------------------------------------------------
   تحسينات هذا الإصدار:
      - الملف المرفق كان فارغًا تقريبًا، وتم بناء الصفحة كاملة من الصفر.
      - الالتزام بالقاعدة: w-full space-y-4 بدون main/min-h-screen/max-w.
      - عدم عرض أي مسارات أو عبارات تقنية داخل واجهة المستخدم.
      - إخفاء الأزرار غير المصرح بها بدل تعطيلها.
      - إزالة أي localhost أو API base ثابت.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  Receipt,
  RefreshCcw,
  RotateCcw,
  Save,
  ShieldCheck,
  Wallet,
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

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";
type Dict = Record<string, unknown>;

type TransactionType = "RECEIPT" | "PAYMENT" | "TRANSFER" | "ADJUSTMENT";
type TransactionStatus = "DRAFT" | "CONFIRMED";

type TreasuryAccountOption = {
  id: string;
  name: string;
  code: string;
  account_type: string;
  status: string;
  current_balance: number;
  bank_name: string;
  account_number: string;
  iban: string;
};

type FormState = {
  transactionType: TransactionType;
  status: TransactionStatus;
  transactionDate: string;
  accountId: string;
  toAccountId: string;
  amount: string;
  sourceReference: string;
  description: string;
  notes: string;
};

type ApiEnvelope<T> = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  data?: T;
  id?: string | number;
  results?: unknown[];
  items?: unknown[];
  rows?: unknown[];
  accounts?: unknown[];
};

const SAR_ICON_PATH = "/currency/sar.svg";

function todayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function makeDefaultForm(): FormState {
  return {
    transactionType: "RECEIPT",
    status: "CONFIRMED",
    transactionDate: todayInputValue(),
    accountId: "",
    toAccountId: "",
    amount: "",
    sourceReference: "",
    description: "",
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
    title: isArabic ? "إنشاء حركة مالية" : "Create Treasury Transaction",
    subtitle: isArabic
      ? "سجل سند قبض أو سند صرف أو تحويل داخلي أو تسوية مالية داخل الخزينة."
      : "Record a receipt, payment, internal transfer, or treasury adjustment.",

    back: isArabic ? "الحركات المالية" : "Transactions",
    treasury: isArabic ? "الخزينة" : "Treasury",
    accounts: isArabic ? "حسابات الخزينة" : "Treasury Accounts",
    save: isArabic ? "حفظ الحركة" : "Save Transaction",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    clear: isArabic ? "مسح النموذج" : "Clear Form",
    refreshAccounts: isArabic ? "تحديث الحسابات" : "Refresh Accounts",

    mainInfo: isArabic ? "بيانات الحركة" : "Transaction Details",
    mainInfoDesc: isArabic
      ? "حدد نوع الحركة وحالتها وتاريخها."
      : "Select transaction type, status, and date.",

    accountInfo: isArabic ? "حسابات الخزينة" : "Treasury Accounts",
    accountInfoDesc: isArabic
      ? "اختر الحساب المرتبط بالحركة. في التحويل الداخلي اختر حساب المصدر والمستلم."
      : "Select the linked account. For transfers, select source and destination accounts.",

    amountInfo: isArabic ? "المبلغ والمرجع" : "Amount and Reference",
    amountInfoDesc: isArabic
      ? "أدخل مبلغ الحركة والمرجع والوصف."
      : "Enter amount, reference, and description.",

    summaryTitle: isArabic ? "ملخص الحركة" : "Transaction Summary",
    summaryDesc: isArabic
      ? "راجع بيانات الحركة قبل الحفظ."
      : "Review transaction data before saving.",

    transactionType: isArabic ? "نوع الحركة" : "Transaction Type",
    status: isArabic ? "حالة الحركة" : "Status",
    date: isArabic ? "تاريخ الحركة" : "Transaction Date",
    account: isArabic ? "حساب الخزينة" : "Treasury Account",
    fromAccount: isArabic ? "حساب المصدر" : "Source Account",
    toAccount: isArabic ? "حساب المستلم" : "Destination Account",
    amount: isArabic ? "المبلغ" : "Amount",
    sourceReference: isArabic ? "المرجع" : "Reference",
    description: isArabic ? "الوصف" : "Description",
    notes: isArabic ? "ملاحظات داخلية" : "Internal Notes",

    receipt: isArabic ? "سند قبض" : "Receipt Voucher",
    payment: isArabic ? "سند صرف" : "Payment Voucher",
    transfer: isArabic ? "تحويل داخلي" : "Internal Transfer",
    adjustment: isArabic ? "تسوية مالية" : "Adjustment",

    draft: isArabic ? "مسودة" : "Draft",
    confirmed: isArabic ? "مؤكدة" : "Confirmed",

    selectedType: isArabic ? "النوع المحدد" : "Selected Type",
    selectedStatus: isArabic ? "الحالة المحددة" : "Selected Status",
    selectedAccount: isArabic ? "الحساب المحدد" : "Selected Account",
    selectedToAccount: isArabic ? "حساب المستلم" : "Destination Account",
    currentBalance: isArabic ? "الرصيد الحالي" : "Current Balance",
    notSet: isArabic ? "غير محدد" : "Not set",
    noAccounts: isArabic ? "لا توجد حسابات متاحة" : "No accounts available",

    accessDeniedTitle: isArabic
      ? "غير مصرح بإنشاء حركة مالية"
      : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية إنشاء حركات الخزينة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to create treasury transactions. Contact your system administrator if you need access.",

    validationTitle: isArabic ? "راجع بيانات الحركة" : "Review transaction data",
    requiredDate: isArabic ? "تاريخ الحركة مطلوب." : "Transaction date is required.",
    requiredAccount: isArabic
      ? "حساب الخزينة مطلوب."
      : "Treasury account is required.",
    requiredToAccount: isArabic
      ? "حساب المستلم مطلوب للتحويل الداخلي."
      : "Destination account is required for internal transfer.",
    sameTransferAccount: isArabic
      ? "لا يمكن أن يكون حساب المصدر وحساب المستلم نفس الحساب."
      : "Source and destination accounts cannot be the same.",
    requiredAmount: isArabic ? "المبلغ مطلوب." : "Amount is required.",
    invalidAmount: isArabic
      ? "المبلغ يجب أن يكون رقمًا أكبر من صفر."
      : "Amount must be a number greater than zero.",

    loadAccountsError: isArabic
      ? "تعذر تحميل حسابات الخزينة."
      : "Unable to load treasury accounts.",
    accountsLoaded: isArabic
      ? "تم تحديث حسابات الخزينة بنجاح."
      : "Treasury accounts refreshed successfully.",
    saveSuccess: isArabic
      ? "تم إنشاء الحركة المالية بنجاح."
      : "Treasury transaction created successfully.",
    saveError: isArabic
      ? "تعذر حفظ الحركة المالية."
      : "Unable to save treasury transaction.",

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

function formatMoney(value: unknown): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function normalizeMoneyInput(value: string) {
  const cleaned = value.replace(/[^\d.-]/g, "");
  const parts = cleaned.split(".");
  const integerPart = parts[0] || "";
  const decimalPart = parts.slice(1).join("");

  if (parts.length > 1) {
    return `${integerPart}.${decimalPart.slice(0, 2)}`;
  }

  return integerPart;
}

function isValidPositiveAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

function getNestedValue(obj: Dict, keys: string[]): unknown {
  for (const key of keys) {
    const value = obj[key];

    if (value !== undefined && value !== null && value !== "") return value;
  }

  for (const container of [
    "account",
    "treasury_account",
    "cashbox",
    "bank",
    "item",
    "data",
  ]) {
    const nested = obj[container];

    if (nested && typeof nested === "object") {
      const value = getNestedValue(nested as Dict, keys);

      if (value !== undefined && value !== null && value !== "") return value;
    }
  }

  return undefined;
}

function extractRows(payload: ApiEnvelope<unknown> | null): unknown[] {
  if (!payload) return [];

  const data = asDict(payload.data);

  if (Array.isArray(payload.accounts)) return payload.accounts;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.rows)) return payload.rows;

  if (Array.isArray(data.accounts)) return data.accounts as unknown[];
  if (Array.isArray(data.results)) return data.results as unknown[];
  if (Array.isArray(data.items)) return data.items as unknown[];
  if (Array.isArray(data.rows)) return data.rows as unknown[];

  if (Array.isArray(payload.data)) return payload.data;

  return [];
}

function normalizeAccount(item: unknown): TreasuryAccountOption {
  const obj = asDict(item);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || ""),
    name: String(getNestedValue(obj, ["name", "title", "label"]) || "-"),
    code: String(getNestedValue(obj, ["code", "account_code", "number"]) || "-"),
    account_type: String(
      getNestedValue(obj, ["account_type", "type", "kind"]) || "",
    ),
    status: String(getNestedValue(obj, ["status", "state", "is_active"]) || ""),
    current_balance: toNumber(
      getNestedValue(obj, ["current_balance", "balance", "available_balance"]),
    ),
    bank_name: String(getNestedValue(obj, ["bank_name", "bank"]) || ""),
    account_number: String(
      getNestedValue(obj, ["account_number", "bank_account_number"]) || "",
    ),
    iban: String(getNestedValue(obj, ["iban", "IBAN"]) || ""),
  };
}

function transactionTypeLabel(type: TransactionType, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<TransactionType, string> = {
    RECEIPT: t.receipt,
    PAYMENT: t.payment,
    TRANSFER: t.transfer,
    ADJUSTMENT: t.adjustment,
  };

  return labels[type];
}

function statusLabel(status: TransactionStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<TransactionStatus, string> = {
    DRAFT: t.draft,
    CONFIRMED: t.confirmed,
  };

  return labels[status];
}

function transactionTypeBadge(type: TransactionType, locale: AppLocale) {
  const label = transactionTypeLabel(type, locale);

  if (type === "RECEIPT") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (type === "PAYMENT") {
    return (
      <Badge className="rounded-full border-rose-200 bg-rose-50 px-3 py-1 text-rose-700 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
        {label}
      </Badge>
    );
  }

  if (type === "TRANSFER") {
    return (
      <Badge className="rounded-full border-sky-200 bg-sky-50 px-3 py-1 text-sky-700 hover:bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300">
        {label}
      </Badge>
    );
  }

  return (
    <Badge className="rounded-full border-violet-200 bg-violet-50 px-3 py-1 text-violet-700 hover:bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300">
      {label}
    </Badge>
  );
}

function statusBadge(status: TransactionStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

  if (status === "CONFIRMED") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  return (
    <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
      {label}
    </Badge>
  );
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

function getAccountTitle(account?: TreasuryAccountOption | null) {
  if (!account) return "-";
  return `${account.name}${account.code ? ` (${account.code})` : ""}`;
}

/* ============================================================
   Page
============================================================ */

export default function CreateTreasuryTransactionPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [form, setForm] = useState<FormState>(() => makeDefaultForm());
  const [accounts, setAccounts] = useState<TreasuryAccountOption[]>([]);
  const [isAccountsLoading, setIsAccountsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canCreate = hasSafePermission(
    auth,
    ["treasury.create", "treasury.transactions.create", "treasury.manage"],
    "action",
  );

  const canViewAccounts = hasSafePermission(
    auth,
    ["treasury.view", "treasury.accounts.view"],
    "view",
  );

  const canSubmit = canCreate && !isSaving && !isAccountsLoading;

  const isTransfer = form.transactionType === "TRANSFER";

  const selectedAccount = useMemo(
    () => accounts.find((item) => item.id === form.accountId) || null,
    [accounts, form.accountId],
  );

  const selectedToAccount = useMemo(
    () => accounts.find((item) => item.id === form.toAccountId) || null,
    [accounts, form.toAccountId],
  );

  const availableToAccounts = useMemo(
    () => accounts.filter((item) => item.id !== form.accountId),
    [accounts, form.accountId],
  );

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setIsDirty(true);
  }

  function updateMoneyField(value: string) {
    updateForm("amount", normalizeMoneyInput(value));
  }

  function handleTypeChange(value: TransactionType) {
    setForm((current) => ({
      ...current,
      transactionType: value,
      toAccountId: value === "TRANSFER" ? current.toAccountId : "",
      description:
        current.description ||
        (value === "RECEIPT"
          ? t.receipt
          : value === "PAYMENT"
            ? t.payment
            : value === "TRANSFER"
              ? t.transfer
              : t.adjustment),
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

    if (!form.transactionDate) errors.push(t.requiredDate);
    if (!form.accountId) errors.push(t.requiredAccount);
    if (!form.amount.trim()) errors.push(t.requiredAmount);
    if (form.amount.trim() && !isValidPositiveAmount(form.amount)) {
      errors.push(t.invalidAmount);
    }

    if (form.transactionType === "TRANSFER") {
      if (!form.toAccountId) errors.push(t.requiredToAccount);
      if (form.accountId && form.toAccountId && form.accountId === form.toAccountId) {
        errors.push(t.sameTransferAccount);
      }
    }

    return Array.from(new Set(errors));
  }

  function buildPayload() {
    const amount = toNumber(form.amount);

    return {
      transaction_type: form.transactionType,
      voucher_type: form.transactionType,
      type: form.transactionType,
      status: form.status,
      state: form.status,
      is_confirmed: form.status === "CONFIRMED",
      transaction_date: form.transactionDate,
      date: form.transactionDate,
      account_id: form.accountId,
      treasury_account_id: form.accountId,
      from_account_id: form.accountId,
      to_account_id: isTransfer ? form.toAccountId : undefined,
      destination_account_id: isTransfer ? form.toAccountId : undefined,
      amount,
      total_amount: amount,
      value: amount,
      currency: "SAR",
      source_reference: form.sourceReference.trim(),
      external_reference: form.sourceReference.trim(),
      reference: form.sourceReference.trim(),
      description: form.description.trim(),
      notes: form.notes.trim(),
      memo: form.notes.trim() || form.description.trim(),
    };
  }

  const loadAccounts = useCallback(
    async (showToast = false) => {
      if (!canViewAccounts) {
        setAccounts([]);
        setIsAccountsLoading(false);
        return;
      }

      try {
        setIsAccountsLoading(true);

        const response = await fetch(apiUrl("/api/treasury/accounts/?page_size=500"), {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        const payload = (await response.json().catch(() => null)) as
          | ApiEnvelope<unknown>
          | null;

        if (!response.ok || payload?.ok === false || payload?.success === false) {
          throw new Error(
            payload?.message ||
              payload?.detail ||
              payload?.error ||
              `HTTP ${response.status}`,
          );
        }

        const normalizedAccounts = extractRows(payload)
          .map(normalizeAccount)
          .filter((item) => item.id && item.name);

        setAccounts(normalizedAccounts);

        if (showToast) {
          toast.success(t.accountsLoaded);
        }
      } catch (error) {
        console.error("Treasury accounts load error:", error);
        setAccounts([]);
        toast.error(t.loadAccountsError);
      } finally {
        setIsAccountsLoading(false);
      }
    },
    [canViewAccounts, t.accountsLoaded, t.loadAccountsError],
  );

  const submitForm = useCallback(async () => {
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

      const csrfToken = getCookie("csrftoken");
      const payload = buildPayload();

      const endpoints = [
        "/api/treasury/transactions/create/",
        "/api/treasury/transactions/",
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

        if ([404, 405].includes(response.status)) {
          lastMessage =
            responsePayload?.message ||
            responsePayload?.detail ||
            responsePayload?.error ||
            `HTTP ${response.status}`;
          continue;
        }

        if (response.status === 400) {
          lastMessage =
            responsePayload?.message ||
            responsePayload?.detail ||
            responsePayload?.error ||
            t.saveError;
          break;
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
      setSubmitError("");
      await loadAccounts(false);
    } catch (error) {
      console.error("Create treasury transaction submit error:", error);
      const message = error instanceof Error ? error.message : t.saveError;

      setSubmitError(message || t.saveError);
      toast.error(t.saveError);
    } finally {
      setIsSaving(false);
    }
  }, [canCreate, form, isTransfer, loadAccounts, t]);

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
    loadAccounts(false);
  }, [authResolving, loadAccounts]);

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
            href="/system/treasury/transactions"
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
            href="/system/treasury"
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
              <Wallet className="h-4 w-4" />
              <span>{t.treasury}</span>
            </Button>
          </Link>

          <Link
            href="/system/treasury/accounts"
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
              <CreditCard className="h-4 w-4" />
              <span>{t.accounts}</span>
            </Button>
          </Link>

          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadAccounts(true)}
            disabled={isAccountsLoading || isSaving}
          >
            {isAccountsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refreshAccounts}</span>
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

            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.transactionType}</label>
                <select
                  value={form.transactionType}
                  onChange={(event) =>
                    handleTypeChange(event.target.value as TransactionType)
                  }
                  disabled={isSaving}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="RECEIPT">{t.receipt}</option>
                  <option value="PAYMENT">{t.payment}</option>
                  <option value="TRANSFER">{t.transfer}</option>
                  <option value="ADJUSTMENT">{t.adjustment}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.status}</label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    updateForm("status", event.target.value as TransactionStatus)
                  }
                  disabled={isSaving}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="CONFIRMED">{t.confirmed}</option>
                  <option value="DRAFT">{t.draft}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.date}</label>
                <div className="relative">
                  <Input
                    type="date"
                    value={form.transactionDate}
                    onChange={(event) =>
                      updateForm("transactionDate", event.target.value)
                    }
                    disabled={isSaving}
                    className="h-11 rounded-xl"
                    dir="ltr"
                  />
                  <CalendarDays className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground end-3" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Wallet className="h-4 w-4" />
                {t.accountInfo}
              </CardTitle>
              <CardDescription>{t.accountInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {isTransfer ? t.fromAccount : t.account}
                </label>
                <select
                  value={form.accountId}
                  onChange={(event) => updateForm("accountId", event.target.value)}
                  disabled={isSaving || isAccountsLoading}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    {isAccountsLoading ? t.refreshAccounts : t.notSet}
                  </option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {getAccountTitle(account)}
                    </option>
                  ))}
                </select>
              </div>

              {isTransfer ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.toAccount}</label>
                  <select
                    value={form.toAccountId}
                    onChange={(event) =>
                      updateForm("toAccountId", event.target.value)
                    }
                    disabled={isSaving || isAccountsLoading || !form.accountId}
                    className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">{t.notSet}</option>
                    {availableToAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {getAccountTitle(account)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">
                  {isTransfer ? t.fromAccount : t.selectedAccount}
                </p>
                <p className="mt-2 font-semibold">
                  {selectedAccount ? getAccountTitle(selectedAccount) : t.notSet}
                </p>
                <div className="mt-2 text-sm text-muted-foreground">
                  <MoneyText value={selectedAccount?.current_balance || 0} />
                </div>
              </div>

              {isTransfer ? (
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.selectedToAccount}
                  </p>
                  <p className="mt-2 font-semibold">
                    {selectedToAccount
                      ? getAccountTitle(selectedToAccount)
                      : t.notSet}
                  </p>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <MoneyText value={selectedToAccount?.current_balance || 0} />
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Banknote className="h-4 w-4" />
                {t.amountInfo}
              </CardTitle>
              <CardDescription>{t.amountInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.amount}</label>
                <div className="relative">
                  <Input
                    value={form.amount}
                    onChange={(event) => updateMoneyField(event.target.value)}
                    disabled={isSaving}
                    inputMode="decimal"
                    dir="ltr"
                    className="h-11 rounded-xl pe-10"
                  />
                  <div className="absolute top-1/2 -translate-y-1/2 end-3">
                    <SarIcon className="h-4 w-4" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.sourceReference}</label>
                <Input
                  value={form.sourceReference}
                  onChange={(event) =>
                    updateForm("sourceReference", event.target.value)
                  }
                  disabled={isSaving}
                  dir="ltr"
                  className="h-11 rounded-xl"
                />
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
                  {t.selectedType}
                </p>
                <div className="mt-2">
                  {transactionTypeBadge(form.transactionType, locale)}
                </div>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">
                  {t.selectedStatus}
                </p>
                <div className="mt-2">{statusBadge(form.status, locale)}</div>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">
                  {isTransfer ? t.fromAccount : t.selectedAccount}
                </p>
                <p className="mt-2 font-semibold">
                  {selectedAccount ? getAccountTitle(selectedAccount) : t.notSet}
                </p>
              </div>

              {isTransfer ? (
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.selectedToAccount}
                  </p>
                  <p className="mt-2 font-semibold">
                    {selectedToAccount
                      ? getAccountTitle(selectedToAccount)
                      : t.notSet}
                  </p>
                </div>
              ) : null}

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">{t.amount}</p>
                <div className="mt-2 font-semibold">
                  <MoneyText value={form.amount || 0} />
                </div>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">{t.date}</p>
                <p className="mt-2 font-semibold">
                  {form.transactionDate || t.notSet}
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
                  <RefreshCcw className="h-4 w-4" />
                  {t.clear}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4" />
                {t.accountInfo}
              </div>

              <p className="text-sm leading-6 text-muted-foreground">
                {accounts.length > 0 ? t.accounts : t.noAccounts}
              </p>

              <div className="flex items-center gap-2">
                {form.transactionType === "RECEIPT" ? (
                  <Receipt className="h-5 w-5 text-emerald-600" />
                ) : form.transactionType === "PAYMENT" ? (
                  <Banknote className="h-5 w-5 text-rose-600" />
                ) : form.transactionType === "TRANSFER" ? (
                  <ArrowLeftRight className="h-5 w-5 text-sky-600" />
                ) : (
                  <CreditCard className="h-5 w-5 text-violet-600" />
                )}

                <span className="text-sm font-semibold">
                  {transactionTypeLabel(form.transactionType, locale)}
                </span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}