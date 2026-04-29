"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Banknote,
  Building2,
  CreditCard,
  FileBarChart,
  Loader2,
  PlusCircle,
  RefreshCcw,
  Settings,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
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

type PaginatedPayload<T> = {
  items?: T[];
  pagination?: {
    page?: number;
    page_size?: number;
    total_pages?: number;
    total_items?: number;
    has_next?: boolean;
    has_previous?: boolean;
  };
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
  currency: string;
  is_default?: boolean;
};

type TreasuryTransaction = {
  id: number | string;
  transaction_number: string;
  transaction_type: string;
  transaction_type_label?: string;
  status: string;
  status_label?: string;
  amount: string;
  currency: string;
  transaction_date: string;
};

type TreasurySummary = {
  totalAccounts: number;
  activeAccounts: number;
  cashboxAccounts: number;
  bankAccounts: number;
  totalBalance: number;
  totalTransactions: number;
  confirmedTransactions: number;
  incomeTotal: number;
  expenseTotal: number;
  transferTotal: number;
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

function getPayloadSummary(payload: unknown): Record<string, unknown> {
  const envelope = payload as ApiEnvelope<PaginatedPayload<unknown>>;
  const direct = payload as PaginatedPayload<unknown>;

  if (
    envelope?.data &&
    typeof envelope.data === "object" &&
    !Array.isArray(envelope.data) &&
    (envelope.data as PaginatedPayload<unknown>).summary
  ) {
    return (envelope.data as PaginatedPayload<unknown>).summary || {};
  }

  return direct.summary || {};
}

function normalizeTreasuryAccount(item: unknown): TreasuryAccount {
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
    currency: String(row.currency || "SAR"),
    is_default: Boolean(row.is_default),
  };
}

function normalizeTreasuryTransaction(item: unknown): TreasuryTransaction {
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
    amount: String(row.amount || "0.00"),
    currency: String(row.currency || "SAR"),
    transaction_date: String(row.transaction_date || ""),
  };
}

function toNumber(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: string | number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatNumber(value: string | number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatDate(value: string, locale: AppLocale) {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  })
    .format(parsed)
    .replace(/[٠-٩]/g, (digit) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
    );
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "الخزينة" : "Treasury",
    subtitle: ar
      ? "إدارة الصناديق والحسابات البنكية والحركات المالية والتحويلات وكشوف الحساب."
      : "Manage cashboxes, bank accounts, treasury transactions, transfers, and statements.",
    live: ar ? "بيانات حقيقية" : "Live Data",
    apiReady: ar ? "متصل بـ Treasury API" : "Connected to Treasury API",
    refresh: ar ? "تحديث" : "Refresh",
    createAccount: ar ? "إنشاء حساب خزينة" : "Create Treasury Account",
    createTransaction: ar ? "إضافة حركة مالية" : "Create Transaction",
    totalBalance: ar ? "إجمالي الأرصدة" : "Total Balance",
    activeAccounts: ar ? "الحسابات النشطة" : "Active Accounts",
    cashboxes: ar ? "الصناديق" : "Cashboxes",
    banks: ar ? "البنوك" : "Banks",
    transactions: ar ? "الحركات المالية" : "Transactions",
    confirmed: ar ? "الحركات المؤكدة" : "Confirmed Transactions",
    income: ar ? "إجمالي الوارد" : "Total Inflow",
    expense: ar ? "إجمالي الصادر" : "Total Outflow",
    transfers: ar ? "إجمالي التحويلات" : "Total Transfers",
    quickLinks: ar ? "روابط سريعة" : "Quick Links",
    latest: ar ? "آخر الحركات" : "Latest Transactions",
    accountsPreview: ar ? "أهم حسابات الخزينة" : "Treasury Accounts Preview",
    noData: ar ? "لا توجد بيانات." : "No data.",
    loading: ar ? "جاري تحميل بيانات الخزينة..." : "Loading treasury data...",
    apiError: ar ? "تعذر تحميل بيانات الخزينة." : "Unable to load treasury data.",
    refreshed: ar ? "تم تحديث بيانات الخزينة" : "Treasury data refreshed",
    viewAll: ar ? "عرض الكل" : "View all",
    defaultAccount: ar ? "افتراضي" : "Default",
    links: {
      accounts: ar ? "حسابات الخزينة" : "Treasury Accounts",
      cashboxes: ar ? "الصناديق النقدية" : "Cashboxes",
      banks: ar ? "الحسابات البنكية" : "Bank Accounts",
      transactions: ar ? "الحركات المالية" : "Transactions",
      transfers: ar ? "التحويلات" : "Transfers",
      reports: ar ? "تقارير الخزينة" : "Reports",
      settings: ar ? "إعدادات الخزينة" : "Settings",
    },
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      "X-Primey-Client": "primey-frontend",
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || "Treasury API error");
  }

  return payload as T;
}

