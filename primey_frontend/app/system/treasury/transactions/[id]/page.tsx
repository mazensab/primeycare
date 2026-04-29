"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  RefreshCcw,
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
import { PERMISSIONS } from "@/lib/permissions";

type AppLocale = "ar" | "en";

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
};

type TreasuryAccount = {
  id?: number | string;
  name?: string;
  code?: string;
  account_type?: string;
  account_type_label?: string;
  status?: string;
  status_label?: string;
  current_balance?: string;
  currency?: string;
};

type TreasuryTransaction = {
  id: number | string;
  transaction_number: string;
  transaction_type: string;
  transaction_type_label?: string;
  status: string;
  status_label?: string;
  transaction_date: string;
  treasury_account?: TreasuryAccount | null;
  treasury_account_id?: number | string;
  destination_account?: TreasuryAccount | null;
  destination_account_id?: number | string | null;
  amount: string;
  currency: string;
  reference?: string;
  external_reference?: string;
  description?: string;
  notes?: string;
  journal_entry_reference?: string;
  created_at?: string | null;
  updated_at?: string | null;
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
    id: row.id as number | string | undefined,
    name: row.name ? String(row.name) : "",
    code: row.code ? String(row.code) : "",
    account_type: row.account_type ? String(row.account_type) : "",
    account_type_label: row.account_type_label
      ? String(row.account_type_label)
      : undefined,
    status: row.status ? String(row.status) : "",
    status_label: row.status_label ? String(row.status_label) : undefined,
    current_balance: row.current_balance ? String(row.current_balance) : "0.00",
    currency: row.currency ? String(row.currency) : "SAR",
  };
}

