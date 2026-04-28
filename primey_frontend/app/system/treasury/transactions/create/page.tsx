"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CreditCard, Loader2, Save } from "lucide-react";
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

type Account = {
  id: number | string;
  name: string;
  code: string;
  account_type: string;
  status: string;
  currency: string;
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

function toArray(payload: unknown): unknown[] {
  const data = payload as {
    data?: unknown[] | { items?: unknown[] };
    items?: unknown[];
    results?: unknown[];
  };

  if (Array.isArray(payload)) return payload;

  if (
    data?.data &&
    typeof data.data === "object" &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.items)
  ) {
    return data.data.items;
  }

  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;

  return [];
}

function normalizeAccount(item: unknown): Account {
  const row = (item || {}) as Record<string, unknown>;

  return {
    id: (row.id as number | string | undefined) || "",
    name: String(row.name || ""),
    code: String(row.code || ""),
    account_type: String(row.account_type || ""),
    status: String(row.status || "ACTIVE"),
    currency: String(row.currency || "SAR"),
  };
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "إضافة حركة مالية" : "Create Treasury Transaction",
    subtitle: ar
      ? "إنشاء قبض أو صرف أو تحويل أو تسوية داخل الخزينة."
      : "Create receipt, payment, transfer, or adjustment.",
    back: ar ? "قائمة الحركات" : "Transactions List",
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
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function generateNumber() {
  return `TRX-${Date.now()}`;
}

function toPositiveNumber(value: string): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export default function TreasuryTransactionCreatePage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState<FormData>({
    transaction_number: generateNumber(),
    transaction_type: "INCOME",
    status: "DRAFT",
    transaction_date: today(),
    treasury_account_id: "",
    destination_account_id: "",
    amount: "",
    currency: "SAR",
    reference: "",
    external_reference: "",
    description: "",
    notes: "",
  });

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const showDestination = form.transaction_type === "TRANSFER";

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function loadAccounts() {
    try {
      setIsLoadingAccounts(true);

      const response = await fetch(
        "/api/treasury/accounts/?page_size=100&status=ACTIVE",
        {
          credentials: "include",
          headers: { Accept: "application/json" },
          cache: "no-store",
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.success === false || payload?.ok === false) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      setAccounts(toArray(payload).map(normalizeAccount));
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
      !form.amount
    ) {
      toast.error(t.required);
      return false;
    }

    if (toPositiveNumber(form.amount) <= 0) {
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
        ...form,
        status,
        amount: String(toPositiveNumber(form.amount)),
        transaction_number: form.transaction_number.trim(),
        reference: form.reference.trim(),
        external_reference: form.external_reference.trim(),
        description: form.description.trim(),
        notes: form.notes.trim(),
        destination_account_id:
          form.transaction_type === "TRANSFER" ? form.destination_account_id : "",
      };

      const response = await fetch("/api/treasury/transactions/", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false || data?.ok === false) {
        throw new Error(data?.message || `HTTP ${response.status}`);
      }

      toast.success(t.saved);
      window.location.href = "/system/treasury/transactions";
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
  }, []);

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    if (form.transaction_type !== "TRANSFER" && form.destination_account_id) {
      update("destination_account_id", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.transaction_type]);

  return (
    <PermissionGuard
      permission={PERMISSIONS.TREASURY_CREATE}
      workspace="system"
      mode="fallback"
    >
      <div className="space-y-4" dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                /system/treasury/transactions/create
              </Badge>
              <Badge className="rounded-full">{t.types[form.transaction_type]}</Badge>
            </div>

            <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
              {t.title}
            </h1>

            <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
              {t.subtitle}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/system/treasury/transactions">
                <ArrowLeft className="h-4 w-4" />
                {t.back}
              </Link>
            </Button>

            <Button
              variant="outline"
              className="h-10 rounded-xl"
              disabled={isSaving}
              onClick={() => submit("DRAFT")}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? t.saving : t.saveDraft}
            </Button>

            <Button
              className="h-10 rounded-xl"
              disabled={isSaving}
              onClick={() => submit("CONFIRMED")}
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

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t.title}</CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
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
                onChange={(event) =>
                  update("transaction_type", event.target.value as TransactionType)
                }
              >
                {Object.entries(t.types).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>{t.fields.account}</Label>
              <select
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                value={form.treasury_account_id}
                onChange={(event) => {
                  const selected = accounts.find(
                    (item) => String(item.id) === event.target.value,
                  );

                  update("treasury_account_id", event.target.value);
                  update("currency", selected?.currency || "SAR");
                }}
              >
                <option value="">
                  {isLoadingAccounts ? t.loadingAccounts : "-"}
                </option>

                {accounts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.name}
                  </option>
                ))}
              </select>
            </div>

            {showDestination ? (
              <div className="space-y-2 md:col-span-2">
                <Label>{t.fields.destination}</Label>
                <select
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  value={form.destination_account_id}
                  onChange={(event) =>
                    update("destination_account_id", event.target.value)
                  }
                >
                  <option value="">-</option>

                  {accounts
                    .filter((item) => String(item.id) !== form.treasury_account_id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} - {item.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>{t.fields.amount}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="h-10 rounded-xl"
                value={form.amount}
                onChange={(event) => update("amount", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t.fields.currency}</Label>
              <Input
                className="h-10 rounded-xl"
                value={form.currency}
                onChange={(event) =>
                  update("currency", event.target.value.toUpperCase())
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t.fields.reference}</Label>
              <Input
                className="h-10 rounded-xl"
                value={form.reference}
                onChange={(event) => update("reference", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t.fields.external}</Label>
              <Input
                className="h-10 rounded-xl"
                value={form.external_reference}
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
                onChange={(event) => update("description", event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{t.fields.notes}</Label>
              <Input
                className="h-10 rounded-xl"
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}