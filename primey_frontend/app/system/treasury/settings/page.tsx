"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
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

type TreasurySettings = {
  defaultCurrency: string;
  defaultAccountType: "CASHBOX" | "BANK";
  allowNegativeBalance: boolean;
  requireTransactionReference: boolean;
  requireExternalReference: boolean;
  autoConfirmCashReceipts: boolean;
  autoConfirmBankDeposits: boolean;
  enableTransferReview: boolean;
  enableStatementDraftLines: boolean;
  enableCancelledLinesInReports: boolean;
  transactionPrefix: string;
  cashboxPrefix: string;
  bankPrefix: string;
  minimumTransferAmount: string;
  maximumTransferAmount: string;
  reportDefaultRange: "THIS_MONTH" | "TODAY" | "LAST_30" | "ALL";
  printCompanyHeader: boolean;
  showCurrencyIcon: boolean;
  notes: string;
};

const STORAGE_KEY = "primey-care-treasury-settings";
const CURRENCY_ICON_PATH = "/currency/sar.svg";

const DEFAULT_SETTINGS: TreasurySettings = {
  defaultCurrency: "SAR",
  defaultAccountType: "CASHBOX",
  allowNegativeBalance: false,
  requireTransactionReference: true,
  requireExternalReference: false,
  autoConfirmCashReceipts: false,
  autoConfirmBankDeposits: false,
  enableTransferReview: true,
  enableStatementDraftLines: true,
  enableCancelledLinesInReports: false,
  transactionPrefix: "TRX",
  cashboxPrefix: "CASH",
  bankPrefix: "BANK",
  minimumTransferAmount: "1.00",
  maximumTransferAmount: "0.00",
  reportDefaultRange: "THIS_MONTH",
  printCompanyHeader: true,
  showCurrencyIcon: true,
  notes: "",
};

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

function numeric(value: string | number | null | undefined): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: string | number | null | undefined): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric(value));
}

function normalizeCurrency(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return normalized.slice(0, 3) || "SAR";
}

function normalizePrefix(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 16);
}

function normalizeAmount(value: string): string {
  const clean = value.replace(/[^\d.]/g, "");
  const parts = clean.split(".");
  const normalized =
    parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : parts[0];

  return normalized;
}

