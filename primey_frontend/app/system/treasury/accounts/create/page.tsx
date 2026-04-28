"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Save, Wallet } from "lucide-react";
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

type TreasuryAccountType = "CASHBOX" | "BANK";
type TreasuryAccountStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "CLOSED";

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

type ApiResponse = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  detail?: string;
  data?: unknown;
  errors?: Record<string, string[] | string>;
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

function normalizeMoneyInput(value: string): string {
  const parsed = Number(value || 0);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return "0.00";
  }

  return parsed.toFixed(2);
}

function normalizeCurrency(value: string): string {
  return String(value || "SAR")
    .trim()
    .toUpperCase()
    .slice(0, 3);
}

function getApiErrorMessage(payload: ApiResponse | null, fallback: string) {
  if (!payload) return fallback;
  if (payload.message) return payload.message;
  if (payload.detail) return payload.detail;

  if (payload.errors && typeof payload.errors === "object") {
    const firstError = Object.values(payload.errors)[0];

    if (Array.isArray(firstError)) {
      return firstError[0] || fallback;
    }

    if (typeof firstError === "string") {
      return firstError;
    }
  }

  return fallback;
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "إنشاء حساب خزينة" : "Create Treasury Account",
    subtitle: ar
      ? "إضافة صندوق نقدي أو حساب بنكي وربطه لاحقًا بالحسابات."
      : "Create a cashbox or bank account and link it later to accounting.",
    back: ar ? "حسابات الخزينة" : "Treasury Accounts",
    save: ar ? "حفظ الحساب" : "Save Account",
    saving: ar ? "جاري الحفظ..." : "Saving...",
    saved: ar
      ? "تم إنشاء حساب الخزينة بنجاح"
      : "Treasury account created successfully",
    apiError: ar ? "تعذر إنشاء حساب الخزينة." : "Unable to create treasury account.",
    required: ar ? "يرجى تعبئة الحقول المطلوبة." : "Please fill required fields.",
    invalidMoney: ar
      ? "الأرصدة يجب أن تكون أرقامًا صحيحة أو عشرية ولا تقل عن صفر."
      : "Balances must be valid numbers and cannot be negative.",
    invalidCurrency: ar
      ? "رمز العملة يجب أن يتكون من 3 أحرف."
      : "Currency code must be 3 letters.",
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
  const isArabic = locale === "ar";

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateForm() {
    const name = form.name.trim();
    const code = form.code.trim();
    const currency = normalizeCurrency(form.currency);

    const openingBalance = Number(form.opening_balance || 0);
    const currentBalance = Number(form.current_balance || 0);

    if (!name || !code || !form.account_type || !form.status) {
      toast.error(t.required);
      return false;
    }

    if (form.account_type === "BANK" && !form.bank_name.trim()) {
      toast.error(t.required);
      return false;
    }

    if (
      !Number.isFinite(openingBalance) ||
      !Number.isFinite(currentBalance) ||
      openingBalance < 0 ||
      currentBalance < 0
    ) {
      toast.error(t.invalidMoney);
      return false;
    }

    if (currency.length !== 3) {
      toast.error(t.invalidCurrency);
      return false;
    }

    return true;
  }

  function buildPayload(): FormData {
    return {
      ...form,
      name: form.name.trim(),
      code: form.code.trim(),
      currency: normalizeCurrency(form.currency),
      opening_balance: normalizeMoneyInput(form.opening_balance),
      current_balance: normalizeMoneyInput(form.current_balance),
      bank_name: form.account_type === "BANK" ? form.bank_name.trim() : "",
      account_holder_name:
        form.account_type === "BANK" ? form.account_holder_name.trim() : "",
      account_number: form.account_type === "BANK" ? form.account_number.trim() : "",
      iban: form.account_type === "BANK" ? form.iban.trim().toUpperCase() : "",
      branch_name: form.account_type === "BANK" ? form.branch_name.trim() : "",
      description: form.description.trim(),
    };
  }

  async function submit() {
    if (!validateForm()) return;

    try {
      setIsSaving(true);

      const response = await fetch("/api/treasury/accounts/", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(buildPayload()),
      });

      const payload = (await response.json().catch(() => null)) as ApiResponse | null;

      if (!response.ok || payload?.success === false || payload?.ok === false) {
        throw new Error(getApiErrorMessage(payload, `HTTP ${response.status}`));
      }

      toast.success(t.saved);

      window.setTimeout(() => {
        window.location.href = "/system/treasury/accounts";
      }, 250);
    } catch (error) {
      console.error("Create treasury account error:", error);
      toast.error(error instanceof Error ? error.message : t.apiError);
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    const next = readLocale();
    applyDocumentLocale(next);
    setLocale(next);
  }, []);

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
                /system/treasury/accounts/create
              </Badge>
              <Badge className="rounded-full">{t.types[form.account_type]}</Badge>
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
              <Link href="/system/treasury/accounts">
                <ArrowLeft className="h-4 w-4" />
                {t.back}
              </Link>
            </Button>

            <Button className="h-10 rounded-xl" disabled={isSaving} onClick={submit}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
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
              <Input
                className="h-10 rounded-xl"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label>{t.fields.code}</Label>
              <Input
                className="h-10 rounded-xl"
                value={form.code}
                onChange={(event) => update("code", event.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label>{t.fields.type}</Label>
              <select
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                value={form.account_type}
                onChange={(event) =>
                  update("account_type", event.target.value as TreasuryAccountType)
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
                  update("status", event.target.value as TreasuryAccountStatus)
                }
              >
                {Object.entries(t.statuses).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>{t.fields.opening}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="h-10 rounded-xl"
                value={form.opening_balance}
                onChange={(event) => {
                  update("opening_balance", event.target.value);
                  update("current_balance", event.target.value);
                }}
                onBlur={() => {
                  const value = normalizeMoneyInput(form.opening_balance);
                  update("opening_balance", value);
                  update("current_balance", value);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>{t.fields.current}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="h-10 rounded-xl"
                value={form.current_balance}
                onChange={(event) => update("current_balance", event.target.value)}
                onBlur={() =>
                  update("current_balance", normalizeMoneyInput(form.current_balance))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t.fields.currency}</Label>
              <Input
                className="h-10 rounded-xl"
                value={form.currency}
                onChange={(event) =>
                  update("currency", normalizeCurrency(event.target.value))
                }
                maxLength={3}
              />
            </div>

            <label className="flex h-10 items-center gap-2 rounded-xl border px-3 text-sm">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(event) => update("is_default", event.target.checked)}
              />
              {t.fields.default}
            </label>

            {form.account_type === "BANK" ? (
              <>
                <div className="space-y-2">
                  <Label>{t.fields.bank}</Label>
                  <Input
                    className="h-10 rounded-xl"
                    value={form.bank_name}
                    onChange={(event) => update("bank_name", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t.fields.holder}</Label>
                  <Input
                    className="h-10 rounded-xl"
                    value={form.account_holder_name}
                    onChange={(event) =>
                      update("account_holder_name", event.target.value)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t.fields.number}</Label>
                  <Input
                    className="h-10 rounded-xl"
                    value={form.account_number}
                    onChange={(event) => update("account_number", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t.fields.iban}</Label>
                  <Input
                    className="h-10 rounded-xl"
                    value={form.iban}
                    onChange={(event) =>
                      update("iban", event.target.value.toUpperCase())
                    }
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>{t.fields.branch}</Label>
                  <Input
                    className="h-10 rounded-xl"
                    value={form.branch_name}
                    onChange={(event) => update("branch_name", event.target.value)}
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-2 md:col-span-2">
              <Label>{t.fields.description}</Label>
              <Input
                className="h-10 rounded-xl"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}