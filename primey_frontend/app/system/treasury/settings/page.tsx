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
  if (typeof window === "undefined") return "ar";

  const saved = window.localStorage.getItem("primey-locale");
  if (saved === "ar" || saved === "en") return saved;

  return document.documentElement.lang === "en" ? "en" : "ar";
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
    resetDone: ar ? "تم استعادة الإعدادات الافتراضية" : "Default settings restored",
    localNotice: ar
      ? "هذه الإعدادات محفوظة محليًا مؤقتًا إلى حين ربط API إعدادات الخزينة."
      : "These settings are stored locally until the treasury settings API is connected.",
    generalSettings: ar ? "الإعدادات العامة" : "General Settings",
    transactionSettings: ar ? "إعدادات الحركات" : "Transaction Settings",
    numberingSettings: ar ? "إعدادات الترقيم" : "Numbering Settings",
    reportSettings: ar ? "إعدادات التقارير والطباعة" : "Reports & Printing Settings",
    securitySettings: ar ? "إعدادات الحماية والمراجعة" : "Security & Review Settings",
    notesSettings: ar ? "ملاحظات داخلية" : "Internal Notes",
    fields: {
      defaultCurrency: ar ? "العملة الافتراضية" : "Default Currency",
      defaultAccountType: ar ? "نوع الحساب الافتراضي" : "Default Account Type",
      allowNegativeBalance: ar ? "السماح برصيد سالب" : "Allow Negative Balance",
      requireTransactionReference: ar ? "إلزام مرجع الحركة" : "Require Transaction Reference",
      requireExternalReference: ar ? "إلزام المرجع الخارجي" : "Require External Reference",
      autoConfirmCashReceipts: ar ? "تأكيد القبض النقدي تلقائيًا" : "Auto-confirm Cash Receipts",
      autoConfirmBankDeposits: ar ? "تأكيد الإيداعات البنكية تلقائيًا" : "Auto-confirm Bank Deposits",
      enableTransferReview: ar ? "مراجعة التحويلات قبل التأكيد" : "Review Transfers Before Confirmation",
      enableStatementDraftLines: ar ? "إظهار المسودات في كشف الحساب" : "Show Draft Lines in Statement",
      enableCancelledLinesInReports: ar ? "إظهار الملغاة في التقارير" : "Show Cancelled Lines in Reports",
      transactionPrefix: ar ? "بادئة رقم الحركة" : "Transaction Prefix",
      cashboxPrefix: ar ? "بادئة كود الصندوق" : "Cashbox Prefix",
      bankPrefix: ar ? "بادئة كود البنك" : "Bank Prefix",
      minimumTransferAmount: ar ? "أقل مبلغ تحويل" : "Minimum Transfer Amount",
      maximumTransferAmount: ar ? "أعلى مبلغ تحويل" : "Maximum Transfer Amount",
      reportDefaultRange: ar ? "الفترة الافتراضية للتقارير" : "Default Report Range",
      printCompanyHeader: ar ? "إظهار رأس الشركة في الطباعة" : "Show Company Header in Print",
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
    },
  };
}

function readStoredSettings(): TreasurySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw);

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
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

export default function TreasurySettingsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [settings, setSettings] = useState<TreasurySettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);

  function update<K extends keyof TreasurySettings>(
    key: K,
    value: TreasurySettings[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveSettings() {
    try {
      setIsSaving(true);

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

      await new Promise((resolve) => window.setTimeout(resolve, 350));

      toast.success(t.saved);
    } catch (error) {
      console.error(error);
      toast.error(locale === "ar" ? "تعذر حفظ الإعدادات." : "Unable to save settings.");
    } finally {
      setIsSaving(false);
    }
  }

  function resetSettings() {
    setSettings(DEFAULT_SETTINGS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    toast.success(t.resetDone);
  }

  useEffect(() => {
    const next = readLocale();
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    setLocale(next);
    setSettings(readStoredSettings());
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              /system/treasury/settings
            </Badge>
            <Badge className="rounded-full">
              {settings.defaultCurrency}
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
          <Link href="/system/treasury">
            <Button variant="outline" className="h-10 rounded-xl">
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </Button>
          </Link>

          <Link href="/system/treasury/accounts">
            <Button variant="outline" className="h-10 rounded-xl">
              <Wallet className="h-4 w-4" />
              {t.accounts}
            </Button>
          </Link>

          <Link href="/system/treasury/transactions">
            <Button variant="outline" className="h-10 rounded-xl">
              <CreditCard className="h-4 w-4" />
              {t.transactions}
            </Button>
          </Link>

          <Link href="/system/treasury/reports">
            <Button variant="outline" className="h-10 rounded-xl">
              <FileText className="h-4 w-4" />
              {t.reports}
            </Button>
          </Link>

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
                  <Image src="/currency/sar.svg" alt="SAR" width={18} height={18} />
                </div>
                <Input
                  className="h-10 rounded-xl"
                  value={settings.defaultCurrency}
                  onChange={(event) =>
                    update("defaultCurrency", event.target.value.toUpperCase())
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t.fields.defaultAccountType}</Label>
              <select
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                value={settings.defaultAccountType}
                onChange={(event) =>
                  update(
                    "defaultAccountType",
                    event.target.value as TreasurySettings["defaultAccountType"],
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
                onChange={(event) => update("minimumTransferAmount", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t.fields.maximumTransferAmount}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="h-10 rounded-xl"
                value={settings.maximumTransferAmount}
                onChange={(event) => update("maximumTransferAmount", event.target.value)}
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

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              {t.transactionSettings}
            </CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <ToggleRow
              title={t.fields.requireTransactionReference}
              checked={settings.requireTransactionReference}
              onChange={(checked) => update("requireTransactionReference", checked)}
            />

            <ToggleRow
              title={t.fields.requireExternalReference}
              checked={settings.requireExternalReference}
              onChange={(checked) => update("requireExternalReference", checked)}
            />

            <ToggleRow
              title={t.fields.autoConfirmCashReceipts}
              checked={settings.autoConfirmCashReceipts}
              onChange={(checked) => update("autoConfirmCashReceipts", checked)}
            />

            <ToggleRow
              title={t.fields.autoConfirmBankDeposits}
              checked={settings.autoConfirmBankDeposits}
              onChange={(checked) => update("autoConfirmBankDeposits", checked)}
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-4 w-4" />
              {t.numberingSettings}
            </CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>{t.fields.transactionPrefix}</Label>
              <Input
                className="h-10 rounded-xl"
                value={settings.transactionPrefix}
                onChange={(event) =>
                  update("transactionPrefix", event.target.value.toUpperCase())
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t.fields.cashboxPrefix}</Label>
              <Input
                className="h-10 rounded-xl"
                value={settings.cashboxPrefix}
                onChange={(event) =>
                  update("cashboxPrefix", event.target.value.toUpperCase())
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t.fields.bankPrefix}</Label>
              <Input
                className="h-10 rounded-xl"
                value={settings.bankPrefix}
                onChange={(event) =>
                  update("bankPrefix", event.target.value.toUpperCase())
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

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
                  event.target.value as TreasurySettings["reportDefaultRange"],
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
            onChange={(checked) => update("enableCancelledLinesInReports", checked)}
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
  );
}