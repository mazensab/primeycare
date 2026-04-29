"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Building2,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCcw,
  Save,
  Settings,
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

type TreasuryAccount = {
  id: number | string;
  name: string;
  code: string;
  account_type: string;
  account_type_label?: string;
  status: string;
  status_label?: string;
  current_balance: string;
  opening_balance?: string;
  currency: string;
  is_default?: boolean;
  bank_name?: string;
};

type TreasurySettings = {
  defaultCurrency: string;
  allowNegativeBalance: boolean;
  requireConfirmation: boolean;
  defaultCashboxId: string;
  defaultBankId: string;
  gatewaySettlementAccountId: string;
  autoPostPaymentToTreasury: boolean;
  autoCreateOpeningBalance: boolean;
};

const SAR_ICON = "/currency/sar.svg";
const STORAGE_KEY = "primey-treasury-settings";

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

function normalizeAccount(item: unknown): TreasuryAccount {
  const row = (item || {}) as Record<string, unknown>;

  return {
    id: (row.id as number | string | undefined) || "",
    name: String(row.name || ""),
    code: String(row.code || ""),
    account_type: String(row.account_type || ""),
    account_type_label: row.account_type_label
      ? String(row.account_type_label)
      : undefined,
    status: String(row.status || ""),
    status_label: row.status_label ? String(row.status_label) : undefined,
    current_balance: String(row.current_balance || "0.00"),
    opening_balance: row.opening_balance ? String(row.opening_balance) : "0.00",
    currency: String(row.currency || "SAR"),
    is_default: Boolean(row.is_default),
    bank_name: row.bank_name ? String(row.bank_name) : "",
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

function formatNumber(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function defaultSettings(): TreasurySettings {
  return {
    defaultCurrency: "SAR",
    allowNegativeBalance: false,
    requireConfirmation: true,
    defaultCashboxId: "",
    defaultBankId: "",
    gatewaySettlementAccountId: "",
    autoPostPaymentToTreasury: true,
    autoCreateOpeningBalance: false,
  };
}

function readStoredSettings(): TreasurySettings {
  try {
    if (typeof window === "undefined") return defaultSettings();

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();

    const parsed = JSON.parse(raw) as Partial<TreasurySettings>;

    return {
      ...defaultSettings(),
      ...parsed,
    };
  } catch (error) {
    console.error("Read treasury settings error:", error);
    return defaultSettings();
  }
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "إعدادات الخزينة" : "Treasury Settings",
    subtitle: ar
      ? "ضبط الإعدادات التشغيلية الافتراضية للخزينة وربط الحسابات المستخدمة في الكاش والبنوك والتسويات."
      : "Configure default treasury behavior and accounts used for cash, banks, and settlements.",
    badge: ar ? "إعدادات تشغيلية" : "Operational Settings",
    back: ar ? "الرجوع للخزينة" : "Back to Treasury",
    refresh: ar ? "تحديث الحسابات" : "Refresh Accounts",
    save: ar ? "حفظ الإعدادات" : "Save Settings",
    saving: ar ? "جاري الحفظ..." : "Saving...",
    saved: ar ? "تم حفظ إعدادات الخزينة محليًا." : "Treasury settings saved locally.",
    loaded: ar ? "تم تحديث بيانات الحسابات." : "Accounts data refreshed.",
    apiError: ar ? "تعذر تحميل حسابات الخزينة." : "Unable to load treasury accounts.",
    settingsNoteTitle: ar ? "ملاحظة مهمة" : "Important Note",
    settingsNote: ar
      ? "هذه الصفحة تضبط إعدادات الواجهة الحالية فقط. الربط المركزي للإعدادات يمكن إضافته لاحقًا عند بناء endpoint رسمي لإعدادات الخزينة."
      : "This page stores current UI settings only. Centralized settings can be added later with an official treasury settings endpoint.",
    activeAccounts: ar ? "الحسابات النشطة" : "Active Accounts",
    cashboxes: ar ? "الصناديق" : "Cashboxes",
    banks: ar ? "البنوك" : "Banks",
    defaultAccounts: ar ? "الحسابات الافتراضية" : "Default Accounts",
    behavior: ar ? "سلوك الخزينة" : "Treasury Behavior",
    overview: ar ? "ملخص الإعدادات" : "Settings Summary",
    accountPreview: ar ? "الحسابات المتاحة" : "Available Accounts",
    noAccounts: ar ? "لا توجد حسابات خزينة نشطة." : "No active treasury accounts.",
    loading: ar ? "جاري تحميل الإعدادات..." : "Loading settings...",
    fields: {
      defaultCurrency: ar ? "العملة الافتراضية" : "Default Currency",
      defaultCashbox: ar ? "الصندوق الافتراضي للكاش" : "Default Cashbox",
      defaultBank: ar ? "الحساب البنكي الافتراضي" : "Default Bank Account",
      gatewaySettlement: ar ? "حساب تسوية بوابات الدفع" : "Gateway Settlement Account",
      requireConfirmation: ar ? "اعتماد التأكيد قبل أثر الرصيد" : "Require confirmation before balance effect",
      allowNegative: ar ? "السماح بالرصيد السالب" : "Allow Negative Balance",
      autoPostPayment: ar ? "ترحيل المدفوعات المؤكدة للخزينة" : "Post confirmed payments to treasury",
      autoOpening: ar ? "إنشاء حركة رصيد افتتاحي تلقائيًا" : "Auto-create opening balance transaction",
    },
    descriptions: {
      requireConfirmation: ar
        ? "المسودة لا تؤثر على الرصيد حتى يتم تأكيدها."
        : "Drafts do not affect balance until confirmed.",
      allowNegative: ar
        ? "النظام الحالي في الباك إند يمنع الرصيد السالب لحماية الخزينة."
        : "Current backend logic prevents negative balances for treasury safety.",
      autoPostPayment: ar
        ? "المدفوعات المؤكدة مرتبطة بخدمة إنشاء حركة خزينة من الدفع."
        : "Confirmed payments are linked to payment treasury movement service.",
      autoOpening: ar
        ? "اختياري لاحقًا إذا أردنا توليد حركة افتتاحية عند إنشاء الحساب."
        : "Optional later if opening transactions are generated on account creation.",
    },
    select: {
      none: ar ? "غير محدد" : "Not selected",
      cashbox: ar ? "اختر صندوقًا" : "Select cashbox",
      bank: ar ? "اختر حسابًا بنكيًا" : "Select bank account",
      account: ar ? "اختر حسابًا" : "Select account",
    },
    table: {
      account: ar ? "الحساب" : "Account",
      type: ar ? "النوع" : "Type",
      status: ar ? "الحالة" : "Status",
      balance: ar ? "الرصيد" : "Balance",
      default: ar ? "افتراضي" : "Default",
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

function ToggleRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border p-4">
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? "bg-primary" : "bg-muted"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-background shadow transition ${
            checked ? "ltr:left-6 rtl:right-6" : "ltr:left-1 rtl:right-1"
          }`}
        />
      </button>
    </div>
  );
}

export default function TreasurySettingsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [settings, setSettings] = useState<TreasurySettings>(defaultSettings());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const activeAccounts = useMemo(
    () => accounts.filter((item) => item.status === "ACTIVE"),
    [accounts],
  );

  const cashboxes = useMemo(
    () => activeAccounts.filter((item) => item.account_type === "CASHBOX"),
    [activeAccounts],
  );

  const banks = useMemo(
    () => activeAccounts.filter((item) => item.account_type === "BANK"),
    [activeAccounts],
  );

  const selectedDefaultCashbox = useMemo(
    () => accounts.find((item) => String(item.id) === settings.defaultCashboxId),
    [accounts, settings.defaultCashboxId],
  );

  const selectedDefaultBank = useMemo(
    () => accounts.find((item) => String(item.id) === settings.defaultBankId),
    [accounts, settings.defaultBankId],
  );

  const selectedGatewayAccount = useMemo(
    () =>
      accounts.find(
        (item) => String(item.id) === settings.gatewaySettlementAccountId,
      ),
    [accounts, settings.gatewaySettlementAccountId],
  );

  const totalBalance = useMemo(() => {
    return activeAccounts.reduce(
      (sum, item) => sum + toNumber(item.current_balance),
      0,
    );
  }, [activeAccounts]);

  function update<K extends keyof TreasurySettings>(
    key: K,
    value: TreasurySettings[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function loadAccounts(showToast = false) {
    try {
      setIsLoading(true);

      const payload = await fetchJson<unknown>(
        "/api/treasury/accounts/?page_size=100",
      );

      const normalized = toArray<unknown>(payload).map(normalizeAccount);

      setAccounts(normalized);

      const stored = readStoredSettings();
      const defaultAccount = normalized.find((item) => item.is_default);
      const defaultCashbox = normalized.find(
        (item) => item.account_type === "CASHBOX" && item.status === "ACTIVE",
      );
      const defaultBank = normalized.find(
        (item) => item.account_type === "BANK" && item.status === "ACTIVE",
      );

      setSettings({
        ...stored,
        defaultCashboxId:
          stored.defaultCashboxId ||
          (defaultCashbox?.id ? String(defaultCashbox.id) : ""),
        defaultBankId:
          stored.defaultBankId ||
          (defaultBank?.id ? String(defaultBank.id) : ""),
        gatewaySettlementAccountId:
          stored.gatewaySettlementAccountId ||
          (defaultAccount?.id ? String(defaultAccount.id) : ""),
      });

      if (showToast) toast.success(t.loaded);
    } catch (error) {
      console.error("Treasury settings accounts load error:", error);
      setAccounts([]);
      setSettings(readStoredSettings());
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function saveSettings() {
    try {
      setIsSaving(true);

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

      toast.success(t.saved);
    } catch (error) {
      console.error("Save treasury settings error:", error);
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

  const kpiCards = [
    {
      label: t.activeAccounts,
      value: formatNumber(activeAccounts.length),
      icon: ShieldCheck,
      currency: false,
    },
    {
      label: t.cashboxes,
      value: formatNumber(cashboxes.length),
      icon: Wallet,
      currency: false,
    },
    {
      label: t.banks,
      value: formatNumber(banks.length),
      icon: Building2,
      currency: false,
    },
    {
      label: t.overview,
      value: money(totalBalance),
      icon: Banknote,
      currency: true,
    },
  ];

  return (
    <PermissionGuard
      anyPermissions={[PERMISSIONS.TREASURY_EDIT, PERMISSIONS.TREASURY_VIEW]}
      workspace="system"
      mode="fallback"
    >
      <div className="space-y-5" dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                /system/treasury/settings
              </Badge>
              <Badge className="rounded-full">{t.badge}</Badge>
            </div>

            <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
              {t.title}
            </h1>

            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {t.subtitle}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/system/treasury">
                <ArrowLeft className="h-4 w-4" />
                {t.back}
              </Link>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              disabled={isLoading}
              onClick={() => loadAccounts(true)}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              {t.refresh}
            </Button>

            <Button
              type="button"
              className="h-10 rounded-xl"
              disabled={isSaving}
              onClick={saveSettings}
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
                        <p className="text-2xl font-bold" dir="ltr">
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

        <Card>
          <CardContent className="flex gap-3 p-4">
            <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-muted">
              <Info className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold">{t.settingsNoteTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.settingsNote}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t.defaultAccounts}</CardTitle>
              <CardDescription>{t.subtitle}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.fields.defaultCurrency}</Label>
                <Input
                  value={settings.defaultCurrency}
                  onChange={(event) =>
                    update("defaultCurrency", event.target.value.toUpperCase())
                  }
                  className="h-10 rounded-xl"
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label>{t.fields.defaultCashbox}</Label>
                <select
                  value={settings.defaultCashboxId}
                  onChange={(event) =>
                    update("defaultCashboxId", event.target.value)
                  }
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                >
                  <option value="">{t.select.cashbox}</option>
                  {cashboxes.map((account) => (
                    <option key={account.id} value={String(account.id)}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>{t.fields.defaultBank}</Label>
                <select
                  value={settings.defaultBankId}
                  onChange={(event) =>
                    update("defaultBankId", event.target.value)
                  }
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                >
                  <option value="">{t.select.bank}</option>
                  {banks.map((account) => (
                    <option key={account.id} value={String(account.id)}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>{t.fields.gatewaySettlement}</Label>
                <select
                  value={settings.gatewaySettlementAccountId}
                  onChange={(event) =>
                    update("gatewaySettlementAccountId", event.target.value)
                  }
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                >
                  <option value="">{t.select.account}</option>
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={String(account.id)}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.overview}</CardTitle>
              <CardDescription>{t.defaultAccounts}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="rounded-2xl border p-3">
                <p className="text-xs text-muted-foreground">
                  {t.fields.defaultCashbox}
                </p>
                <p className="mt-1 font-medium">
                  {selectedDefaultCashbox?.name || t.select.none}
                </p>
                <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                  {selectedDefaultCashbox?.code || "-"}
                </p>
              </div>

              <div className="rounded-2xl border p-3">
                <p className="text-xs text-muted-foreground">
                  {t.fields.defaultBank}
                </p>
                <p className="mt-1 font-medium">
                  {selectedDefaultBank?.name || t.select.none}
                </p>
                <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                  {selectedDefaultBank?.code || "-"}
                </p>
              </div>

              <div className="rounded-2xl border p-3">
                <p className="text-xs text-muted-foreground">
                  {t.fields.gatewaySettlement}
                </p>
                <p className="mt-1 font-medium">
                  {selectedGatewayAccount?.name || t.select.none}
                </p>
                <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                  {selectedGatewayAccount?.code || "-"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.behavior}</CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </CardHeader>

          <CardContent className="grid gap-3 md:grid-cols-2">
            <ToggleRow
              title={t.fields.requireConfirmation}
              description={t.descriptions.requireConfirmation}
              checked={settings.requireConfirmation}
              onChange={(value) => update("requireConfirmation", value)}
            />

            <ToggleRow
              title={t.fields.autoPostPayment}
              description={t.descriptions.autoPostPayment}
              checked={settings.autoPostPaymentToTreasury}
              onChange={(value) => update("autoPostPaymentToTreasury", value)}
            />

            <ToggleRow
              title={t.fields.allowNegative}
              description={t.descriptions.allowNegative}
              checked={settings.allowNegativeBalance}
              disabled
              onChange={(value) => update("allowNegativeBalance", value)}
            />

            <ToggleRow
              title={t.fields.autoOpening}
              description={t.descriptions.autoOpening}
              checked={settings.autoCreateOpeningBalance}
              onChange={(value) => update("autoCreateOpeningBalance", value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.accountPreview}</CardTitle>
            <CardDescription>{t.activeAccounts}</CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex h-44 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.loading}
              </div>
            ) : activeAccounts.length ? (
              <div className="overflow-hidden rounded-2xl border">
                <div className="grid grid-cols-5 gap-3 border-b bg-muted/30 p-3 text-sm font-medium">
                  <div className="col-span-2">{t.table.account}</div>
                  <div>{t.table.type}</div>
                  <div>{t.table.status}</div>
                  <div>{t.table.balance}</div>
                </div>

                {activeAccounts.slice(0, 12).map((account) => (
                  <Link
                    key={account.id}
                    href={`/system/treasury/accounts/${account.id}`}
                    className="grid grid-cols-5 gap-3 border-b p-3 text-sm transition last:border-b-0 hover:bg-muted/30"
                  >
                    <div className="col-span-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{account.name}</p>
                        {account.is_default ? (
                          <Badge className="rounded-full">
                            {t.table.default}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                        {account.code}
                      </p>
                    </div>

                    <div>
                      {account.account_type_label || account.account_type}
                    </div>

                    <div>
                      <Badge variant="outline" className="rounded-full">
                        {account.status_label || account.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 font-semibold" dir="ltr">
                      <Image src={SAR_ICON} alt="SAR" width={16} height={16} />
                      {money(account.current_balance)}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex h-44 items-center justify-center rounded-2xl border text-sm text-muted-foreground">
                {t.noAccounts}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}