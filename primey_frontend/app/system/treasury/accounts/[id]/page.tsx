"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Building2,
  CheckCircle2,
  FileText,
  Landmark,
  Loader2,
  RefreshCcw,
  Save,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Can } from "@/components/guards/Can";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
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
import { Label } from "@/components/ui/label";
import { PERMISSIONS } from "@/lib/permissions";

type AppLocale = "ar" | "en";

type TreasuryAccountType = "CASHBOX" | "BANK";
type TreasuryAccountStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "CLOSED";

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
};

type LedgerAccount = {
  id?: number | string;
  code?: string;
  name?: string;
  name_ar?: string;
  name_en?: string;
  is_group?: boolean;
};

type TreasuryAccount = {
  id: number | string;
  name: string;
  code: string;
  account_type: TreasuryAccountType | string;
  account_type_label?: string;
  status: TreasuryAccountStatus | string;
  status_label?: string;
  ledger_account?: LedgerAccount | null;
  ledger_account_id?: number | string | null;
  opening_balance: string;
  current_balance: string;
  currency: string;
  bank_name?: string;
  account_holder_name?: string;
  account_number?: string;
  iban?: string;
  branch_name?: string;
  description?: string;
  is_default?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type FormData = {
  name: string;
  code: string;
  account_type: TreasuryAccountType;
  status: TreasuryAccountStatus;
  opening_balance: string;
  current_balance: string;
  currency: string;
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  iban: string;
  branch_name: string;
  description: string;
  is_default: boolean;
};

const SAR_ICON = "/currency/sar.svg";

function readLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const saved = window.localStorage.getItem("primey-locale");
    if (saved === "ar" || saved === "en") return saved;

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

function getCookie(name: string) {
  if (typeof document === "undefined") return "";

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || "";
  }

  return "";
}

function normalizeAccount(item: unknown): TreasuryAccount {
  const row = (item || {}) as Record<string, unknown>;

  return {
    id: (row.id as number | string | undefined) || "",
    name: String(row.name || ""),
    code: String(row.code || ""),
    account_type: String(row.account_type || "CASHBOX"),
    account_type_label: row.account_type_label
      ? String(row.account_type_label)
      : undefined,
    status: String(row.status || "ACTIVE"),
    status_label: row.status_label ? String(row.status_label) : undefined,
    ledger_account:
      row.ledger_account && typeof row.ledger_account === "object"
        ? (row.ledger_account as LedgerAccount)
        : null,
    ledger_account_id: row.ledger_account_id as number | string | null | undefined,
    opening_balance: String(row.opening_balance || "0.00"),
    current_balance: String(row.current_balance || "0.00"),
    currency: String(row.currency || "SAR"),
    bank_name: row.bank_name ? String(row.bank_name) : "",
    account_holder_name: row.account_holder_name
      ? String(row.account_holder_name)
      : "",
    account_number: row.account_number ? String(row.account_number) : "",
    iban: row.iban ? String(row.iban) : "",
    branch_name: row.branch_name ? String(row.branch_name) : "",
    description: row.description ? String(row.description) : "",
    is_default: Boolean(row.is_default),
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  };
}

function normalizeForm(account: TreasuryAccount): FormData {
  return {
    name: account.name || "",
    code: account.code || "",
    account_type: account.account_type === "BANK" ? "BANK" : "CASHBOX",
    status:
      account.status === "INACTIVE" ||
      account.status === "SUSPENDED" ||
      account.status === "CLOSED"
        ? account.status
        : "ACTIVE",
    opening_balance: account.opening_balance || "0.00",
    current_balance: account.current_balance || "0.00",
    currency: account.currency || "SAR",
    bank_name: account.bank_name || "",
    account_holder_name: account.account_holder_name || "",
    account_number: account.account_number || "",
    iban: account.iban || "",
    branch_name: account.branch_name || "",
    description: account.description || "",
    is_default: Boolean(account.is_default),
  };
}

function toNumber(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function dateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeMoney(value: string) {
  const parsed = Number(value || 0);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return "0.00";
  }

  return parsed.toFixed(2);
}

function normalizeCurrency(value: string) {
  return String(value || "SAR").trim().toUpperCase().slice(0, 3);
}

