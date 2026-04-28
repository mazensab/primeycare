"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Save, Wallet } from "lucide-react";
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

type FormData = {
  name: string;
  code: string;
  account_type: "CASHBOX" | "BANK";
  status: string;
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
  const saved = localStorage.getItem("primey-locale");
  return saved === "en" || saved === "ar" ? saved : document.documentElement.lang === "en" ? "en" : "ar";
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";
  return {
    title: ar ? "إنشاء حساب خزينة" : "Create Treasury Account",
    subtitle: ar ? "إضافة صندوق نقدي أو حساب بنكي وربطه لاحقًا بالحسابات." : "Create a cashbox or bank account and link it later to accounting.",
    back: ar ? "حسابات الخزينة" : "Treasury Accounts",
    save: ar ? "حفظ الحساب" : "Save Account",
    saving: ar ? "جاري الحفظ..." : "Saving...",
    saved: ar ? "تم إنشاء حساب الخزينة بنجاح" : "Treasury account created successfully",
    apiError: ar ? "تعذر إنشاء حساب الخزينة." : "Unable to create treasury account.",
    required: ar ? "يرجى تعبئة الحقول المطلوبة." : "Please fill required fields.",
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

export default function TreasuryAccountCreatePage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<FormData>({
    name: "",
    code: "",
    account_type: "CASHBOX",
    status: "ACTIVE",
    opening_balance: "0.00",
    current_balance: "0.00",
    currency: "SAR",
    bank_name: "",
    account_holder_name: "",
    account_number: "",
    iban: "",
    branch_name: "",
    description: "",
    is_default: false,
  });

  const t = useMemo(() => dictionary(locale), [locale]);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    if (!form.name || !form.code || !form.account_type) {
      toast.error(t.required);
      return;
    }

    if (form.account_type === "BANK" && !form.bank_name) {
      toast.error(t.required);
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/treasury/accounts/", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      toast.success(t.saved);
      window.location.href = "/system/treasury/accounts";
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">/system/treasury/accounts/create</Badge>
            <Badge className="rounded-full">{t.types[form.account_type]}</Badge>
          </div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">{t.title}</h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">{t.subtitle}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/system/treasury/accounts">
            <Button variant="outline" className="h-10 rounded-xl">
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </Button>
          </Link>
          <Button className="h-10 rounded-xl" disabled={isSaving} onClick={submit}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? t.saving : t.save}
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" />
            {t.title}
          </CardTitle>
          <CardDescription>{t.subtitle}</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t.fields.name}</Label>
            <Input className="h-10 rounded-xl" value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t.fields.code}</Label>
            <Input className="h-10 rounded-xl" value={form.code} onChange={(e) => update("code", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t.fields.type}</Label>
            <select className="h-10 w-full rounded-xl border bg-background px-3 text-sm" value={form.account_type} onChange={(e) => update("account_type", e.target.value as FormData["account_type"])}>
              <option value="CASHBOX">{t.types.CASHBOX}</option>
              <option value="BANK">{t.types.BANK}</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>{t.fields.status}</Label>
            <select className="h-10 w-full rounded-xl border bg-background px-3 text-sm" value={form.status} onChange={(e) => update("status", e.target.value)}>
              {Object.entries(t.statuses).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>{t.fields.opening}</Label>
            <Input type="number" min="0" step="0.01" className="h-10 rounded-xl" value={form.opening_balance} onChange={(e) => {
              update("opening_balance", e.target.value);
              update("current_balance", e.target.value);
            }} />
          </div>

          <div className="space-y-2">
            <Label>{t.fields.current}</Label>
            <Input type="number" min="0" step="0.01" className="h-10 rounded-xl" value={form.current_balance} onChange={(e) => update("current_balance", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t.fields.currency}</Label>
            <Input className="h-10 rounded-xl" value={form.currency} onChange={(e) => update("currency", e.target.value.toUpperCase())} />
          </div>

          <label className="flex h-10 items-center gap-2 rounded-xl border px-3 text-sm">
            <input type="checkbox" checked={form.is_default} onChange={(e) => update("is_default", e.target.checked)} />
            {t.fields.default}
          </label>

          {form.account_type === "BANK" ? (
            <>
              <div className="space-y-2">
                <Label>{t.fields.bank}</Label>
                <Input className="h-10 rounded-xl" value={form.bank_name} onChange={(e) => update("bank_name", e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>{t.fields.holder}</Label>
                <Input className="h-10 rounded-xl" value={form.account_holder_name} onChange={(e) => update("account_holder_name", e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>{t.fields.number}</Label>
                <Input className="h-10 rounded-xl" value={form.account_number} onChange={(e) => update("account_number", e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>{t.fields.iban}</Label>
                <Input className="h-10 rounded-xl" value={form.iban} onChange={(e) => update("iban", e.target.value)} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>{t.fields.branch}</Label>
                <Input className="h-10 rounded-xl" value={form.branch_name} onChange={(e) => update("branch_name", e.target.value)} />
              </div>
            </>
          ) : null}

          <div className="space-y-2 md:col-span-2">
            <Label>{t.fields.description}</Label>
            <Input className="h-10 rounded-xl" value={form.description} onChange={(e) => update("description", e.target.value)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}