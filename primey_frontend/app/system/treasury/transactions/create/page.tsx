"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CreditCard, Loader2, Save } from "lucide-react";
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
  transaction_type: string;
  status: string;
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
  if (typeof window === "undefined") return "ar";
  const saved = localStorage.getItem("primey-locale");
  return saved === "en" || saved === "ar" ? saved : document.documentElement.lang === "en" ? "en" : "ar";
}

function toArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";
  return {
    title: ar ? "إضافة حركة مالية" : "Create Treasury Transaction",
    subtitle: ar ? "إنشاء قبض أو صرف أو تحويل أو تسوية داخل الخزينة." : "Create receipt, payment, transfer, or adjustment.",
    back: ar ? "قائمة الحركات" : "Transactions List",
    saveDraft: ar ? "حفظ كمسودة" : "Save Draft",
    saveConfirmed: ar ? "إنشاء مؤكدة" : "Create Confirmed",
    loadingAccounts: ar ? "جاري تحميل الحسابات..." : "Loading accounts...",
    saving: ar ? "جاري الحفظ..." : "Saving...",
    saved: ar ? "تم إنشاء الحركة بنجاح" : "Transaction created successfully",
    apiError: ar ? "تعذر إنشاء الحركة." : "Unable to create transaction.",
    required: ar ? "يرجى تعبئة الحقول المطلوبة." : "Please fill required fields.",
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

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function loadAccounts() {
    try {
      setIsLoadingAccounts(true);
      const response = await fetch("/api/treasury/accounts/?page_size=100&status=ACTIVE", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      setAccounts(toArray(payload) as Account[]);
    } catch (error) {
      console.error(error);
      toast.error(t.loadingAccounts);
    } finally {
      setIsLoadingAccounts(false);
    }
  }

  async function submit(status: "DRAFT" | "CONFIRMED") {
    if (!form.transaction_number || !form.transaction_date || !form.treasury_account_id || !form.amount) {
      toast.error(t.required);
      return;
    }

    if (form.transaction_type === "TRANSFER" && !form.destination_account_id) {
      toast.error(t.required);
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        ...form,
        status,
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

      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || `HTTP ${response.status}`);
      }

      toast.success(t.saved);
      window.location.href = "/system/treasury/transactions";
    } catch (error) {
      console.error(error);
      toast.error(t.apiError);
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    const next = readLocale();
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    setLocale(next);
  }, []);

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const showDestination = form.transaction_type === "TRANSFER";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">/system/treasury/transactions/create</Badge>
            <Badge className="rounded-full">{t.types[form.transaction_type as keyof typeof t.types]}</Badge>
          </div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">{t.title}</h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">{t.subtitle}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/system/treasury/transactions">
            <Button variant="outline" className="h-10 rounded-xl">
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </Button>
          </Link>
          <Button variant="outline" className="h-10 rounded-xl" disabled={isSaving} onClick={() => submit("DRAFT")}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t.saveDraft}
          </Button>
          <Button className="h-10 rounded-xl" disabled={isSaving} onClick={() => submit("CONFIRMED")}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {t.saveConfirmed}
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
            <Input className="h-10 rounded-xl" value={form.transaction_number} onChange={(e) => update("transaction_number", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t.fields.date}</Label>
            <Input type="date" className="h-10 rounded-xl" value={form.transaction_date} onChange={(e) => update("transaction_date", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t.fields.type}</Label>
            <select className="h-10 w-full rounded-xl border bg-background px-3 text-sm" value={form.transaction_type} onChange={(e) => update("transaction_type", e.target.value)}>
              {Object.entries(t.types).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>{t.fields.account}</Label>
            <select className="h-10 w-full rounded-xl border bg-background px-3 text-sm" value={form.treasury_account_id} onChange={(e) => {
              const selected = accounts.find((item) => String(item.id) === e.target.value);
              update("treasury_account_id", e.target.value);
              update("currency", selected?.currency || "SAR");
            }}>
              <option value="">{isLoadingAccounts ? t.loadingAccounts : "-"}</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
              ))}
            </select>
          </div>

          {showDestination ? (
            <div className="space-y-2 md:col-span-2">
              <Label>{t.fields.destination}</Label>
              <select className="h-10 w-full rounded-xl border bg-background px-3 text-sm" value={form.destination_account_id} onChange={(e) => update("destination_account_id", e.target.value)}>
                <option value="">-</option>
                {accounts.filter((item) => String(item.id) !== form.treasury_account_id).map((item) => (
                  <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>{t.fields.amount}</Label>
            <Input type="number" min="0" step="0.01" className="h-10 rounded-xl" value={form.amount} onChange={(e) => update("amount", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t.fields.currency}</Label>
            <Input className="h-10 rounded-xl" value={form.currency} onChange={(e) => update("currency", e.target.value.toUpperCase())} />
          </div>

          <div className="space-y-2">
            <Label>{t.fields.reference}</Label>
            <Input className="h-10 rounded-xl" value={form.reference} onChange={(e) => update("reference", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t.fields.external}</Label>
            <Input className="h-10 rounded-xl" value={form.external_reference} onChange={(e) => update("external_reference", e.target.value)} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>{t.fields.description}</Label>
            <Input className="h-10 rounded-xl" value={form.description} onChange={(e) => update("description", e.target.value)} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>{t.fields.notes}</Label>
            <Input className="h-10 rounded-xl" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}