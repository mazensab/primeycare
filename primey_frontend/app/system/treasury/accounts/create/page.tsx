"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Building2,
  CheckCircle2,
  Landmark,
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

type TreasuryAccountType = "CASHBOX" | "BANK";
type TreasuryAccountStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "CLOSED";

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
};

type CreatedAccount = {
  id?: number | string;
  name?: string;
  code?: string;
  account_type?: string;
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

function getInitialAccountType(): TreasuryAccountType {
  try {
    if (typeof window === "undefined") return "CASHBOX";

    const params = new URLSearchParams(window.location.search);
    const accountType = params.get("account_type");

    if (accountType === "BANK") return "BANK";
    if (accountType === "CASHBOX") return "CASHBOX";

    return "CASHBOX";
  } catch (error) {
    console.error("Read account type query error:", error);
    return "CASHBOX";
  }
}

function normalizeMoney(value: string) {
  const parsed = Number(value || 0);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return "0.00";
  }

  return parsed.toFixed(2);
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

function normalizeCurrency(value: string) {
  return String(value || "SAR").trim().toUpperCase().slice(0, 3);
}

function generateCode(accountType: TreasuryAccountType) {
  const prefix = accountType === "BANK" ? "BNK" : "CSH";
  return `${prefix}-${Date.now()}`;
}

function cleanIban(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "إنشاء حساب خزينة" : "Create Treasury Account",
    cashboxTitle: ar ? "إنشاء صندوق نقدي" : "Create Cashbox",
    bankTitle: ar ? "إنشاء حساب بنكي" : "Create Bank Account",
    subtitle: ar
      ? "إضافة صندوق نقدي أو حساب بنكي وربطه بحركات الخزينة والمدفوعات."
      : "Create a cashbox or bank account linked to treasury movements and payments.",
    cashboxSubtitle: ar
      ? "الصندوق النقدي يستخدم للتحصيل النقدي والمدفوعات المباشرة."
      : "Cashbox is used for cash collection and direct receipts.",
    bankSubtitle: ar
      ? "الحساب البنكي يستخدم للتحويلات البنكية وتسويات بوابات الدفع."
      : "Bank account is used for bank transfers and payment gateway settlements.",
    badge: ar ? "حساب خزينة جديد" : "New Treasury Account",
    back: ar ? "حسابات الخزينة" : "Treasury Accounts",
    backCashboxes: ar ? "الصناديق" : "Cashboxes",
    backBanks: ar ? "الحسابات البنكية" : "Bank Accounts",
    save: ar ? "حفظ الحساب" : "Save Account",
    saving: ar ? "جاري الحفظ..." : "Saving...",
    saved: ar ? "تم إنشاء حساب الخزينة بنجاح." : "Treasury account created successfully.",
    apiError: ar ? "تعذر إنشاء حساب الخزينة." : "Unable to create treasury account.",
    required: ar ? "يرجى تعبئة الحقول المطلوبة." : "Please fill required fields.",
    invalidMoney: ar
      ? "الأرصدة يجب أن تكون أرقامًا صحيحة أو عشرية ولا تقل عن صفر."
      : "Balances must be valid numbers and cannot be negative.",
    invalidCurrency: ar ? "رمز العملة يجب أن يتكون من 3 أحرف." : "Currency code must be 3 letters.",
    bankRequired: ar ? "اسم البنك مطلوب عند إنشاء حساب بنكي." : "Bank name is required for bank accounts.",
    regenerate: ar ? "توليد كود" : "Generate Code",
    preview: ar ? "معاينة الحساب" : "Account Preview",
    accountData: ar ? "بيانات الحساب" : "Account Data",
    bankData: ar ? "البيانات البنكية" : "Bank Details",
    balanceData: ar ? "الأرصدة" : "Balances",
    optionalData: ar ? "بيانات إضافية" : "Additional Data",
    defaultHint: ar
      ? "عند جعل هذا الحساب افتراضيًا سيتم إلغاء الافتراضي من الحسابات الأخرى."
      : "When this account is default, other default accounts will be unset.",
    cashboxHint: ar
      ? "بيانات البنك لا تُحفظ للصناديق النقدية."
      : "Bank fields are not saved for cashboxes.",
    bankHint: ar
      ? "تأكد من إدخال اسم البنك، ويمكن إضافة IBAN ورقم الحساب حسب الحاجة."
      : "Make sure bank name is provided; IBAN and account number are optional.",
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
    placeholders: {
      name: ar ? "مثال: الصندوق الرئيسي" : "Example: Main Cashbox",
      bankName: ar ? "مثال: مصرف الراجحي" : "Example: Al Rajhi Bank",
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

export default function TreasuryAccountCreatePage() {
  const router = useRouter();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<FormData>({
    name: "",
    code: generateCode("CASHBOX"),
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
  const isBank = form.account_type === "BANK";

  const pageTitle = isBank ? t.bankTitle : t.cashboxTitle;
  const pageSubtitle = isBank ? t.bankSubtitle : t.cashboxSubtitle;
  const backHref = isBank ? "/system/treasury/banks" : "/system/treasury/cashboxes";
  const backLabel = isBank ? t.backBanks : t.backCashboxes;

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function validateForm() {
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

  function buildPayload() {
    const accountType = form.account_type;

    return {
      name: form.name.trim(),
      code: form.code.trim(),
      account_type: accountType,
      status: form.status,
      opening_balance: normalizeMoney(form.opening_balance),
      current_balance: normalizeMoney(form.current_balance || form.opening_balance),
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

  async function submit() {
    if (!validateForm()) return;

    try {
      setIsSaving(true);

      const payload = buildPayload();

      const response = await fetchJson<ApiEnvelope<CreatedAccount>>(
        "/api/treasury/accounts/",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      toast.success(response.message || t.saved);

      const createdId = response.data?.id;

      if (createdId) {
        router.push(`/system/treasury/accounts/${createdId}`);
      } else {
        router.push(
          payload.account_type === "BANK"
            ? "/system/treasury/banks"
            : "/system/treasury/cashboxes",
        );
      }

      router.refresh();
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

    const initialType = getInitialAccountType();

    setForm((current) => ({
      ...current,
      account_type: initialType,
      code:
        current.code && current.code !== "CSH-" && current.code !== "BNK-"
          ? current.code.startsWith("CSH-") || current.code.startsWith("BNK-")
            ? generateCode(initialType)
            : current.code
          : generateCode(initialType),
    }));

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

  const kpiCards = [
    {
      label: t.fields.type,
      value: t.types[form.account_type],
      icon: isBank ? Building2 : Wallet,
      currency: false,
    },
    {
      label: t.fields.status,
      value: t.statuses[form.status],
      icon: CheckCircle2,
      currency: false,
    },
    {
      label: t.fields.opening,
      value: money(form.opening_balance),
      icon: Banknote,
      currency: true,
    },
    {
      label: t.fields.current,
      value: money(form.current_balance || form.opening_balance),
      icon: ShieldCheck,
      currency: true,
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
                /system/treasury/accounts/create
              </Badge>
              <Badge className="rounded-full">{t.badge}</Badge>
              <Badge variant="outline" className="rounded-full">
                {t.types[form.account_type]}
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

            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/system/treasury/accounts">
                <Wallet className="h-4 w-4" />
                {t.back}
              </Link>
            </Button>

            <Button
              type="button"
              className="h-10 rounded-xl"
              disabled={isSaving}
              onClick={submit}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? t.saving : t.save}
            </Button>
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
                          {item.value}
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

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t.accountData}</CardTitle>
              <CardDescription>{t.subtitle}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.fields.name}</Label>
                <Input
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder={isBank ? t.bankTitle : t.placeholders.name}
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label>{t.fields.code}</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.code}
                    onChange={(event) => update("code", event.target.value)}
                    className="h-10 rounded-xl"
                    dir="ltr"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 shrink-0 rounded-xl"
                    onClick={() => update("code", generateCode(form.account_type))}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {t.regenerate}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t.fields.type}</Label>
                <select
                  value={form.account_type}
                  onChange={(event) => {
                    const nextType = event.target.value as TreasuryAccountType;

                    setForm((current) => ({
                      ...current,
                      account_type: nextType,
                      code: generateCode(nextType),
                      bank_name: nextType === "BANK" ? current.bank_name : "",
                      account_holder_name:
                        nextType === "BANK" ? current.account_holder_name : "",
                      account_number:
                        nextType === "BANK" ? current.account_number : "",
                      iban: nextType === "BANK" ? current.iban : "",
                      branch_name: nextType === "BANK" ? current.branch_name : "",
                    }));
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
                    onChange={(event) => {
                      const value = event.target.value;
                      update("opening_balance", value);

                      if (
                        !form.current_balance ||
                        form.current_balance === "0.00" ||
                        form.current_balance === form.opening_balance
                      ) {
                        update("current_balance", value);
                      }
                    }}
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
                    <p className="mt-1 font-semibold">
                      {form.name || pageTitle}
                    </p>
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
                  {money(form.current_balance || form.opening_balance)}
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t.fields.type}
                  </p>
                  <p className="mt-1 font-medium">{t.types[form.account_type]}</p>
                </div>

                <div className="rounded-2xl border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t.fields.status}
                  </p>
                  <p className="mt-1 font-medium">{t.statuses[form.status]}</p>
                </div>

                <div className="rounded-2xl border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t.fields.default}
                  </p>
                  <p className="mt-1 font-medium">
                    {form.is_default ? "Yes" : "No"}
                  </p>
                </div>
              </div>
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
                  onChange={(event) => update("bank_name", event.target.value)}
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
            <CardTitle className="text-base">{t.optionalData}</CardTitle>
            <CardDescription>
              {isBank ? t.bankHint : t.cashboxHint}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="space-y-2">
              <Label>{t.fields.description}</Label>
              <Input
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                placeholder={t.placeholders.description}
                className="h-10 rounded-xl"
              />
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                className="h-10 rounded-xl"
                disabled={isSaving}
                onClick={submit}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSaving ? t.saving : t.save}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}