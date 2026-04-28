"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  Edit3,
  FileText,
  Loader2,
  RefreshCcw,
  Save,
  ShieldAlert,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

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

type AppLocale = "ar" | "en";

type TreasuryAccountType = "CASHBOX" | "BANK";
type TreasuryAccountStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "CLOSED";

type TreasuryAccount = {
  id: number | string;
  name: string;
  code: string;
  account_type: TreasuryAccountType;
  account_type_label?: string;
  status: TreasuryAccountStatus;
  status_label?: string;
  ledger_account_id?: number | string | null;
  ledger_account?: {
    id?: number | string;
    code?: string;
    name?: string;
    name_ar?: string;
    name_en?: string;
    is_group?: boolean;
  } | null;
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
  created_at?: string | null;
  updated_at?: string | null;
};

type TreasuryTransaction = {
  id: number | string;
  transaction_number: string;
  transaction_type: string;
  transaction_type_label?: string;
  status: string;
  status_label?: string;
  transaction_date: string;
  amount: string;
  currency: string;
  reference?: string;
  description?: string;
};

type AccountForm = {
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

function readLocale(): AppLocale {
  if (typeof window === "undefined") return "ar";

  const saved = window.localStorage.getItem("primey-locale");
  if (saved === "ar" || saved === "en") return saved;

  return document.documentElement.lang === "en" ? "en" : "ar";
}

function toArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function money(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
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

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "تفاصيل حساب الخزينة" : "Treasury Account Details",
    subtitle: ar
      ? "عرض وتحديث بيانات الصندوق أو الحساب البنكي ومتابعة آخر الحركات."
      : "View and update cashbox or bank account details and track latest transactions.",
    back: ar ? "حسابات الخزينة" : "Treasury Accounts",
    statement: ar ? "كشف الحساب" : "Statement",
    createTransaction: ar ? "إضافة حركة" : "Create Transaction",
    edit: ar ? "تعديل" : "Edit",
    cancelEdit: ar ? "إلغاء التعديل" : "Cancel Edit",
    save: ar ? "حفظ التعديلات" : "Save Changes",
    refresh: ar ? "تحديث" : "Refresh",
    deactivate: ar ? "تعطيل / حذف" : "Deactivate / Delete",
    loading: ar ? "جاري تحميل بيانات الحساب..." : "Loading account details...",
    transactionsLoading: ar ? "جاري تحميل آخر الحركات..." : "Loading latest transactions...",
    noData: ar ? "لا توجد بيانات." : "No data.",
    noTransactions: ar ? "لا توجد حركات مرتبطة بهذا الحساب." : "No transactions linked to this account.",
    apiError: ar ? "تعذر تحميل بيانات حساب الخزينة." : "Unable to load treasury account.",
    transactionsError: ar ? "تعذر تحميل حركات الحساب." : "Unable to load account transactions.",
    updated: ar ? "تم تحديث حساب الخزينة بنجاح" : "Treasury account updated successfully",
    deleted: ar ? "تم تنفيذ العملية على حساب الخزينة" : "Treasury account action completed",
    updateError: ar ? "تعذر تحديث حساب الخزينة." : "Unable to update treasury account.",
    deleteError: ar ? "تعذر تعطيل أو حذف حساب الخزينة." : "Unable to deactivate or delete account.",
    required: ar ? "يرجى تعبئة الحقول المطلوبة." : "Please fill required fields.",
    bankRequired: ar ? "اسم البنك مطلوب عند اختيار حساب بنكي." : "Bank name is required for bank accounts.",
    defaultAccount: ar ? "حساب افتراضي" : "Default Account",
    financialSummary: ar ? "الملخص المالي" : "Financial Summary",
    accountData: ar ? "بيانات الحساب" : "Account Data",
    bankData: ar ? "البيانات البنكية" : "Bank Data",
    latestTransactions: ar ? "آخر الحركات" : "Latest Transactions",
    systemData: ar ? "بيانات النظام" : "System Data",
    fields: {
      name: ar ? "اسم الحساب" : "Account Name",
      code: ar ? "كود الحساب" : "Account Code",
      accountType: ar ? "نوع الحساب" : "Account Type",
      status: ar ? "الحالة" : "Status",
      ledgerAccount: ar ? "الحساب المحاسبي" : "Ledger Account",
      openingBalance: ar ? "الرصيد الافتتاحي" : "Opening Balance",
      currentBalance: ar ? "الرصيد الحالي" : "Current Balance",
      currency: ar ? "العملة" : "Currency",
      bankName: ar ? "اسم البنك" : "Bank Name",
      holderName: ar ? "اسم صاحب الحساب" : "Account Holder",
      accountNumber: ar ? "رقم الحساب" : "Account Number",
      iban: ar ? "IBAN" : "IBAN",
      branch: ar ? "الفرع" : "Branch",
      description: ar ? "الوصف" : "Description",
      createdAt: ar ? "تاريخ الإنشاء" : "Created At",
      updatedAt: ar ? "آخر تحديث" : "Updated At",
      transactionNumber: ar ? "رقم الحركة" : "Transaction Number",
      transactionType: ar ? "نوع الحركة" : "Transaction Type",
      transactionDate: ar ? "التاريخ" : "Date",
      amount: ar ? "المبلغ" : "Amount",
      reference: ar ? "المرجع" : "Reference",
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

function buildForm(account: TreasuryAccount): AccountForm {
  return {
    name: account.name || "",
    code: account.code || "",
    account_type: account.account_type || "CASHBOX",
    status: account.status || "ACTIVE",
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

function FieldCard({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | number | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children ? (
        <div className="mt-1">{children}</div>
      ) : (
        <p className="mt-1 font-medium">{value || "-"}</p>
      )}
    </div>
  );
}

function statusBadge(status: TreasuryAccountStatus, t: ReturnType<typeof dictionary>) {
  if (status === "ACTIVE") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50">
        {t.statuses.ACTIVE}
      </Badge>
    );
  }

  if (status === "SUSPENDED") {
    return (
      <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50">
        {t.statuses.SUSPENDED}
      </Badge>
    );
  }

  if (status === "CLOSED") {
    return (
      <Badge variant="outline" className="rounded-full px-3 py-1">
        {t.statuses.CLOSED}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="rounded-full px-3 py-1">
      {t.statuses.INACTIVE}
    </Badge>
  );
}

export default function TreasuryAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [account, setAccount] = useState<TreasuryAccount | null>(null);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [form, setForm] = useState<AccountForm | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);

  const accountIcon = account?.account_type === "BANK" ? Building2 : Banknote;
  const AccountIcon = accountIcon;

  function updateForm<K extends keyof AccountForm>(key: K, value: AccountForm[K]) {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        [key]: value,
      };
    });
  }

  async function loadAccount(showToast = false) {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/treasury/accounts/${resolvedParams.id}/`, {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      const nextAccount = (payload?.data || payload) as TreasuryAccount;

      setAccount(nextAccount);
      setForm(buildForm(nextAccount));

      if (showToast) {
        toast.success(t.refresh);
      }
    } catch (error) {
      console.error(error);
      setAccount(null);
      setForm(null);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadTransactions() {
    try {
      setIsTransactionsLoading(true);

      const response = await fetch(
        `/api/treasury/transactions/?page_size=8&treasury_account_id=${resolvedParams.id}`,
        {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      setTransactions(toArray(payload) as TreasuryTransaction[]);
    } catch (error) {
      console.error(error);
      setTransactions([]);
      toast.error(t.transactionsError);
    } finally {
      setIsTransactionsLoading(false);
    }
  }

  async function saveChanges() {
    if (!form) return;

    if (!form.name.trim() || !form.code.trim()) {
      toast.error(t.required);
      return;
    }

    if (form.account_type === "BANK" && !form.bank_name.trim()) {
      toast.error(t.bankRequired);
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        account_type: form.account_type,
        status: form.status,
        opening_balance: form.opening_balance,
        current_balance: form.current_balance,
        currency: form.currency.trim().toUpperCase() || "SAR",
        bank_name: form.bank_name.trim(),
        account_holder_name: form.account_holder_name.trim(),
        account_number: form.account_number.trim(),
        iban: form.iban.trim(),
        branch_name: form.branch_name.trim(),
        description: form.description.trim(),
        is_default: form.is_default,
      };

      const response = await fetch(`/api/treasury/accounts/${resolvedParams.id}/`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
        const errorMessage =
          typeof data?.errors === "string"
            ? data.errors
            : data?.message || `HTTP ${response.status}`;

        throw new Error(errorMessage);
      }

      const nextAccount = (data?.data || data) as TreasuryAccount;

      setAccount(nextAccount);
      setForm(buildForm(nextAccount));
      setIsEditing(false);

      toast.success(t.updated);
    } catch (error) {
      console.error(error);
      toast.error(t.updateError);
    } finally {
      setIsSaving(false);
    }
  }

  async function deactivateAccount() {
    try {
      setIsDeleting(true);

      const response = await fetch(`/api/treasury/accounts/${resolvedParams.id}/`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      toast.success(payload?.message || t.deleted);

      if (payload?.data?.id) {
        window.location.href = "/system/treasury/accounts";
        return;
      }

      await loadAccount(false);
    } catch (error) {
      console.error(error);
      toast.error(t.deleteError);
    } finally {
      setIsDeleting(false);
    }
  }

  function cancelEdit() {
    if (account) {
      setForm(buildForm(account));
    }

    setIsEditing(false);
  }

  useEffect(() => {
    const next = readLocale();
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    setLocale(next);
  }, []);

  useEffect(() => {
    loadAccount(false);
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id, locale]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              /system/treasury/accounts/{resolvedParams.id}
            </Badge>

            {account ? (
              <>
                <Badge className="rounded-full">
                  {t.types[account.account_type] || account.account_type}
                </Badge>

                {account.is_default ? (
                  <Badge variant="outline" className="rounded-full">
                    {t.defaultAccount}
                  </Badge>
                ) : null}
              </>
            ) : null}
          </div>

          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {account?.name || t.title}
          </h1>

          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {account?.description || t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/system/treasury/accounts">
            <Button variant="outline" className="h-10 rounded-xl">
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            disabled={isLoading}
            onClick={() => {
              loadAccount(true);
              loadTransactions();
            }}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            {t.refresh}
          </Button>

          <Link href={`/system/treasury/accounts/${resolvedParams.id}/statement`}>
            <Button variant="outline" className="h-10 rounded-xl">
              <FileText className="h-4 w-4" />
              {t.statement}
            </Button>
          </Link>

          <Link href="/system/treasury/transactions/create">
            <Button variant="outline" className="h-10 rounded-xl">
              <CreditCard className="h-4 w-4" />
              {t.createTransaction}
            </Button>
          </Link>

          {isEditing ? (
            <>
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                disabled={isSaving}
                onClick={cancelEdit}
              >
                <X className="h-4 w-4" />
                {t.cancelEdit}
              </Button>

              <Button className="h-10 rounded-xl" disabled={isSaving} onClick={saveChanges}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t.save}
              </Button>
            </>
          ) : (
            <Button
              className="h-10 rounded-xl"
              disabled={!account}
              onClick={() => setIsEditing(true)}
            >
              <Edit3 className="h-4 w-4" />
              {t.edit}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex h-52 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loading}
          </CardContent>
        </Card>
      ) : !account || !form ? (
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            {t.noData}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.fields.currentBalance}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Image src="/currency/sar.svg" alt="SAR" width={18} height={18} />
                      <p className="text-2xl font-bold">{money(account.current_balance)}</p>
                    </div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                    <Wallet className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.fields.openingBalance}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Image src="/currency/sar.svg" alt="SAR" width={18} height={18} />
                      <p className="text-2xl font-bold">{money(account.opening_balance)}</p>
                    </div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                    <Banknote className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.fields.accountType}</p>
                    <p className="mt-2 text-lg font-bold">
                      {t.types[account.account_type] || account.account_type}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                    <AccountIcon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.fields.status}</p>
                    <div className="mt-2">{statusBadge(account.status, t)}</div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AccountIcon className="h-4 w-4" />
                {t.accountData}
              </CardTitle>
              <CardDescription>{t.subtitle}</CardDescription>
            </CardHeader>

            <CardContent>
              {isEditing ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t.fields.name}</Label>
                    <Input
                      className="h-10 rounded-xl"
                      value={form.name}
                      onChange={(event) => updateForm("name", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t.fields.code}</Label>
                    <Input
                      className="h-10 rounded-xl"
                      value={form.code}
                      onChange={(event) => updateForm("code", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t.fields.accountType}</Label>
                    <select
                      className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                      value={form.account_type}
                      onChange={(event) =>
                        updateForm("account_type", event.target.value as TreasuryAccountType)
                      }
                    >
                      <option value="CASHBOX">{t.types.CASHBOX}</option>
                      <option value="BANK">{t.types.BANK}</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t.fields.status}</Label>
                    <select
                      className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                      value={form.status}
                      onChange={(event) =>
                        updateForm("status", event.target.value as TreasuryAccountStatus)
                      }
                    >
                      <option value="ACTIVE">{t.statuses.ACTIVE}</option>
                      <option value="INACTIVE">{t.statuses.INACTIVE}</option>
                      <option value="SUSPENDED">{t.statuses.SUSPENDED}</option>
                      <option value="CLOSED">{t.statuses.CLOSED}</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t.fields.openingBalance}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-10 rounded-xl"
                      value={form.opening_balance}
                      onChange={(event) => updateForm("opening_balance", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t.fields.currentBalance}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-10 rounded-xl"
                      value={form.current_balance}
                      onChange={(event) => updateForm("current_balance", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t.fields.currency}</Label>
                    <Input
                      className="h-10 rounded-xl"
                      value={form.currency}
                      onChange={(event) =>
                        updateForm("currency", event.target.value.toUpperCase())
                      }
                    />
                  </div>

                  <label className="flex h-10 items-center gap-2 rounded-xl border px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_default}
                      onChange={(event) => updateForm("is_default", event.target.checked)}
                    />
                    {t.defaultAccount}
                  </label>

                  {form.account_type === "BANK" ? (
                    <>
                      <div className="space-y-2">
                        <Label>{t.fields.bankName}</Label>
                        <Input
                          className="h-10 rounded-xl"
                          value={form.bank_name}
                          onChange={(event) => updateForm("bank_name", event.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{t.fields.holderName}</Label>
                        <Input
                          className="h-10 rounded-xl"
                          value={form.account_holder_name}
                          onChange={(event) =>
                            updateForm("account_holder_name", event.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{t.fields.accountNumber}</Label>
                        <Input
                          className="h-10 rounded-xl"
                          value={form.account_number}
                          onChange={(event) =>
                            updateForm("account_number", event.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{t.fields.iban}</Label>
                        <Input
                          className="h-10 rounded-xl"
                          value={form.iban}
                          onChange={(event) => updateForm("iban", event.target.value)}
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label>{t.fields.branch}</Label>
                        <Input
                          className="h-10 rounded-xl"
                          value={form.branch_name}
                          onChange={(event) => updateForm("branch_name", event.target.value)}
                        />
                      </div>
                    </>
                  ) : null}

                  <div className="space-y-2 md:col-span-2">
                    <Label>{t.fields.description}</Label>
                    <textarea
                      className="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={form.description}
                      onChange={(event) => updateForm("description", event.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <FieldCard label={t.fields.name} value={account.name} />
                  <FieldCard label={t.fields.code} value={account.code} />
                  <FieldCard
                    label={t.fields.accountType}
                    value={t.types[account.account_type] || account.account_type}
                  />
                  <FieldCard label={t.fields.status}>
                    {statusBadge(account.status, t)}
                  </FieldCard>
                  <FieldCard label={t.fields.currency} value={account.currency} />
                  <FieldCard
                    label={t.fields.ledgerAccount}
                    value={
                      account.ledger_account
                        ? `${account.ledger_account.code || ""} ${
                            account.ledger_account.name_ar ||
                            account.ledger_account.name ||
                            account.ledger_account.name_en ||
                            ""
                          }`
                        : "-"
                    }
                  />
                  <FieldCard label={t.fields.description} value={account.description} />
                </div>
              )}
            </CardContent>
          </Card>

          {account.account_type === "BANK" || isEditing ? (
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4" />
                  {t.bankData}
                </CardTitle>
                <CardDescription>{t.types.BANK}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FieldCard label={t.fields.bankName} value={account.bank_name} />
                <FieldCard label={t.fields.holderName} value={account.account_holder_name} />
                <FieldCard label={t.fields.accountNumber} value={account.account_number} />
                <FieldCard label={t.fields.iban} value={account.iban} />
                <FieldCard label={t.fields.branch} value={account.branch_name} />
              </CardContent>
            </Card>
          ) : null}

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="h-4 w-4" />
                    {t.latestTransactions}
                  </CardTitle>
                  <CardDescription>{t.fields.currentBalance}</CardDescription>
                </div>

                <Link href={`/system/treasury/accounts/${resolvedParams.id}/statement`}>
                  <Button variant="outline" className="h-10 rounded-xl">
                    <FileText className="h-4 w-4" />
                    {t.statement}
                  </Button>
                </Link>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {isTransactionsLoading ? (
                <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.transactionsLoading}
                </div>
              ) : transactions.length ? (
                transactions.map((transaction) => (
                  <Link
                    key={transaction.id}
                    href={`/system/treasury/transactions/${transaction.id}`}
                  >
                    <div className="flex flex-col gap-3 rounded-xl border p-3 transition hover:bg-muted/40 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">{transaction.transaction_number}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {transaction.transaction_type_label || transaction.transaction_type} ·{" "}
                          {transaction.transaction_date || "-"} ·{" "}
                          {transaction.reference || transaction.description || "-"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 font-semibold">
                        <Image src="/currency/sar.svg" alt="SAR" width={16} height={16} />
                        {money(transaction.amount)}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  {t.noTransactions}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">{t.systemData}</CardTitle>
                <CardDescription>{account.code}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2">
                <FieldCard label={t.fields.createdAt} value={dateTime(account.created_at)} />
                <FieldCard label={t.fields.updatedAt} value={dateTime(account.updated_at)} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-destructive/20 bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-destructive">
                  <ShieldAlert className="h-4 w-4" />
                  {t.deactivate}
                </CardTitle>
                <CardDescription>
                  {locale === "ar"
                    ? "إذا كان الحساب مرتبطًا بحركات مؤكدة سيتم تعطيله بدل حذفه."
                    : "If the account has confirmed transactions, it will be deactivated instead of deleted."}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <Button
                  variant="destructive"
                  className="h-10 w-full rounded-xl"
                  disabled={isDeleting}
                  onClick={deactivateAccount}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldAlert className="h-4 w-4" />
                  )}
                  {t.deactivate}
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}