export default function TreasuryOverviewPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [accountSummary, setAccountSummary] = useState<Record<string, unknown>>({});
  const [transactionSummary, setTransactionSummary] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const stats = useMemo<TreasurySummary>(() => {
    const fallbackTotalBalance = accounts.reduce(
      (sum, item) => sum + toNumber(item.current_balance),
      0,
    );

    const fallbackActiveAccounts = accounts.filter(
      (item) => item.status === "ACTIVE",
    ).length;

    const fallbackCashboxes = accounts.filter(
      (item) => item.account_type === "CASHBOX",
    ).length;

    const fallbackBanks = accounts.filter(
      (item) => item.account_type === "BANK",
    ).length;

    const fallbackConfirmed = transactions.filter(
      (item) => item.status === "CONFIRMED",
    ).length;

    return {
      totalAccounts: toNumber(accountSummary.total_accounts || accounts.length),
      activeAccounts: toNumber(
        accountSummary.active_accounts || fallbackActiveAccounts,
      ),
      cashboxAccounts: toNumber(
        accountSummary.cashbox_accounts || fallbackCashboxes,
      ),
      bankAccounts: toNumber(accountSummary.bank_accounts || fallbackBanks),
      totalBalance: toNumber(
        accountSummary.total_current_balance || fallbackTotalBalance,
      ),
      totalTransactions: toNumber(
        transactionSummary.total_transactions || transactions.length,
      ),
      confirmedTransactions: toNumber(
        transactionSummary.confirmed_transactions || fallbackConfirmed,
      ),
      incomeTotal: toNumber(transactionSummary.income_total),
      expenseTotal: toNumber(transactionSummary.expense_total),
      transferTotal: toNumber(transactionSummary.transfer_total),
    };
  }, [accounts, transactions, accountSummary, transactionSummary]);

  async function loadData(showToast = false) {
    try {
      setIsLoading(true);

      const [accountsPayload, transactionsPayload] = await Promise.all([
        fetchJson<unknown>("/api/treasury/accounts/?page_size=100"),
        fetchJson<unknown>("/api/treasury/transactions/?page_size=8"),
      ]);

      setAccounts(
        toArray<unknown>(accountsPayload).map(normalizeTreasuryAccount),
      );
      setTransactions(
        toArray<unknown>(transactionsPayload).map(normalizeTreasuryTransaction),
      );
      setAccountSummary(getPayloadSummary(accountsPayload));
      setTransactionSummary(getPayloadSummary(transactionsPayload));

      if (showToast) toast.success(t.refreshed);
    } catch (error) {
      console.error("Treasury overview load error:", error);
      toast.error(t.apiError);
      setAccounts([]);
      setTransactions([]);
      setAccountSummary({});
      setTransactionSummary({});
    } finally {
      setIsLoading(false);
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
    loadData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const quickLinks = [
    {
      title: t.links.accounts,
      href: "/system/treasury/accounts",
      icon: Wallet,
      permission: PERMISSIONS.TREASURY_VIEW,
    },
    {
      title: t.links.cashboxes,
      href: "/system/treasury/cashboxes",
      icon: Banknote,
      permission: PERMISSIONS.TREASURY_VIEW,
    },
    {
      title: t.links.banks,
      href: "/system/treasury/banks",
      icon: Building2,
      permission: PERMISSIONS.TREASURY_VIEW,
    },
    {
      title: t.links.transactions,
      href: "/system/treasury/transactions",
      icon: CreditCard,
      permission: PERMISSIONS.TREASURY_VIEW,
    },
    {
      title: t.links.transfers,
      href: "/system/treasury/transfers",
      icon: ArrowLeftRight,
      permission: PERMISSIONS.TREASURY_VIEW,
    },
    {
      title: t.links.reports,
      href: "/system/treasury/reports",
      icon: FileBarChart,
      anyPermissions: [PERMISSIONS.TREASURY_VIEW, PERMISSIONS.REPORTS_VIEW],
    },
    {
      title: t.links.settings,
      href: "/system/treasury/settings",
      icon: Settings,
      anyPermissions: [PERMISSIONS.TREASURY_EDIT, PERMISSIONS.SYSTEM_SETTINGS],
    },
  ];

  const kpiCards = [
    {
      label: t.totalBalance,
      value: money(stats.totalBalance),
      icon: Wallet,
      currency: true,
      href: "/system/treasury/accounts",
    },
    {
      label: t.activeAccounts,
      value: formatNumber(stats.activeAccounts),
      icon: ShieldCheck,
      href: "/system/treasury/accounts?status=ACTIVE",
    },
    {
      label: t.cashboxes,
      value: formatNumber(stats.cashboxAccounts),
      icon: Banknote,
      href: "/system/treasury/cashboxes",
    },
    {
      label: t.banks,
      value: formatNumber(stats.bankAccounts),
      icon: Building2,
      href: "/system/treasury/banks",
    },
    {
      label: t.confirmed,
      value: formatNumber(stats.confirmedTransactions),
      icon: CreditCard,
      href: "/system/treasury/transactions?status=CONFIRMED",
    },
    {
      label: t.income,
      value: money(stats.incomeTotal),
      icon: TrendingUp,
      currency: true,
      href: "/system/treasury/transactions?transaction_type=INCOME",
    },
    {
      label: t.expense,
      value: money(stats.expenseTotal),
      icon: TrendingDown,
      currency: true,
      href: "/system/treasury/transactions?transaction_type=EXPENSE",
    },
    {
      label: t.transfers,
      value: money(stats.transferTotal),
      icon: ArrowLeftRight,
      currency: true,
      href: "/system/treasury/transfers",
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
                /system/treasury
              </Badge>
              <Badge className="rounded-full">{t.live}</Badge>
              <Badge variant="outline" className="rounded-full">
                {t.apiReady}
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
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              disabled={isLoading}
              onClick={() => loadData(true)}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              {t.refresh}
            </Button>

            <Can permission={PERMISSIONS.TREASURY_CREATE}>
              <Button
                asChild
                variant="outline"
                className="h-10 w-full rounded-xl sm:w-auto"
              >
                <Link href="/system/treasury/transactions/create">
                  <PlusCircle className="h-4 w-4" />
                  {t.createTransaction}
                </Link>
              </Button>
            </Can>

            <Can permission={PERMISSIONS.TREASURY_CREATE}>
              <Button asChild className="h-10 w-full rounded-xl sm:w-auto">
                <Link href="/system/treasury/accounts/create">
                  <PlusCircle className="h-4 w-4" />
                  {t.createAccount}
                </Link>
              </Button>
            </Can>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.label} className="overflow-hidden">
                <CardContent className="p-4">
                  <Link href={item.href} className="block">
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
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">{t.quickLinks}</CardTitle>
              <CardDescription>{t.subtitle}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-2">
              {quickLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <Can
                    key={item.href}
                    permission={item.permission}
                    anyPermissions={item.anyPermissions}
                  >
                    <Button
                      asChild
                      variant="outline"
                      className="h-11 w-full justify-between rounded-xl"
                    >
                      <Link href={item.href}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {item.title}
                        </span>
                        <span>{isArabic ? "←" : "→"}</span>
                      </Link>
                    </Button>
                  </Can>
                );
              })}
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">{t.latest}</CardTitle>
                <CardDescription>{t.links.transactions}</CardDescription>
              </div>

              <Button asChild variant="outline" className="h-9 rounded-xl">
                <Link href="/system/treasury/transactions">{t.viewAll}</Link>
              </Button>
            </CardHeader>

            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.loading}
                </div>
              ) : transactions.length ? (
                transactions.slice(0, 8).map((item) => (
                  <Link
                    key={item.id}
                    href={`/system/treasury/transactions/${item.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border p-3 transition hover:bg-muted/40"
                  >
                    <div className={isArabic ? "text-right" : "text-left"}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {item.transaction_number}
                        </p>
                        <Badge variant="outline" className="rounded-full">
                          {item.status_label || item.status || "-"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.transaction_type_label ||
                          item.transaction_type ||
                          "-"}{" "}
                        · {formatDate(item.transaction_date, locale)}
                      </p>
                    </div>

                    <div
                      className="flex shrink-0 items-center gap-2 font-semibold"
                      dir="ltr"
                    >
                      <Image
                        src={SAR_ICON}
                        alt="SAR"
                        width={16}
                        height={16}
                      />
                      {money(item.amount)}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  {t.noData}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{t.accountsPreview}</CardTitle>
              <CardDescription>{t.links.accounts}</CardDescription>
            </div>

            <Button asChild variant="outline" className="h-9 rounded-xl">
              <Link href="/system/treasury/accounts">{t.viewAll}</Link>
            </Button>
          </CardHeader>

          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.loading}
              </div>
            ) : accounts.length ? (
              accounts.slice(0, 6).map((account) => (
                <Link
                  key={account.id}
                  href={`/system/treasury/accounts/${account.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border p-3 transition hover:bg-muted/40"
                >
                  <div className={isArabic ? "text-right" : "text-left"}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{account.name}</p>
                      <Badge variant="outline" className="rounded-full">
                        {account.account_type_label ||
                          account.account_type ||
                          "-"}
                      </Badge>
                      {account.is_default ? (
                        <Badge className="rounded-full">
                          {t.defaultAccount}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                      {account.code} · {account.status_label || account.status}
                    </p>
                  </div>

                  <div
                    className="flex shrink-0 items-center gap-2 font-semibold"
                    dir="ltr"
                  >
                    <Image src={SAR_ICON} alt="SAR" width={16} height={16} />
                    {money(account.current_balance)}
                  </div>
                </Link>
              ))
            ) : (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                {t.noData}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}