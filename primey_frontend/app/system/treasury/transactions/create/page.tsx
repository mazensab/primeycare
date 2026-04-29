"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  CalendarDays,
  CreditCard,
  Loader2,
  RefreshCcw,
  Save,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

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

type TransactionType =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER"
  | "OPENING_BALANCE"
  | "ADJUSTMENT"
  | "DEPOSIT"
  | "WITHDRAW";

type TransactionStatus = "DRAFT" | "CONFIRMED";

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
};

type PaginatedPayload<T> = {
  items?: T[];
  pagination?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  choices?: Record<string, unknown>;
};

type Account = {
  id: number | string;
  name: string;
  code: string;
  account_type: string;
  account_type_label?: string;
  status: string;
  status_label?: string;
  currency: string;
  current_balance: string;
};

type FormData = {
  transaction_number: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  transaction_date: string;
  treasury_account_id: string;
  destination_account_id: string;
  amount: string;
  currency: string;
  reference: string;
  external_reference: string;
  description: string;
  notes: string;
};

const SAR_ICON = "/currency/sar.svg";

function readLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const saved = window.localStorage.getItem("primey-locale");
    if (saved === "en" || saved === "ar") return saved;

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

function toArray<T>(payload: unknown): T[] {
  const envelope = payload as ApiEnvelope<PaginatedPayload<T> | T[]>;
  const direct = payload as {
    items?: T[];
    results?: T[];
    data?: T[] | PaginatedPayload<T>;
  };

  if (Array.isArray(payload)) return payload as T[];

  if (Array.isArray(envelope?.data)) return envelope.data as T[];

  if (
    envelope?.data &&
    typeof envelope.data === "object" &&
    !Array.isArray(envelope.data) &&
    Array.isArray((envelope.data as PaginatedPayload<T>).items)
  ) {
    return ((envelope.data as PaginatedPayload<T>).items || []) as T[];
  }

  if (Array.isArray(direct.items)) return direct.items;
  if (Array.isArray(direct.results)) return direct.results;

  return [];
}