function normalizeTransaction(item: unknown): TreasuryTransaction {
  const row = (item || {}) as Record<string, unknown>;

  return {
    id: (row.id as number | string | undefined) || "",
    transaction_number: String(row.transaction_number || "-"),
    transaction_type: String(row.transaction_type || ""),
    transaction_type_label: row.transaction_type_label
      ? String(row.transaction_type_label)
      : undefined,
    status: String(row.status || ""),
    status_label: row.status_label ? String(row.status_label) : undefined,
    transaction_date: String(row.transaction_date || ""),
    treasury_account:
      row.treasury_account && typeof row.treasury_account === "object"
        ? normalizeAccount(row.treasury_account)
        : null,
    treasury_account_id: row.treasury_account_id as number | string | undefined,
    destination_account:
      row.destination_account && typeof row.destination_account === "object"
        ? normalizeAccount(row.destination_account)
        : null,
    destination_account_id: row.destination_account_id as
      | number
      | string
      | null
      | undefined,
    amount: String(row.amount || "0.00"),
    currency: String(row.currency || "SAR"),
    reference: row.reference ? String(row.reference) : "",
    external_reference: row.external_reference
      ? String(row.external_reference)
      : "",
    description: row.description ? String(row.description) : "",
    notes: row.notes ? String(row.notes) : "",
    journal_entry_reference: row.journal_entry_reference
      ? String(row.journal_entry_reference)
      : "",
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
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

function dateOnly(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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
    title: ar ? "تفاصيل الحركة المالية" : "Treasury Transaction Details",
    subtitle: ar
      ? "عرض تفاصيل الحركة المالية، الحسابات المرتبطة، وحالة التأكيد أو الإلغاء."
      : "View transaction details, linked accounts, and confirmation or cancellation status.",
    transferTitle: ar ? "تفاصيل تحويل خزينة" : "Treasury Transfer Details",
    backTransactions: ar ? "قائمة الحركات" : "Transactions",
    backTransfers: ar ? "قائمة التحويلات" : "Transfers",
    refresh: ar ? "تحديث" : "Refresh",
    confirm: ar ? "تأكيد الحركة" : "Confirm Transaction",
    cancel: ar ? "إلغاء الحركة" : "Cancel Transaction",
    sourceStatement: ar ? "كشف الحساب الأساسي" : "Source Statement",
    destinationStatement: ar ? "كشف الحساب الوجهة" : "Destination Statement",
    loading: ar ? "جاري تحميل الحركة..." : "Loading transaction...",
    apiError: ar ? "تعذر تحميل بيانات الحركة." : "Unable to load transaction data.",
    actionError: ar ? "تعذر تنفيذ العملية." : "Unable to complete action.",
    confirmed: ar ? "تم تأكيد الحركة بنجاح." : "Transaction confirmed successfully.",
    cancelled: ar ? "تم إلغاء الحركة بنجاح." : "Transaction cancelled successfully.",
    noData: ar ? "لا توجد بيانات لهذه الحركة." : "No data for this transaction.",
    notAvailable: ar ? "غير محدد" : "Not set",
    overview: ar ? "ملخص الحركة" : "Transaction Summary",
    accounts: ar ? "الحسابات المرتبطة" : "Linked Accounts",
    details: ar ? "بيانات الحركة" : "Transaction Data",
    notesTitle: ar ? "الوصف والملاحظات" : "Description and Notes",
    audit: ar ? "التتبع" : "Audit Trail",
    currentBalance: ar ? "الرصيد الحالي" : "Current Balance",
    sourceAccount: ar ? "الحساب الأساسي" : "Source Account",
    destinationAccount: ar ? "الحساب الوجهة" : "Destination Account",
    fields: {
      number: ar ? "رقم الحركة" : "Transaction Number",
      type: ar ? "نوع الحركة" : "Transaction Type",
      status: ar ? "الحالة" : "Status",
      date: ar ? "تاريخ الحركة" : "Transaction Date",
      amount: ar ? "المبلغ" : "Amount",
      currency: ar ? "العملة" : "Currency",
      reference: ar ? "المرجع" : "Reference",
      external: ar ? "مرجع خارجي" : "External Reference",
      journal: ar ? "مرجع القيد" : "Journal Reference",
      description: ar ? "الوصف" : "Description",
      notes: ar ? "ملاحظات" : "Notes",
      created: ar ? "تاريخ الإنشاء" : "Created At",
      updated: ar ? "آخر تحديث" : "Updated At",
      accountCode: ar ? "كود الحساب" : "Account Code",
      accountType: ar ? "نوع الحساب" : "Account Type",
    },
    statuses: {
      DRAFT: ar ? "مسودة" : "Draft",
      CONFIRMED: ar ? "مؤكدة" : "Confirmed",
      CANCELLED: ar ? "ملغاة" : "Cancelled",
    },
    types: {
      INCOME: ar ? "قبض" : "Income",
      EXPENSE: ar ? "صرف" : "Expense",
      TRANSFER: ar ? "تحويل" : "Transfer",
      OPENING_BALANCE: ar ? "رصيد افتتاحي" : "Opening Balance",
      ADJUSTMENT: ar ? "تسوية" : "Adjustment",
      DEPOSIT: ar ? "إيداع" : "Deposit",
      WITHDRAW: ar ? "سحب" : "Withdraw",
    },
    hints: {
      draft: ar
        ? "الحركة المسودة لا تؤثر على الرصيد حتى يتم تأكيدها."
        : "Draft transactions do not affect balance until confirmed.",
      confirmed: ar
        ? "الحركة المؤكدة أثرت على الرصيد ولا يمكن تعديل بياناتها المالية الأساسية."
        : "Confirmed transactions have affected balance and financial fields cannot be edited.",
      cancelled: ar
        ? "الحركة ملغاة، وإذا كانت مؤكدة سابقًا فقد تم عكس أثرها على الرصيد."
        : "Cancelled transaction; if it was previously confirmed, its balance effect has been reversed.",
      transfer: ar
        ? "التحويل يخصم من الحساب الأساسي ويضيف إلى الحساب الوجهة عند التأكيد."
        : "Transfer deducts from source and adds to destination when confirmed.",
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
    throw new Error(payload?.message || `HTTP ${response.status}`);
  }

  return payload as T;
}

function statusBadgeClass(status: string) {
  if (status === "CONFIRMED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
  }

  if (status === "CANCELLED") {
    return "border-red-200 bg-red-50 text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-red-950 dark:text-red-300";
  }

  return "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300";
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

function AccountCard({
  title,
  account,
  statementLabel,
}: {
  title: string;
  account?: TreasuryAccount | null;
  statementLabel: string;
}) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <h3 className="mt-1 font-semibold">
            {account?.name || "-"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
            {account?.code || "-"}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
          {account?.account_type === "BANK" ? (
            <Banknote className="h-5 w-5" />
          ) : (
            <Wallet className="h-5 w-5" />
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field
          label={account?.account_type_label || "Account Type"}
          value={account?.account_type || "-"}
          dir="ltr"
        />

        <div className="rounded-2xl border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">Balance</p>
          <div className="mt-1 flex items-center gap-2 font-bold" dir="ltr">
            <Image src={SAR_ICON} alt="SAR" width={16} height={16} />
            {money(account?.current_balance || "0.00")}
          </div>
        </div>
      </div>

      {account?.id ? (
        <Button asChild variant="outline" className="mt-4 h-10 rounded-xl">
          <Link href={`/system/treasury/accounts/${account.id}/statement`}>
            <FileText className="h-4 w-4" />
            {statementLabel}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

export default function TreasuryTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = use(params);

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [item, setItem] = useState<TreasuryTransaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const isTransfer = item?.transaction_type === "TRANSFER";

  const pageTitle = isTransfer ? t.transferTitle : t.title;
  const backHref = isTransfer
    ? "/system/treasury/transfers"
    : "/system/treasury/transactions";
  const backLabel = isTransfer ? t.backTransfers : t.backTransactions;

  const canConfirm = item?.status === "DRAFT";
  const canCancel = item?.status !== "CANCELLED";

  const transactionHint = useMemo(() => {
    if (!item) return "";

    if (item.status === "CONFIRMED") return t.hints.confirmed;
    if (item.status === "CANCELLED") return t.hints.cancelled;
    if (item.transaction_type === "TRANSFER") return t.hints.transfer;

    return t.hints.draft;
  }, [item, t]);

  async function loadItem(showToast = false) {
    try {
      setIsLoading(true);

      const payload = await fetchJson<ApiEnvelope<unknown>>(
        `/api/treasury/transactions/${resolved.id}/`,
      );

      setItem(normalizeTransaction(payload.data || payload));

      if (showToast) toast.success(t.refresh);
    } catch (error) {
      console.error("Treasury transaction detail load error:", error);
      toast.error(t.apiError);
      setItem(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function confirmTransaction() {
    try {
      setIsActionLoading(true);

      await fetchJson(`/api/treasury/transactions/${resolved.id}/confirm/`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      toast.success(t.confirmed);
      await loadItem(false);
    } catch (error) {
      console.error("Confirm treasury transaction error:", error);
      toast.error(t.actionError);
    } finally {
      setIsActionLoading(false);
    }
  }

  async function cancelTransaction() {
    try {
      setIsActionLoading(true);

      await fetchJson(`/api/treasury/transactions/${resolved.id}/cancel/`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      toast.success(t.cancelled);
      await loadItem(false);
    } catch (error) {
      console.error("Cancel treasury transaction error:", error);
      toast.error(t.actionError);
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
    loadItem(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved.id, locale]);

  const kpiCards = [
    {
      label: t.fields.amount,
      value: money(item?.amount || "0.00"),
      icon: CreditCard,
      currency: true,
    },
    {
      label: t.fields.type,
      value:
        item?.transaction_type_label ||
        t.types[item?.transaction_type as keyof typeof t.types] ||
        item?.transaction_type ||
        "-",
      icon: isTransfer ? ArrowLeftRight : Wallet,
      currency: false,
    },
    {
      label: t.fields.status,
      value:
        item?.status_label ||
        t.statuses[item?.status as keyof typeof t.statuses] ||
        item?.status ||
        "-",
      icon: ShieldCheck,
      currency: false,
    },
    {
      label: t.fields.date,
      value: dateOnly(item?.transaction_date),
      icon: CalendarDays,
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
                /system/treasury/transactions/{resolved.id}
              </Badge>

              {item ? (
                <>
                  <Badge
                    variant="outline"
                    className={`rounded-full ${statusBadgeClass(item.status)}`}
                  >
                    {item.status_label ||
                      t.statuses[item.status as keyof typeof t.statuses] ||
                      item.status}
                  </Badge>

                  <Badge className="rounded-full">
                    {item.transaction_type_label ||
                      t.types[item.transaction_type as keyof typeof t.types] ||
                      item.transaction_type}
                  </Badge>
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

            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              disabled={isLoading}
              onClick={() => loadItem(true)}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              {t.refresh}
            </Button>

            <Can permission={PERMISSIONS.TREASURY_EDIT}>
              {canCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl"
                  disabled={isActionLoading || isLoading}
                  onClick={cancelTransaction}
                >
                  {isActionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {t.cancel}
                </Button>
              ) : null}
            </Can>

            <Can permission={PERMISSIONS.TREASURY_EDIT}>
              {canConfirm ? (
                <Button
                  type="button"
                  className="h-10 rounded-xl"
                  disabled={isActionLoading || isLoading}
                  onClick={confirmTransaction}
                >
                  {isActionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {t.confirm}
                </Button>
              ) : null}
            </Can>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card key={card.label} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {card.currency ? (
                          <Image
                            src={SAR_ICON}
                            alt="SAR"
                            width={18}
                            height={18}
                          />
                        ) : null}
                        <p className="text-lg font-bold" dir="ltr">
                          {isLoading ? "..." : card.value}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {card.label}
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {item?.transaction_number || t.overview}
            </CardTitle>
            <CardDescription>{transactionHint || t.subtitle}</CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.loading}
              </div>
            ) : item ? (
              <div className="grid gap-4 lg:grid-cols-3">
                <Field
                  label={t.fields.number}
                  value={item.transaction_number}
                  dir="ltr"
                />
                <Field
                  label={t.fields.type}
                  value={
                    item.transaction_type_label ||
                    t.types[item.transaction_type as keyof typeof t.types] ||
                    item.transaction_type
                  }
                />
                <Field
                  label={t.fields.status}
                  value={
                    item.status_label ||
                    t.statuses[item.status as keyof typeof t.statuses] ||
                    item.status
                  }
                />
                <Field
                  label={t.fields.date}
                  value={dateOnly(item.transaction_date)}
                  dir="ltr"
                />

                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">
                    {t.fields.amount}
                  </p>
                  <div className="mt-1 flex items-center gap-2 font-bold" dir="ltr">
                    <Image src={SAR_ICON} alt="SAR" width={18} height={18} />
                    {money(item.amount)}
                  </div>
                </div>

                <Field label={t.fields.currency} value={item.currency} dir="ltr" />
              </div>
            ) : (
              <div className="flex h-56 items-center justify-center rounded-2xl border text-sm text-muted-foreground">
                {t.noData}
              </div>
            )}
          </CardContent>
        </Card>

        {item ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.accounts}</CardTitle>
                <CardDescription>{t.sourceAccount}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <AccountCard
                  title={t.sourceAccount}
                  account={item.treasury_account}
                  statementLabel={t.sourceStatement}
                />

                {item.destination_account ? (
                  <AccountCard
                    title={t.destinationAccount}
                    account={item.destination_account}
                    statementLabel={t.destinationStatement}
                  />
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.details}</CardTitle>
                <CardDescription>{t.fields.reference}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label={t.fields.reference} value={item.reference} />
                <Field
                  label={t.fields.external}
                  value={item.external_reference}
                />
                <Field
                  label={t.fields.journal}
                  value={item.journal_entry_reference}
                  dir="ltr"
                />
                <Field
                  label={t.fields.created}
                  value={dateTime(item.created_at)}
                  dir="ltr"
                />
                <Field
                  label={t.fields.updated}
                  value={dateTime(item.updated_at)}
                  dir="ltr"
                />
              </CardContent>
            </Card>
          </div>
        ) : null}

        {item ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.notesTitle}</CardTitle>
              <CardDescription>{t.fields.description}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label={t.fields.description} value={item.description} />
              <Field label={t.fields.notes} value={item.notes} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PermissionGuard>
  );
}