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

type TreasuryAccount = {
  id: number | string;
  name: string;
  code: string;
  account_type: string;
  account_type_label?: string;
  status: string;
  current_balance: string;
  currency: string;
};

type TreasuryTransaction = {
  id: number | string;
  transaction_number: string;
  transaction_type: string;
  transaction_type_label?: string;
  status: string;
  amount: string;
  currency: string;
  transaction_date: string;
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
  if (Array.isArray(data?.data) && data.data.every(Boolean)) return data.data;
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

  return [];
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
    current_balance: String(row.current_balance || "0.00"),
    currency: String(row.currency || "SAR"),
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
    amount: String(row.amount || "0.00"),
    currency: String(row.currency || "SAR"),
    transaction_date: String(row.transaction_date || ""),
  };
}

function money(value: string | number) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

function formatNumber(value: string | number) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(number) ? number : 0);
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "الخزينة" : "Treasury",
    subtitle: ar
      ? "إدارة الصناديق والبنوك والحركات المالية وكشوف الحساب."
      : "Manage cashboxes, bank accounts, treasury transactions, and statements.",
    live: ar ? "بيانات حقيقية" : "Live Data",
    refresh: ar ? "تحديث" : "Refresh",
    createAccount: ar ? "إنشاء حساب خزينة" : "Create Treasury Account",
    createTransaction: ar ? "إضافة حركة مالية" : "Create Transaction",
    totalBalance: ar ? "إجمالي الأرصدة" : "Total Balance",
    activeAccounts: ar ? "الحسابات النشطة" : "Active Accounts",
    transactions: ar ? "الحركات المالية" : "Transactions",
    confirmed: ar ? "المؤكدة" : "Confirmed",
    quickLinks: ar ? "روابط سريعة" : "Quick Links",
    latest: ar ? "آخر الحركات" : "Latest Transactions",
    noData: ar ? "لا توجد بيانات." : "No data.",
    loading: ar ? "جاري تحميل بيانات الخزينة..." : "Loading treasury data...",
    apiError: ar ? "تعذر تحميل بيانات الخزينة." : "Unable to load treasury data.",
    refreshed: ar ? "تم تحديث بيانات الخزينة" : "Treasury data refreshed",
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

export default function TreasuryOverviewPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const stats = useMemo(() => {
    const totalBalance = accounts.reduce(
      (sum, item) => sum + Number(item.current_balance || 0),
      0,
    );

    const activeAccounts = accounts.filter(
      (item) => item.status === "ACTIVE",
    ).length;

    const confirmed = transactions.filter(
      (item) => item.status === "CONFIRMED",
    ).length;

    return {
      totalBalance,
      activeAccounts,
      transactions: transactions.length,
      confirmed,
    };
  }, [accounts, transactions]);

  async function loadData(showToast = false) {
    try {
      setIsLoading(true);

      const [accountsRes, txRes] = await Promise.all([
        fetch("/api/treasury/accounts/?page_size=100", {
          credentials: "include",
          headers: { Accept: "application/json" },
          cache: "no-store",
        }),
        fetch("/api/treasury/transactions/?page_size=8", {
          credentials: "include",
          headers: { Accept: "application/json" },
          cache: "no-store",
        }),
      ]);

      if (!accountsRes.ok || !txRes.ok) {
        throw new Error("Treasury API error");
      }

      const accountsPayload = await accountsRes.json();
      const txPayload = await txRes.json();

      setAccounts(toArray(accountsPayload).map(normalizeTreasuryAccount));
      setTransactions(toArray(txPayload).map(normalizeTreasuryTransaction));

      if (showToast) toast.success(t.refreshed);
    } catch (error) {
      console.error("Treasury overview load error:", error);
      toast.error(t.apiError);
      setAccounts([]);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const next = readLocale();
    applyDocumentLocale(next);
    setLocale(next);
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

  return (
    <PermissionGuard
      permission={PERMISSIONS.TREASURY_VIEW}
      workspace="system"
      mode="fallback"
    >
      <div className="space-y-4" dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                /system/treasury
              </Badge>
              <Badge className="rounded-full">{t.live}</Badge>
            </div>

            <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
              {t.title}
            </h1>
            <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
              {t.subtitle}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
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
          {[
            {
              label: t.totalBalance,
              value: money(stats.totalBalance),
              icon: Wallet,
              currency: true,
            },
            {
              label: t.activeAccounts,
              value: formatNumber(stats.activeAccounts),
              icon: ShieldCheck,
            },
            {
              label: t.transactions,
              value: formatNumber(stats.transactions),
              icon: CreditCard,
            },
            {
              label: t.confirmed,
              value: formatNumber(stats.confirmed),
              icon: FileBarChart,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <Card
                key={item.label}
                className="rounded-2xl border bg-card shadow-sm"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {item.currency ? (
                          <Image
                            src="/currency/sar.svg"
                            alt="SAR"
                            width={18}
                            height={18}
                          />
                        ) : null}
                        <p className="text-2xl font-bold">
                          {isLoading ? "..." : item.value}
                        </p>
                      </div>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {item.label}
                      </p>
                    </div>

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-1">
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

          <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t.latest}</CardTitle>
              <CardDescription>{t.links.transactions}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.loading}
                </div>
              ) : transactions.length ? (
                transactions.slice(0, 8).map((item) => (
                  <Button
                    key={item.id}
                    asChild
                    variant="ghost"
                    className="h-auto w-full rounded-xl border p-0 hover:bg-muted/40"
                  >
                    <Link
                      href={`/system/treasury/transactions/${item.id}`}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <div className={isArabic ? "text-right" : "text-left"}>
                        <p className="font-medium">{item.transaction_number}</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {item.transaction_type_label ||
                            item.transaction_type ||
                            "-"}{" "}
                          · {item.transaction_date || "-"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 font-semibold" dir="ltr">
                        <Image
                          src="/currency/sar.svg"
                          alt="SAR"
                          width={16}
                          height={16}
                        />
                        {money(item.amount)}
                      </div>
                    </Link>
                  </Button>
                ))
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  {t.noData}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PermissionGuard>
  );
}