function cleanIban(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function maskIban(value?: string) {
  if (!value) return "-";

  const cleaned = value.replace(/\s+/g, "");
  if (cleaned.length <= 8) return cleaned;

  return `${cleaned.slice(0, 4)} **** **** ${cleaned.slice(-4)}`;
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "تفاصيل حساب الخزينة" : "Treasury Account Details",
    cashboxTitle: ar ? "تفاصيل الصندوق النقدي" : "Cashbox Details",
    bankTitle: ar ? "تفاصيل الحساب البنكي" : "Bank Account Details",
    subtitle: ar
      ? "عرض وتحديث بيانات حساب الخزينة ومتابعة الرصيد والربط المحاسبي."
      : "View and update treasury account data, balance, and ledger linkage.",
    badge: ar ? "حساب خزينة" : "Treasury Account",
    back: ar ? "حسابات الخزينة" : "Treasury Accounts",
    backCashboxes: ar ? "الصناديق" : "Cashboxes",
    backBanks: ar ? "الحسابات البنكية" : "Bank Accounts",
    statement: ar ? "كشف الحساب" : "Statement",
    refresh: ar ? "تحديث" : "Refresh",
    save: ar ? "حفظ التعديلات" : "Save Changes",
    saving: ar ? "جاري الحفظ..." : "Saving...",
    deactivate: ar ? "تعطيل الحساب" : "Deactivate",
    close: ar ? "إغلاق الحساب" : "Close Account",
    loading: ar ? "جاري تحميل الحساب..." : "Loading account...",
    saved: ar ? "تم تحديث حساب الخزينة بنجاح." : "Treasury account updated successfully.",
    deactivated: ar ? "تم تعطيل الحساب بنجاح." : "Account deactivated successfully.",
    closed: ar ? "تم إغلاق الحساب بنجاح." : "Account closed successfully.",
    apiError: ar ? "تعذر تحميل بيانات الحساب." : "Unable to load account data.",
    actionError: ar ? "تعذر تنفيذ العملية." : "Unable to complete action.",
    required: ar ? "يرجى تعبئة الحقول المطلوبة." : "Please fill required fields.",
    invalidMoney: ar
      ? "الأرصدة يجب أن تكون أرقامًا صحيحة أو عشرية ولا تقل عن صفر."
      : "Balances must be valid numbers and cannot be negative.",
    invalidCurrency: ar ? "رمز العملة يجب أن يتكون من 3 أحرف." : "Currency code must be 3 letters.",
    bankRequired: ar ? "اسم البنك مطلوب للحساب البنكي." : "Bank name is required for bank accounts.",
    protectedBalance: ar
      ? "لا يمكن تعديل الأرصدة أو العملة إذا كان للحساب حركات مؤكدة، وسيظهر الخطأ من الباك إند عند محاولة ذلك."
      : "Balances or currency cannot be changed if confirmed transactions exist; backend will reject unsafe changes.",
    accountData: ar ? "بيانات الحساب" : "Account Data",
    bankData: ar ? "البيانات البنكية" : "Bank Details",
    balanceData: ar ? "الأرصدة" : "Balances",
    audit: ar ? "التتبع" : "Audit",
    ledger: ar ? "الربط المحاسبي" : "Ledger Link",
    preview: ar ? "ملخص الحساب" : "Account Summary",
    defaultHint: ar
      ? "عند جعل هذا الحساب افتراضيًا سيتم إلغاء الافتراضي من الحسابات الأخرى."
      : "When this account is default, other default accounts will be unset.",
    cashboxHint: ar
      ? "الصندوق النقدي لا يحتفظ ببيانات بنكية."
      : "Cashbox does not store bank details.",
    bankHint: ar
      ? "بيانات البنك تستخدم للتحويلات البنكية والتسويات."
      : "Bank details are used for transfers and settlements.",
    noData: ar ? "لا توجد بيانات لهذا الحساب." : "No data for this account.",
    fields: {
      name: ar ? "اسم الحساب" : "Account Name",
      code: ar ? "كود الحساب" : "Account Code",
      type: ar ? "نوع الحساب" : "Account Type",
      status: ar ? "الحالة" : "Status",
      opening: ar ? "الرصيد الافتتاحي" : "Opening Balance",
      current: ar ? "الرصيد الحالي" : "Current Balance",
      currency: ar ? "العملة" : "Currency",
      bank: ar ? "اسم البنك" : "Bank Name",
      holder: ar ? "صاحب الحساب" : "Account Holder",
      number: ar ? "رقم الحساب" : "Account Number",
      iban: ar ? "IBAN" : "IBAN",
      branch: ar ? "الفرع" : "Branch",
      description: ar ? "الوصف" : "Description",
      default: ar ? "حساب افتراضي" : "Default Account",
      ledgerCode: ar ? "كود الحساب المحاسبي" : "Ledger Code",
      ledgerName: ar ? "اسم الحساب المحاسبي" : "Ledger Name",
      created: ar ? "تاريخ الإنشاء" : "Created At",
      updated: ar ? "آخر تحديث" : "Updated At",
    },
    placeholders: {
      name: ar ? "اسم الحساب" : "Account name",
      bankName: ar ? "اسم البنك" : "Bank name",
      holder: ar ? "اسم صاحب الحساب" : "Account holder name",
      accountNumber: ar ? "رقم الحساب البنكي" : "Bank account number",
      iban: ar ? "SA..." : "SA...",
      branch: ar ? "اسم الفرع" : "Branch name",
      description: ar ? "وصف مختصر للحساب" : "Short account description",
    },
    types: {
      CASHBOX: ar ? "صندوق نقدي" : "Cashbox",
      BANK: ar ? "حساب بنكي" : "Bank Account",
    },
    statuses: {
      ACTIVE: ar ? "نشط" : "Active",
      INACTIVE: ar ? "غير نشط" : "Inactive",
      SUSPENDED: ar ? "موقوف" : "Suspended",
      CLOSED: ar ? "مغلق" : "Closed",
    },
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const method = init?.method || "GET";
  const headers = new Headers(init?.headers || {});

  headers.set("Accept", "application/json");

  if (method !== "GET") {
    headers.set("Content-Type", "application/json");
    headers.set("X-CSRFToken", getCookie("csrftoken"));
  }

  const response = await fetch(url, {
    ...init,
    method,
    credentials: "include",
    headers,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || payload?.success === false) {
    const message =
      payload?.message ||
      (payload?.errors ? JSON.stringify(payload.errors) : "") ||
      `HTTP ${response.status}`;

    throw new Error(message);
  }

  return payload as T;
}

function statusBadgeClass(status: string) {
  if (status === "ACTIVE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
  }

  if (status === "INACTIVE") {
    return "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300";
  }

  if (status === "SUSPENDED") {
    return "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300";
  }

  return "border-red-200 bg-red-50 text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-red-950 dark:text-red-300";
}

function ToggleButton({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full transition ${
        checked ? "bg-primary" : "bg-muted"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-background shadow transition ${
          checked ? "ltr:left-6 rtl:right-6" : "ltr:left-1 rtl:right-1"
        }`}
      />
    </button>
  );
}

function Field({
  label,
  value,
  dir = "auto",
}: {
  label: string;
  value?: string | number | null;
  dir?: "auto" | "ltr" | "rtl";
}) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium" dir={dir}>
        {value || "-"}
      </p>
    </div>
  );
}

export default function TreasuryAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = use(params);

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [account, setAccount] = useState<TreasuryAccount | null>(null);
  const [form, setForm] = useState<FormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const isBank = form?.account_type === "BANK";
  const pageTitle = isBank ? t.bankTitle : t.cashboxTitle;
  const backHref = isBank ? "/system/treasury/banks" : "/system/treasury/cashboxes";
  const backLabel = isBank ? t.backBanks : t.backCashboxes;

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((current) => {
      if (!current) return current;

      return {
        ...current,
        [key]: value,
      };
    });
  }

  function validateForm() {
    if (!form) return false;

    if (!form.name.trim() || !form.code.trim() || !form.account_type || !form.status) {
      toast.error(t.required);
      return false;
    }

    if (form.account_type === "BANK" && !form.bank_name.trim()) {
      toast.error(t.bankRequired);
      return false;
    }

    const openingBalance = Number(form.opening_balance || 0);
    const currentBalance = Number(form.current_balance || 0);

    if (
      !Number.isFinite(openingBalance) ||
      !Number.isFinite(currentBalance) ||
      openingBalance < 0 ||
      currentBalance < 0
    ) {
      toast.error(t.invalidMoney);
      return false;
    }

    if (normalizeCurrency(form.currency).length !== 3) {
      toast.error(t.invalidCurrency);
      return false;
    }

    return true;
  }

  function buildPayload(statusOverride?: TreasuryAccountStatus) {
    if (!form) return {};

    const accountType = form.account_type;

    return {
      name: form.name.trim(),
      code: form.code.trim(),
      account_type: accountType,
      status: statusOverride || form.status,
      opening_balance: normalizeMoney(form.opening_balance),
      current_balance: normalizeMoney(form.current_balance),
      currency: normalizeCurrency(form.currency),
      bank_name: accountType === "BANK" ? form.bank_name.trim() : "",
      account_holder_name:
        accountType === "BANK" ? form.account_holder_name.trim() : "",
      account_number: accountType === "BANK" ? form.account_number.trim() : "",
      iban: accountType === "BANK" ? cleanIban(form.iban) : "",
      branch_name: accountType === "BANK" ? form.branch_name.trim() : "",
      description: form.description.trim(),
      is_default: form.is_default,
    };
  }

  async function loadAccount(showToast = false) {
    try {
      setIsLoading(true);

      const payload = await fetchJson<ApiEnvelope<unknown>>(
        `/api/treasury/accounts/${resolved.id}/`,
      );

      const normalized = normalizeAccount(payload.data || payload);

      setAccount(normalized);
      setForm(normalizeForm(normalized));

      if (showToast) toast.success(t.refresh);
    } catch (error) {
      console.error("Treasury account detail load error:", error);
      toast.error(t.apiError);
      setAccount(null);
      setForm(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveAccount() {
    if (!validateForm()) return;

    try {
      setIsSaving(true);

      const payload = buildPayload();

      const response = await fetchJson<ApiEnvelope<unknown>>(
        `/api/treasury/accounts/${resolved.id}/`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );

      const normalized = normalizeAccount(response.data || payload);

      setAccount(normalized);
      setForm(normalizeForm(normalized));

      toast.success(response.message || t.saved);
    } catch (error) {
      console.error("Treasury account save error:", error);
      toast.error(error instanceof Error ? error.message : t.actionError);
    } finally {
      setIsSaving(false);
    }
  }

  async function changeStatus(status: TreasuryAccountStatus, successMessage: string) {
    try {
      setIsActionLoading(true);

      const payload = buildPayload(status);

      const response = await fetchJson<ApiEnvelope<unknown>>(
        `/api/treasury/accounts/${resolved.id}/`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );

      const normalized = normalizeAccount(response.data || payload);

      setAccount(normalized);
      setForm(normalizeForm(normalized));

      toast.success(response.message || successMessage);
    } catch (error) {
      console.error("Treasury account status change error:", error);
      toast.error(error instanceof Error ? error.message : t.actionError);
    } finally {
      setIsActionLoading(false);
    }
  }

  useEffect(() => {
    const next = readLocale();
    applyDocumentLocale(next);
    setLocale(next);

    const handleLocaleChange = () => {
      const updated = readLocale();
      applyDocumentLocale(updated);
      setLocale(updated);
    };

    window.addEventListener("storage", handleLocaleChange);
    window.addEventListener("primey-locale-changed", handleLocaleChange);

    return () => {
      window.removeEventListener("storage", handleLocaleChange);
      window.removeEventListener("primey-locale-changed", handleLocaleChange);
    };
  }, []);

  useEffect(() => {
    loadAccount(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved.id, locale]);

  const kpiCards = [
    {
      label: t.fields.current,
      value: money(form?.current_balance || "0.00"),
      icon: Banknote,
      currency: true,
    },
    {
      label: t.fields.opening,
      value: money(form?.opening_balance || "0.00"),
      icon: Wallet,
      currency: true,
    },
    {
      label: t.fields.type,
      value: form ? t.types[form.account_type] : "-",
      icon: form?.account_type === "BANK" ? Building2 : Wallet,
      currency: false,
    },
    {
      label: t.fields.status,
      value: form ? t.statuses[form.status] : "-",
      icon: ShieldCheck,
      currency: false,
    },
  ];

  return (
    <PermissionGuard
      permission={PERMISSIONS.TREASURY_VIEW}
      workspace="system"
      mode="fallback"
    >
      <div className="space-y-5" dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                /system/treasury/accounts/{resolved.id}
              </Badge>

              {account ? (
                <>
                  <Badge className="rounded-full">
                    {account.account_type_label ||
                      t.types[
                        account.account_type as keyof typeof t.types
                      ] ||
                      account.account_type}
                  </Badge>

                  <Badge
                    variant="outline"
                    className={`rounded-full ${statusBadgeClass(account.status)}`}
                  >
                    {account.status_label ||
                      t.statuses[
                        account.status as keyof typeof t.statuses
                      ] ||
                      account.status}
                  </Badge>

                  {account.is_default ? (
                    <Badge variant="outline" className="rounded-full">
                      {t.fields.default}
                    </Badge>
                  ) : null}
                </>
              ) : null}
            </div>

            <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
              {pageTitle}
            </h1>

            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {t.subtitle}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/system/treasury/accounts">
                <Wallet className="h-4 w-4" />
                {t.back}
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href={`/system/treasury/accounts/${resolved.id}/statement`}>
                <FileText className="h-4 w-4" />
                {t.statement}
              </Link>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              disabled={isLoading}
              onClick={() => loadAccount(true)}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              {t.refresh}
            </Button>

            <Can permission={PERMISSIONS.TREASURY_EDIT}>
              <Button
                type="button"
                className="h-10 rounded-xl"
                disabled={isSaving || isLoading || !form}
                onClick={saveAccount}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSaving ? t.saving : t.save}
              </Button>
            </Can>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.label} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {item.currency ? (
                          <Image
                            src={SAR_ICON}
                            alt="SAR"
                            width={18}
                            height={18}
                          />
                        ) : null}
                        <p className="text-lg font-bold" dir="ltr">
                          {isLoading ? "..." : item.value}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.label}
                      </p>
                    </div>

                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="flex h-72 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.loading}
            </CardContent>
          </Card>
        ) : form && account ? (
          <>
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">{t.accountData}</CardTitle>
                  <CardDescription>{t.protectedBalance}</CardDescription>
                </CardHeader>

                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t.fields.name}</Label>
                    <Input
                      value={form.name}
                      onChange={(event) => update("name", event.target.value)}
                      placeholder={t.placeholders.name}
                      className="h-10 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t.fields.code}</Label>
                    <Input
                      value={form.code}
                      onChange={(event) => update("code", event.target.value)}
                      className="h-10 rounded-xl"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t.fields.type}</Label>
                    <select
                      value={form.account_type}
                      onChange={(event) => {
                        const nextType = event.target.value as TreasuryAccountType;

                        setForm((current) => {
                          if (!current) return current;

                          return {
                            ...current,
                            account_type: nextType,
                            bank_name:
                              nextType === "BANK" ? current.bank_name : "",
                            account_holder_name:
                              nextType === "BANK"
                                ? current.account_holder_name
                                : "",
                            account_number:
                              nextType === "BANK"
                                ? current.account_number
                                : "",
                            iban: nextType === "BANK" ? current.iban : "",
                            branch_name:
                              nextType === "BANK" ? current.branch_name : "",
                          };
                        });
                      }}
                      className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                    >
                      <option value="CASHBOX">{t.types.CASHBOX}</option>
                      <option value="BANK">{t.types.BANK}</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t.fields.status}</Label>
                    <select
                      value={form.status}
                      onChange={(event) =>
                        update("status", event.target.value as TreasuryAccountStatus)
                      }
                      className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                    >
                      <option value="ACTIVE">{t.statuses.ACTIVE}</option>
                      <option value="INACTIVE">{t.statuses.INACTIVE}</option>
                      <option value="SUSPENDED">{t.statuses.SUSPENDED}</option>
                      <option value="CLOSED">{t.statuses.CLOSED}</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t.fields.opening}</Label>
                    <div className="relative">
                      <Image
                        src={SAR_ICON}
                        alt="SAR"
                        width={18}
                        height={18}
                        className="absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.opening_balance}
                        onChange={(event) =>
                          update("opening_balance", event.target.value)
                        }
                        className="h-10 rounded-xl ltr:pl-10 rtl:pr-10"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t.fields.current}</Label>
                    <div className="relative">
                      <Image
                        src={SAR_ICON}
                        alt="SAR"
                        width={18}
                        height={18}
                        className="absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.current_balance}
                        onChange={(event) =>
                          update("current_balance", event.target.value)
                        }
                        className="h-10 rounded-xl ltr:pl-10 rtl:pr-10"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t.fields.currency}</Label>
                    <Input
                      value={form.currency}
                      onChange={(event) =>
                        update("currency", event.target.value.toUpperCase())
                      }
                      className="h-10 rounded-xl"
                      dir="ltr"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-2xl border p-4">
                    <div>
                      <Label>{t.fields.default}</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.defaultHint}
                      </p>
                    </div>
                    <ToggleButton
                      checked={form.is_default}
                      onChange={(value) => update("is_default", value)}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>{t.fields.description}</Label>
                    <Input
                      value={form.description}
                      onChange={(event) =>
                        update("description", event.target.value)
                      }
                      placeholder={t.placeholders.description}
                      className="h-10 rounded-xl"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t.preview}</CardTitle>
                  <CardDescription>
                    {isBank ? t.bankHint : t.cashboxHint}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t.fields.name}
                        </p>
                        <p className="mt-1 font-semibold">{form.name || "-"}</p>
                        <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                          {form.code || "-"}
                        </p>
                      </div>

                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
                        {isBank ? (
                          <Landmark className="h-5 w-5" />
                        ) : (
                          <Wallet className="h-5 w-5" />
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 font-bold" dir="ltr">
                      <Image src={SAR_ICON} alt="SAR" width={18} height={18} />
                      {money(form.current_balance)}
                    </div>
                  </div>

                  <Field
                    label={t.fields.status}
                    value={t.statuses[form.status]}
                  />

                  <Field
                    label={t.fields.type}
                    value={t.types[form.account_type]}
                  />

                  <Field
                    label={t.fields.created}
                    value={dateTime(account.created_at)}
                    dir="ltr"
                  />

                  <Field
                    label={t.fields.updated}
                    value={dateTime(account.updated_at)}
                    dir="ltr"
                  />

                  <Can permission={PERMISSIONS.TREASURY_EDIT}>
                    <div className="grid gap-2">
                      {form.status === "ACTIVE" ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 rounded-xl"
                          disabled={isActionLoading}
                          onClick={() =>
                            changeStatus("INACTIVE", t.deactivated)
                          }
                        >
                          {isActionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          {t.deactivate}
                        </Button>
                      ) : null}

                      {form.status !== "CLOSED" ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 rounded-xl"
                          disabled={isActionLoading}
                          onClick={() => changeStatus("CLOSED", t.closed)}
                        >
                          {isActionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-4 w-4" />
                          )}
                          {t.close}
                        </Button>
                      ) : null}
                    </div>
                  </Can>
                </CardContent>
              </Card>
            </div>

            {isBank ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t.bankData}</CardTitle>
                  <CardDescription>{t.bankHint}</CardDescription>
                </CardHeader>

                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t.fields.bank}</Label>
                    <Input
                      value={form.bank_name}
                      onChange={(event) =>
                        update("bank_name", event.target.value)
                      }
                      placeholder={t.placeholders.bankName}
                      className="h-10 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t.fields.holder}</Label>
                    <Input
                      value={form.account_holder_name}
                      onChange={(event) =>
                        update("account_holder_name", event.target.value)
                      }
                      placeholder={t.placeholders.holder}
                      className="h-10 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t.fields.number}</Label>
                    <Input
                      value={form.account_number}
                      onChange={(event) =>
                        update("account_number", event.target.value)
                      }
                      placeholder={t.placeholders.accountNumber}
                      className="h-10 rounded-xl"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t.fields.iban}</Label>
                    <Input
                      value={form.iban}
                      onChange={(event) =>
                        update("iban", event.target.value.toUpperCase())
                      }
                      placeholder={t.placeholders.iban}
                      className="h-10 rounded-xl"
                      dir="ltr"
                    />
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {maskIban(form.iban)}
                    </p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>{t.fields.branch}</Label>
                    <Input
                      value={form.branch_name}
                      onChange={(event) =>
                        update("branch_name", event.target.value)
                      }
                      placeholder={t.placeholders.branch}
                      className="h-10 rounded-xl"
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.ledger}</CardTitle>
                <CardDescription>{t.subtitle}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field
                  label={t.fields.ledgerCode}
                  value={account.ledger_account?.code}
                  dir="ltr"
                />
                <Field
                  label={t.fields.ledgerName}
                  value={
                    isArabic
                      ? account.ledger_account?.name_ar ||
                        account.ledger_account?.name
                      : account.ledger_account?.name_en ||
                        account.ledger_account?.name
                  }
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Can permission={PERMISSIONS.TREASURY_EDIT}>
                <Button
                  type="button"
                  className="h-10 rounded-xl"
                  disabled={isSaving}
                  onClick={saveAccount}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSaving ? t.saving : t.save}
                </Button>
              </Can>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="flex h-72 items-center justify-center text-sm text-muted-foreground">
              {t.noData}
            </CardContent>
          </Card>
        )}
      </div>
    </PermissionGuard>
  );
}