function normalizeAccount(item: unknown): Account {
  const row = (item || {}) as Record<string, unknown>;

  return {
    id: (row.id as number | string | undefined) || "",
    name: String(row.name || ""),
    code: String(row.code || ""),
    account_type: String(row.account_type || ""),
    account_type_label: row.account_type_label
      ? String(row.account_type_label)
      : undefined,
    status: String(row.status || "ACTIVE"),
    status_label: row.status_label ? String(row.status_label) : undefined,
    currency: String(row.currency || "SAR"),
    current_balance: String(row.current_balance || "0.00"),
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function generateNumber(type: TransactionType = "INCOME") {
  const prefix = type === "TRANSFER" ? "TRF" : "TRX";
  return `${prefix}-${Date.now()}`;
}

function transactionTypes(): TransactionType[] {
  return [
    "INCOME",
    "EXPENSE",
    "TRANSFER",
    "OPENING_BALANCE",
    "ADJUSTMENT",
    "DEPOSIT",
    "WITHDRAW",
  ];
}

function isValidTransactionType(value: string | null): value is TransactionType {
  return Boolean(value && transactionTypes().includes(value as TransactionType));
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "إضافة حركة مالية" : "Create Treasury Transaction",
    transferTitle: ar ? "إنشاء تحويل خزينة" : "Create Treasury Transfer",
    subtitle: ar
      ? "إنشاء قبض أو صرف أو تحويل أو تسوية داخل الخزينة مع تطبيق أثر الرصيد عند التأكيد."
      : "Create receipt, payment, transfer, or adjustment with balance effect on confirmation.",
    transferSubtitle: ar
      ? "تحويل مبلغ بين حساب خزينة مصدر وحساب وجهة مع منع التحويل لنفس الحساب."
      : "Move an amount between source and destination treasury accounts.",
    back: ar ? "قائمة الحركات" : "Transactions List",
    backTransfers: ar ? "قائمة التحويلات" : "Transfers List",
    saveDraft: ar ? "حفظ كمسودة" : "Save Draft",
    saveConfirmed: ar ? "إنشاء مؤكدة" : "Create Confirmed",
    loadingAccounts: ar ? "جاري تحميل الحسابات..." : "Loading accounts...",
    saving: ar ? "جاري الحفظ..." : "Saving...",
    saved: ar ? "تم إنشاء الحركة بنجاح" : "Transaction created successfully",
    apiError: ar ? "تعذر إنشاء الحركة." : "Unable to create transaction.",
    accountsError: ar ? "تعذر تحميل حسابات الخزينة." : "Unable to load treasury accounts.",
    required: ar ? "يرجى تعبئة الحقول المطلوبة." : "Please fill required fields.",
    invalidAmount: ar ? "المبلغ يجب أن يكون أكبر من صفر." : "Amount must be greater than zero.",
    sameAccount: ar
      ? "لا يمكن اختيار نفس الحساب كحساب أساسي ووجهة."
      : "Source and destination accounts cannot be the same.",
    reloadAccounts: ar ? "تحديث الحسابات" : "Refresh Accounts",
    sourceBalance: ar ? "رصيد الحساب الأساسي" : "Source Balance",
    destinationBalance: ar ? "رصيد الحساب الوجهة" : "Destination Balance",
    selectedAccount: ar ? "الحساب المختار" : "Selected Account",
    notSelected: ar ? "غير محدد" : "Not selected",
    activeOnly: ar ? "الحسابات النشطة فقط" : "Active accounts only",
    fields: {
      number: ar ? "رقم الحركة" : "Transaction Number",
      type: ar ? "نوع الحركة" : "Transaction Type",
      status: ar ? "الحالة" : "Status",
      date: ar ? "تاريخ الحركة" : "Transaction Date",
      account: ar ? "الحساب الأساسي" : "Treasury Account",
      destination: ar ? "الحساب الوجهة" : "Destination Account",
      amount: ar ? "المبلغ" : "Amount",
      currency: ar ? "العملة" : "Currency",
      reference: ar ? "المرجع" : "Reference",
      external: ar ? "مرجع خارجي" : "External Reference",
      description: ar ? "الوصف" : "Description",
      notes: ar ? "ملاحظات" : "Notes",
    },
    placeholders: {
      account: ar ? "اختر حساب الخزينة" : "Select treasury account",
      destination: ar ? "اختر حساب الوجهة" : "Select destination account",
      amount: ar ? "0.00" : "0.00",
      reference: ar ? "مثال: سند قبض / تحويل داخلي" : "Example: receipt / internal transfer",
      external: ar ? "رقم مرجع خارجي إن وجد" : "External reference if available",
      description: ar ? "وصف مختصر للحركة" : "Short transaction description",
      notes: ar ? "ملاحظات داخلية" : "Internal notes",
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
    statuses: {
      DRAFT: ar ? "مسودة" : "Draft",
      CONFIRMED: ar ? "مؤكدة" : "Confirmed",
    },
    hints: {
      confirmed: ar
        ? "عند الإنشاء كمؤكدة سيتم تطبيق أثر الرصيد مباشرة."
        : "Creating as confirmed applies the balance effect immediately.",
      transfer: ar
        ? "في التحويل سيتم خصم المبلغ من الحساب الأساسي وإضافته إلى الحساب الوجهة."
        : "Transfer deducts from source account and adds to destination account.",
      draft: ar
        ? "المسودة لا تؤثر على الرصيد حتى يتم تأكيدها."
        : "Draft does not affect balance until confirmed.",
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

export default function TreasuryTransactionCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const queryType = searchParams.get("transaction_type");
  const initialType = isValidTransactionType(queryType) ? queryType : "INCOME";

  const [form, setForm] = useState<FormData>({
    transaction_number: generateNumber(initialType),
    transaction_type: initialType,
    status: "DRAFT",
    transaction_date: today(),
    treasury_account_id: "",
    destination_account_id: "",
    amount: "",
    currency: "SAR",
    reference: initialType === "TRANSFER" ? "TREASURY_TRANSFER" : "",
    external_reference: "",
    description: "",
    notes: "",
  });

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const showDestination = form.transaction_type === "TRANSFER";
  const isTransferMode = form.transaction_type === "TRANSFER";

  const selectedSource = useMemo(() => {
    return accounts.find((item) => String(item.id) === form.treasury_account_id);
  }, [accounts, form.treasury_account_id]);

  const selectedDestination = useMemo(() => {
    return accounts.find((item) => String(item.id) === form.destination_account_id);
  }, [accounts, form.destination_account_id]);

  const pageTitle = isTransferMode ? t.transferTitle : t.title;
  const pageSubtitle = isTransferMode ? t.transferSubtitle : t.subtitle;
  const backHref = isTransferMode
    ? "/system/treasury/transfers"
    : "/system/treasury/transactions";
  const backLabel = isTransferMode ? t.backTransfers : t.back;

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function loadAccounts(showToast = false) {
    try {
      setIsLoadingAccounts(true);

      const payload = await fetchJson<unknown>(
        "/api/treasury/accounts/?page_size=100&status=ACTIVE",
      );

      const normalized = toArray<unknown>(payload).map(normalizeAccount);

      setAccounts(normalized);

      if (showToast) {
        toast.success(t.reloadAccounts);
      }
    } catch (error) {
      console.error("Treasury accounts load error:", error);
      setAccounts([]);
      toast.error(t.accountsError);
    } finally {
      setIsLoadingAccounts(false);
    }
  }

  function validate(status: TransactionStatus) {
    if (
      !form.transaction_number.trim() ||
      !form.transaction_date ||
      !form.treasury_account_id ||
      !form.amount ||
      !form.currency.trim()
    ) {
      toast.error(t.required);
      return false;
    }

    if (toNumber(form.amount) <= 0) {
      toast.error(t.invalidAmount);
      return false;
    }

    if (form.transaction_type === "TRANSFER" && !form.destination_account_id) {
      toast.error(t.required);
      return false;
    }

    if (
      form.transaction_type === "TRANSFER" &&
      form.destination_account_id &&
      form.destination_account_id === form.treasury_account_id
    ) {
      toast.error(t.sameAccount);
      return false;
    }

    if (!status) {
      toast.error(t.required);
      return false;
    }

    return true;
  }

  async function submit(status: TransactionStatus) {
    if (!validate(status)) return;

    try {
      setIsSaving(true);

      const payload = {
        transaction_number: form.transaction_number.trim(),
        transaction_type: form.transaction_type,
        status,
        transaction_date: form.transaction_date,
        treasury_account_id: form.treasury_account_id,
        destination_account_id:
          form.transaction_type === "TRANSFER"
            ? form.destination_account_id
            : "",
        amount: String(toNumber(form.amount)),
        currency: form.currency.trim().toUpperCase(),
        reference: form.reference.trim(),
        external_reference: form.external_reference.trim(),
        description: form.description.trim(),
        notes: form.notes.trim(),
      };

      const response = await fetchJson<ApiEnvelope<unknown>>(
        "/api/treasury/transactions/",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      toast.success(response.message || t.saved);

      router.push(
        form.transaction_type === "TRANSFER"
          ? "/system/treasury/transfers"
          : "/system/treasury/transactions",
      );
      router.refresh();
    } catch (error) {
      console.error("Treasury transaction create error:", error);
      toast.error(t.apiError);
    } finally {
      setIsSaving(false);
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
    loadAccounts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    const nextType = searchParams.get("transaction_type");

    if (isValidTransactionType(nextType) && nextType !== form.transaction_type) {
      setForm((current) => ({
        ...current,
        transaction_type: nextType,
        transaction_number: generateNumber(nextType),
        reference: nextType === "TRANSFER" ? "TREASURY_TRANSFER" : current.reference,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (form.transaction_type !== "TRANSFER" && form.destination_account_id) {
      update("destination_account_id", "");
    }

    if (form.transaction_type === "TRANSFER" && !form.reference) {
      update("reference", "TREASURY_TRANSFER");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.transaction_type]);

  useEffect(() => {
    if (selectedSource?.currency && selectedSource.currency !== form.currency) {
      update("currency", selectedSource.currency);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSource?.id]);

  const kpiCards = [
    {
      title: t.fields.type,
      value: t.types[form.transaction_type],
      icon: isTransferMode ? ArrowLeftRight : CreditCard,
    },
    {
      title: t.fields.date,
      value: form.transaction_date || "-",
      icon: CalendarDays,
    },
    {
      title: t.selectedAccount,
      value: selectedSource?.name || t.notSelected,
      icon: Wallet,
    },
    {
      title: t.fields.status,
      value: t.statuses[form.status],
      icon: ShieldCheck,
    },
  ];

  return (
    <PermissionGuard
      permission={PERMISSIONS.TREASURY_CREATE}
      workspace="system"
      mode="fallback"
    >
      <div className="space-y-5" dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                /system/treasury/transactions/create
              </Badge>
              <Badge className="rounded-full">
                {t.types[form.transaction_type]}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {t.activeOnly}
              </Badge>
            </div>

            <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
              {pageTitle}
            </h1>

            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {pageSubtitle}
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
              disabled={isLoadingAccounts || isSaving}
              onClick={() => loadAccounts(true)}
            >
              {isLoadingAccounts ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              {t.reloadAccounts}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              disabled={isSaving}
              onClick={() => {
                update("status", "DRAFT");
                submit("DRAFT");
              }}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? t.saving : t.saveDraft}
            </Button>

            <Button
              type="button"
              className="h-10 rounded-xl"
              disabled={isSaving}
              onClick={() => {
                update("status", "CONFIRMED");
                submit("CONFIRMED");
              }}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {isSaving ? t.saving : t.saveConfirmed}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.title} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{item.title}</p>
                      <p className="mt-1 truncate text-lg font-bold">
                        {item.value}
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

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{pageTitle}</CardTitle>
              <CardDescription>{pageSubtitle}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.fields.number}</Label>
                <Input
                  className="h-10 rounded-xl"
                  value={form.transaction_number}
                  onChange={(event) =>
                    update("transaction_number", event.target.value)
                  }
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label>{t.fields.date}</Label>
                <Input
                  type="date"
                  className="h-10 rounded-xl"
                  value={form.transaction_date}
                  onChange={(event) =>
                    update("transaction_date", event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{t.fields.type}</Label>
                <select
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  value={form.transaction_type}
                  onChange={(event) => {
                    const nextType = event.target.value as TransactionType;

                    setForm((current) => ({
                      ...current,
                      transaction_type: nextType,
                      transaction_number: generateNumber(nextType),
                      destination_account_id:
                        nextType === "TRANSFER"
                          ? current.destination_account_id
                          : "",
                      reference:
                        nextType === "TRANSFER"
                          ? "TREASURY_TRANSFER"
                          : current.reference === "TREASURY_TRANSFER"
                            ? ""
                            : current.reference,
                    }));
                  }}
                >
                  {transactionTypes().map((value) => (
                    <option key={value} value={value}>
                      {t.types[value]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>{t.fields.status}</Label>
                <select
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(event) =>
                    update("status", event.target.value as TransactionStatus)
                  }
                >
                  <option value="DRAFT">{t.statuses.DRAFT}</option>
                  <option value="CONFIRMED">{t.statuses.CONFIRMED}</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>{t.fields.account}</Label>
                <select
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  value={form.treasury_account_id}
                  disabled={isLoadingAccounts}
                  onChange={(event) => {
                    const selected = accounts.find(
                      (item) => String(item.id) === event.target.value,
                    );

                    update("treasury_account_id", event.target.value);
                    update("currency", selected?.currency || "SAR");

                    if (
                      form.destination_account_id &&
                      form.destination_account_id === event.target.value
                    ) {
                      update("destination_account_id", "");
                    }
                  }}
                >
                  <option value="">
                    {isLoadingAccounts ? t.loadingAccounts : t.placeholders.account}
                  </option>

                  {accounts.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.code} - {item.name}
                    </option>
                  ))}
                </select>
              </div>

              {showDestination ? (
                <div className="space-y-2">
                  <Label>{t.fields.destination}</Label>
                  <select
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                    value={form.destination_account_id}
                    disabled={isLoadingAccounts}
                    onChange={(event) =>
                      update("destination_account_id", event.target.value)
                    }
                  >
                    <option value="">{t.placeholders.destination}</option>

                    {accounts
                      .filter(
                        (item) => String(item.id) !== form.treasury_account_id,
                      )
                      .map((item) => (
                        <option key={item.id} value={String(item.id)}>
                          {item.code} - {item.name}
                        </option>
                      ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>{t.fields.amount}</Label>
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
                    className="h-10 rounded-xl ltr:pl-10 rtl:pr-10"
                    value={form.amount}
                    placeholder={t.placeholders.amount}
                    onChange={(event) => update("amount", event.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t.fields.currency}</Label>
                <Input
                  className="h-10 rounded-xl"
                  value={form.currency}
                  onChange={(event) =>
                    update("currency", event.target.value.toUpperCase())
                  }
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label>{t.fields.reference}</Label>
                <Input
                  className="h-10 rounded-xl"
                  value={form.reference}
                  placeholder={t.placeholders.reference}
                  onChange={(event) => update("reference", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t.fields.external}</Label>
                <Input
                  className="h-10 rounded-xl"
                  value={form.external_reference}
                  placeholder={t.placeholders.external}
                  onChange={(event) =>
                    update("external_reference", event.target.value)
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>{t.fields.description}</Label>
                <Input
                  className="h-10 rounded-xl"
                  value={form.description}
                  placeholder={t.placeholders.description}
                  onChange={(event) => update("description", event.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>{t.fields.notes}</Label>
                <Input
                  className="h-10 rounded-xl"
                  value={form.notes}
                  placeholder={t.placeholders.notes}
                  onChange={(event) => update("notes", event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.selectedAccount}</CardTitle>
                <CardDescription>{t.hints.confirmed}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="rounded-2xl border p-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">
                      {selectedSource?.name || t.notSelected}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                    {selectedSource?.code || "-"}
                  </p>
                  <div className="mt-3 flex items-center gap-2 font-semibold" dir="ltr">
                    <Image src={SAR_ICON} alt="SAR" width={16} height={16} />
                    {money(selectedSource?.current_balance || "0.00")}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.sourceBalance}
                  </p>
                </div>

                {showDestination ? (
                  <div className="rounded-2xl border p-3">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">
                        {selectedDestination?.name || t.notSelected}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                      {selectedDestination?.code || "-"}
                    </p>
                    <div className="mt-3 flex items-center gap-2 font-semibold" dir="ltr">
                      <Image src={SAR_ICON} alt="SAR" width={16} height={16} />
                      {money(selectedDestination?.current_balance || "0.00")}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.destinationBalance}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {isTransferMode ? t.hints.transfer : t.hints.draft}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{t.hints.draft}</p>
                <p>{t.hints.confirmed}</p>
                {isTransferMode ? <p>{t.hints.transfer}</p> : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}