function isTreasurySettings(value: unknown): value is Partial<TreasurySettings> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readStoredSettings(): TreasurySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw);

    if (!isTreasurySettings(parsed)) {
      return DEFAULT_SETTINGS;
    }

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      defaultCurrency:
        typeof parsed.defaultCurrency === "string"
          ? normalizeCurrency(parsed.defaultCurrency)
          : DEFAULT_SETTINGS.defaultCurrency,
      transactionPrefix:
        typeof parsed.transactionPrefix === "string"
          ? normalizePrefix(parsed.transactionPrefix)
          : DEFAULT_SETTINGS.transactionPrefix,
      cashboxPrefix:
        typeof parsed.cashboxPrefix === "string"
          ? normalizePrefix(parsed.cashboxPrefix)
          : DEFAULT_SETTINGS.cashboxPrefix,
      bankPrefix:
        typeof parsed.bankPrefix === "string"
          ? normalizePrefix(parsed.bankPrefix)
          : DEFAULT_SETTINGS.bankPrefix,
      minimumTransferAmount:
        typeof parsed.minimumTransferAmount === "string"
          ? normalizeAmount(parsed.minimumTransferAmount)
          : DEFAULT_SETTINGS.minimumTransferAmount,
      maximumTransferAmount:
        typeof parsed.maximumTransferAmount === "string"
          ? normalizeAmount(parsed.maximumTransferAmount)
          : DEFAULT_SETTINGS.maximumTransferAmount,
    };
  } catch (error) {
    console.error("Read treasury settings error:", error);
    return DEFAULT_SETTINGS;
  }
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "إعدادات الخزينة" : "Treasury Settings",
    subtitle: ar
      ? "ضبط إعدادات الصناديق والبنوك والحركات المالية والتقارير."
      : "Configure cashboxes, bank accounts, treasury transactions, and reports.",
    back: ar ? "الخزينة" : "Treasury",
    accounts: ar ? "حسابات الخزينة" : "Treasury Accounts",
    transactions: ar ? "الحركات المالية" : "Transactions",
    reports: ar ? "التقارير" : "Reports",
    save: ar ? "حفظ الإعدادات" : "Save Settings",
    reset: ar ? "استعادة الافتراضي" : "Reset Defaults",
    saving: ar ? "جاري الحفظ..." : "Saving...",
    saved: ar ? "تم حفظ إعدادات الخزينة" : "Treasury settings saved",
    resetDone: ar
      ? "تم استعادة الإعدادات الافتراضية"
      : "Default settings restored",
    saveError: ar ? "تعذر حفظ الإعدادات." : "Unable to save settings.",
    validationError: ar
      ? "راجع القيم المدخلة قبل الحفظ."
      : "Review entered values before saving.",
    localNotice: ar
      ? "هذه الإعدادات محفوظة محليًا مؤقتًا إلى حين ربط API إعدادات الخزينة."
      : "These settings are stored locally until the treasury settings API is connected.",
    generalSettings: ar ? "الإعدادات العامة" : "General Settings",
    transactionSettings: ar ? "إعدادات الحركات" : "Transaction Settings",
    numberingSettings: ar ? "إعدادات الترقيم" : "Numbering Settings",
    reportSettings: ar
      ? "إعدادات التقارير والطباعة"
      : "Reports & Printing Settings",
    securitySettings: ar
      ? "إعدادات الحماية والمراجعة"
      : "Security & Review Settings",
    notesSettings: ar ? "ملاحظات داخلية" : "Internal Notes",
    previewTitle: ar ? "معاينة الإعدادات" : "Settings Preview",
    previewDesc: ar
      ? "ملخص سريع لأهم إعدادات الخزينة الحالية."
      : "Quick summary of the current treasury settings.",
    fields: {
      defaultCurrency: ar ? "العملة الافتراضية" : "Default Currency",
      defaultAccountType: ar ? "نوع الحساب الافتراضي" : "Default Account Type",
      allowNegativeBalance: ar
        ? "السماح برصيد سالب"
        : "Allow Negative Balance",
      requireTransactionReference: ar
        ? "إلزام مرجع الحركة"
        : "Require Transaction Reference",
      requireExternalReference: ar
        ? "إلزام المرجع الخارجي"
        : "Require External Reference",
      autoConfirmCashReceipts: ar
        ? "تأكيد القبض النقدي تلقائيًا"
        : "Auto-confirm Cash Receipts",
      autoConfirmBankDeposits: ar
        ? "تأكيد الإيداعات البنكية تلقائيًا"
        : "Auto-confirm Bank Deposits",
      enableTransferReview: ar
        ? "مراجعة التحويلات قبل التأكيد"
        : "Review Transfers Before Confirmation",
      enableStatementDraftLines: ar
        ? "إظهار المسودات في كشف الحساب"
        : "Show Draft Lines in Statement",
      enableCancelledLinesInReports: ar
        ? "إظهار الملغاة في التقارير"
        : "Show Cancelled Lines in Reports",
      transactionPrefix: ar ? "بادئة رقم الحركة" : "Transaction Prefix",
      cashboxPrefix: ar ? "بادئة كود الصندوق" : "Cashbox Prefix",
      bankPrefix: ar ? "بادئة كود البنك" : "Bank Prefix",
      minimumTransferAmount: ar ? "أقل مبلغ تحويل" : "Minimum Transfer Amount",
      maximumTransferAmount: ar ? "أعلى مبلغ تحويل" : "Maximum Transfer Amount",
      reportDefaultRange: ar
        ? "الفترة الافتراضية للتقارير"
        : "Default Report Range",
      printCompanyHeader: ar
        ? "إظهار رأس الشركة في الطباعة"
        : "Show Company Header in Print",
      showCurrencyIcon: ar ? "إظهار رمز العملة" : "Show Currency Icon",
      notes: ar ? "ملاحظات" : "Notes",
    },
    types: {
      CASHBOX: ar ? "صندوق نقدي" : "Cashbox",
      BANK: ar ? "حساب بنكي" : "Bank Account",
    },
    ranges: {
      THIS_MONTH: ar ? "هذا الشهر" : "This Month",
      TODAY: ar ? "اليوم" : "Today",
      LAST_30: ar ? "آخر 30 يوم" : "Last 30 Days",
      ALL: ar ? "كل الفترة" : "All Time",
    },
    hints: {
      maxAmount: ar
        ? "ضع 0.00 إذا لم ترغب بتحديد حد أعلى."
        : "Use 0.00 when no maximum limit is required.",
      negativeBalance: ar
        ? "الأفضل إبقاؤه مغلقًا لحماية أرصدة الصناديق والبنوك."
        : "Recommended to keep disabled to protect cashbox and bank balances.",
      transferReview: ar
        ? "عند التفعيل تبقى التحويلات مسودة حتى يتم تأكيدها يدويًا."
        : "When enabled, transfers remain draft until manually confirmed.",
      currency: ar
        ? "رمز العملة الرسمي داخل النظام هو SAR."
        : "The official system currency code is SAR.",
      prefix: ar
        ? "استخدم حروف وأرقام فقط بدون مسافات."
        : "Use letters and numbers only without spaces.",
    },
    status: {
      enabled: ar ? "مفعل" : "Enabled",
      disabled: ar ? "معطل" : "Disabled",
      protected: ar ? "محمي" : "Protected",
      review: ar ? "مراجعة" : "Review",
      local: ar ? "محلي مؤقت" : "Temporary Local",
    },
  };
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border bg-muted/20 p-4 transition hover:bg-muted/40">
      <span>
        <span className="block text-sm font-medium">{title}</span>
        {description ? (
          <span className="mt-1 block text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>

      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function PreviewItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
}) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 font-semibold">{value}</p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export default function TreasurySettingsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [settings, setSettings] = useState<TreasurySettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const minimumTransferAmountValue = numeric(settings.minimumTransferAmount);
  const maximumTransferAmountValue = numeric(settings.maximumTransferAmount);
  const hasMaximumTransferLimit = maximumTransferAmountValue > 0;

  function update<K extends keyof TreasurySettings>(
    key: K,
    value: TreasurySettings[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function validateSettings() {
    if (!settings.defaultCurrency.trim()) {
      toast.error(t.validationError);
      return false;
    }

    if (!settings.transactionPrefix.trim()) {
      toast.error(t.validationError);
      return false;
    }

    if (!settings.cashboxPrefix.trim()) {
      toast.error(t.validationError);
      return false;
    }

    if (!settings.bankPrefix.trim()) {
      toast.error(t.validationError);
      return false;
    }

    if (minimumTransferAmountValue < 0 || maximumTransferAmountValue < 0) {
      toast.error(t.validationError);
      return false;
    }

    if (
      hasMaximumTransferLimit &&
      minimumTransferAmountValue > maximumTransferAmountValue
    ) {
      toast.error(t.validationError);
      return false;
    }

    return true;
  }

  async function saveSettings() {
    try {
      if (!validateSettings()) return;

      setIsSaving(true);

      const sanitizedSettings: TreasurySettings = {
        ...settings,
        defaultCurrency: normalizeCurrency(settings.defaultCurrency),
        transactionPrefix: normalizePrefix(settings.transactionPrefix),
        cashboxPrefix: normalizePrefix(settings.cashboxPrefix),
        bankPrefix: normalizePrefix(settings.bankPrefix),
        minimumTransferAmount:
          settings.minimumTransferAmount.trim() || DEFAULT_SETTINGS.minimumTransferAmount,
        maximumTransferAmount:
          settings.maximumTransferAmount.trim() || DEFAULT_SETTINGS.maximumTransferAmount,
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedSettings));

      await new Promise((resolve) => window.setTimeout(resolve, 350));

      setSettings(sanitizedSettings);
      toast.success(t.saved);
    } catch (error) {
      console.error("Save treasury settings error:", error);
      toast.error(t.saveError);
    } finally {
      setIsSaving(false);
    }
  }

  function resetSettings() {
    setSettings(DEFAULT_SETTINGS);

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
      toast.success(t.resetDone);
    } catch (error) {
      console.error("Reset treasury settings error:", error);
      toast.error(t.saveError);
    }
  }

  useEffect(() => {
    const syncLocale = () => {
      const next = readLocale();
      applyDocumentLocale(next);
      setLocale(next);
    };

    syncLocale();
    setSettings(readStoredSettings());

    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  return (
    <PermissionGuard
      permission={PERMISSIONS.TREASURY_EDIT}
      workspace="system"
      mode="fallback"
    >
      <div className="space-y-4" dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                /system/treasury/settings
              </Badge>
              <Badge className="rounded-full">{settings.defaultCurrency}</Badge>
              <Badge
                variant="outline"
                className="rounded-full border-amber-200 bg-amber-50 text-amber-700"
              >
                {t.status.local}
              </Badge>
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

            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/system/treasury/accounts">
                <Wallet className="h-4 w-4" />
                {t.accounts}
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/system/treasury/transactions">
                <CreditCard className="h-4 w-4" />
                {t.transactions}
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/system/treasury/reports">
                <FileText className="h-4 w-4" />
                {t.reports}
              </Link>
            </Button>

            <Button
              variant="outline"
              className="h-10 rounded-xl"
              disabled={isSaving}
              onClick={resetSettings}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.reset}
            </Button>

            <Button
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

        <Card className="rounded-2xl border border-amber-200 bg-amber-50/50 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Settings className="h-5 w-5 text-amber-700" />
            </div>

            <div>
              <p className="text-sm font-medium text-amber-900">{t.title}</p>
              <p className="mt-1 text-sm text-amber-800">{t.localNotice}</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4" />
                {t.generalSettings}
              </CardTitle>
              <CardDescription>{t.subtitle}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.fields.defaultCurrency}</Label>
                <div className="flex gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-background">
                    <Image
                      src={CURRENCY_ICON_PATH}
                      alt="SAR"
                      width={18}
                      height={18}
                    />
                  </div>
                  <Input
                    className="h-10 rounded-xl"
                    value={settings.defaultCurrency}
                    onChange={(event) =>
                      update("defaultCurrency", normalizeCurrency(event.target.value))
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.hints.currency}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t.fields.defaultAccountType}</Label>
                <select
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  value={settings.defaultAccountType}
                  onChange={(event) =>
                    update(
                      "defaultAccountType",
                      event.target
                        .value as TreasurySettings["defaultAccountType"],
                    )
                  }
                >
                  <option value="CASHBOX">{t.types.CASHBOX}</option>
                  <option value="BANK">{t.types.BANK}</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>{t.fields.minimumTransferAmount}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-10 rounded-xl"
                  value={settings.minimumTransferAmount}
                  onChange={(event) =>
                    update(
                      "minimumTransferAmount",
                      normalizeAmount(event.target.value),
                    )
                  }
                />
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {formatMoney(settings.minimumTransferAmount)} SAR
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t.fields.maximumTransferAmount}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-10 rounded-xl"
                  value={settings.maximumTransferAmount}
                  onChange={(event) =>
                    update(
                      "maximumTransferAmount",
                      normalizeAmount(event.target.value),
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">{t.hints.maxAmount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" />
                {t.securitySettings}
              </CardTitle>
              <CardDescription>{t.hints.negativeBalance}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <ToggleRow
                title={t.fields.allowNegativeBalance}
                description={t.hints.negativeBalance}
                checked={settings.allowNegativeBalance}
                onChange={(checked) => update("allowNegativeBalance", checked)}
              />

              <ToggleRow
                title={t.fields.enableTransferReview}
                description={t.hints.transferReview}
                checked={settings.enableTransferReview}
                onChange={(checked) => update("enableTransferReview", checked)}
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4" />
                {t.previewTitle}
              </CardTitle>
              <CardDescription>{t.previewDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-3">
              <PreviewItem
                label={t.fields.defaultAccountType}
                value={t.types[settings.defaultAccountType]}
                icon={settings.defaultAccountType === "BANK" ? Building2 : Banknote}
              />

              <PreviewItem
                label={t.fields.transactionPrefix}
                value={settings.transactionPrefix || "-"}
                icon={CreditCard}
              />

              <PreviewItem
                label={t.fields.reportDefaultRange}
                value={t.ranges[settings.reportDefaultRange]}
                icon={FileText}
              />

              <PreviewItem
                label={t.fields.enableTransferReview}
                value={
                  settings.enableTransferReview
                    ? t.status.enabled
                    : t.status.disabled
                }
                icon={ShieldCheck}
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" />
                {t.transactionSettings}
              </CardTitle>
              <CardDescription>{t.subtitle}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-3 md:grid-cols-2">
              <ToggleRow
                title={t.fields.requireTransactionReference}
                checked={settings.requireTransactionReference}
                onChange={(checked) =>
                  update("requireTransactionReference", checked)
                }
              />

              <ToggleRow
                title={t.fields.requireExternalReference}
                checked={settings.requireExternalReference}
                onChange={(checked) =>
                  update("requireExternalReference", checked)
                }
              />

              <ToggleRow
                title={t.fields.autoConfirmCashReceipts}
                checked={settings.autoConfirmCashReceipts}
                onChange={(checked) =>
                  update("autoConfirmCashReceipts", checked)
                }
              />

              <ToggleRow
                title={t.fields.autoConfirmBankDeposits}
                checked={settings.autoConfirmBankDeposits}
                onChange={(checked) =>
                  update("autoConfirmBankDeposits", checked)
                }
              />
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-4 w-4" />
              {t.numberingSettings}
            </CardTitle>
            <CardDescription>{t.hints.prefix}</CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>{t.fields.transactionPrefix}</Label>
              <Input
                className="h-10 rounded-xl"
                value={settings.transactionPrefix}
                onChange={(event) =>
                  update("transactionPrefix", normalizePrefix(event.target.value))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t.fields.cashboxPrefix}</Label>
              <Input
                className="h-10 rounded-xl"
                value={settings.cashboxPrefix}
                onChange={(event) =>
                  update("cashboxPrefix", normalizePrefix(event.target.value))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t.fields.bankPrefix}</Label>
              <Input
                className="h-10 rounded-xl"
                value={settings.bankPrefix}
                onChange={(event) =>
                  update("bankPrefix", normalizePrefix(event.target.value))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              {t.reportSettings}
            </CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label>{t.fields.reportDefaultRange}</Label>
              <select
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                value={settings.reportDefaultRange}
                onChange={(event) =>
                  update(
                    "reportDefaultRange",
                    event.target
                      .value as TreasurySettings["reportDefaultRange"],
                  )
                }
              >
                <option value="THIS_MONTH">{t.ranges.THIS_MONTH}</option>
                <option value="TODAY">{t.ranges.TODAY}</option>
                <option value="LAST_30">{t.ranges.LAST_30}</option>
                <option value="ALL">{t.ranges.ALL}</option>
              </select>
            </div>

            <ToggleRow
              title={t.fields.enableStatementDraftLines}
              checked={settings.enableStatementDraftLines}
              onChange={(checked) => update("enableStatementDraftLines", checked)}
            />

            <ToggleRow
              title={t.fields.enableCancelledLinesInReports}
              checked={settings.enableCancelledLinesInReports}
              onChange={(checked) =>
                update("enableCancelledLinesInReports", checked)
              }
            />

            <ToggleRow
              title={t.fields.printCompanyHeader}
              checked={settings.printCompanyHeader}
              onChange={(checked) => update("printCompanyHeader", checked)}
            />

            <ToggleRow
              title={t.fields.showCurrencyIcon}
              checked={settings.showCurrencyIcon}
              onChange={(checked) => update("showCurrencyIcon", checked)}
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              {t.notesSettings}
            </CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </CardHeader>

          <CardContent>
            <Label>{t.fields.notes}</Label>
            <textarea
              className="mt-2 min-h-28 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={settings.notes}
              onChange={(event) => update("notes", event.target.value)}
            />
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}