"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  Banknote,
  Building2,
  CalendarDays,
  Download,
  FileBarChart,
  Loader2,
  Printer,
  RefreshCcw,
  Search,
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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERMISSIONS } from "@/lib/permissions";

type AppLocale = "ar" | "en";

type AccountTypeFilter = "ALL" | "CASHBOX" | "BANK";
type StatusFilter = "ALL" | "DRAFT" | "CONFIRMED" | "CANCELLED";
type RangePreset = "THIS_MONTH" | "TODAY" | "LAST_30" | "ALL";

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
  opening_balance: string;
  current_balance: string;
  currency: string;
  bank_name?: string;
  is_default?: boolean;
};

type TreasuryTransaction = {
  id: number | string;
  transaction_number: string;
  transaction_type: string;
  transaction_type_label?: string;
  status: string;
  status_label?: string;
  transaction_date: string;
  amount: string;
  currency: string;
  treasury_account_id?: number | string | null;
  destination_account_id?: number | string | null;
  treasury_account?: {
    id?: number | string;
    name?: string;
    code?: string;
    account_type?: string;
  } | null;
  destination_account?: {
    id?: number | string;
    name?: string;
    code?: string;
  } | null;
  reference?: string;
  external_reference?: string;
  description?: string;
};

type ReportLine = {
  id: string;
  account_id: number | string;
  account_name: string;
  account_code: string;
  account_type: string;
  account_type_label: string;
  opening_balance: number;
  current_balance: number;
  inflow: number;
  outflow: number;
  net_movement: number;
  transactions_count: number;
  confirmed_count: number;
  draft_count: number;
  cancelled_count: number;
  transfer_count: number;
  currency: string;
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
    opening_balance: String(row.opening_balance || "0.00"),
    current_balance: String(row.current_balance || "0.00"),
    currency: String(row.currency || "SAR"),
    bank_name: row.bank_name ? String(row.bank_name) : "",
    is_default: Boolean(row.is_default),
  };
}

function normalizeTransaction(item: unknown): TreasuryTransaction {
  const row = (item || {}) as Record<string, unknown>;

  return {
    id: (row.id as number | string | undefined) || "",
    transaction_number: String(row.transaction_number || ""),
    transaction_type: String(row.transaction_type || ""),
    transaction_type_label: row.transaction_type_label
      ? String(row.transaction_type_label)
      : undefined,
    status: String(row.status || ""),
    status_label: row.status_label ? String(row.status_label) : undefined,
    transaction_date: String(row.transaction_date || ""),
    amount: String(row.amount || "0.00"),
    currency: String(row.currency || "SAR"),
    treasury_account_id: row.treasury_account_id as number | string | null | undefined,
    destination_account_id: row.destination_account_id as number | string | null | undefined,
    treasury_account:
      row.treasury_account && typeof row.treasury_account === "object"
        ? (row.treasury_account as TreasuryTransaction["treasury_account"])
        : null,
    destination_account:
      row.destination_account && typeof row.destination_account === "object"
        ? (row.destination_account as TreasuryTransaction["destination_account"])
        : null,
    reference: row.reference ? String(row.reference) : "",
    external_reference: row.external_reference
      ? String(row.external_reference)
      : "",
    description: row.description ? String(row.description) : "",
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function last30Days() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

function getPresetRange(preset: RangePreset) {
  if (preset === "TODAY") {
    return { from: today(), to: today() };
  }

  if (preset === "LAST_30") {
    return { from: last30Days(), to: today() };
  }

  if (preset === "ALL") {
    return { from: "", to: "" };
  }

  return { from: firstDayOfMonth(), to: today() };
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "تقارير الخزينة" : "Treasury Reports",
    subtitle: ar
      ? "تحليل أرصدة الصناديق والبنوك وحركة القبض والصرف والتحويلات حسب الفترة."
      : "Analyze cashbox and bank balances, inflows, outflows, and transfers by period.",
    badge: ar ? "تقارير تشغيلية" : "Operational Reports",
    back: ar ? "الرجوع للخزينة" : "Back to Treasury",
    refresh: ar ? "تحديث" : "Refresh",
    export: ar ? "تصدير Excel" : "Export Excel",
    print: ar ? "طباعة Web PDF" : "Web PDF Print",
    search: ar ? "بحث باسم الحساب أو الكود" : "Search by account name or code",
    loading: ar ? "جاري تحميل تقارير الخزينة..." : "Loading treasury reports...",
    noData: ar ? "لا توجد بيانات مطابقة." : "No matching data.",
    apiError: ar ? "تعذر تحميل تقارير الخزينة." : "Unable to load treasury reports.",
    refreshed: ar ? "تم تحديث تقارير الخزينة." : "Treasury reports refreshed.",
    exported: ar ? "تم تصدير تقرير الخزينة." : "Treasury report exported.",
    reportTitle: ar ? "تقرير أرصدة وحركات الخزينة" : "Treasury Balances & Movement Report",
    filters: ar ? "الفلاتر" : "Filters",
    accountType: ar ? "نوع الحساب" : "Account Type",
    status: ar ? "حالة الحركة" : "Transaction Status",
    range: ar ? "الفترة" : "Range",
    dateFrom: ar ? "من تاريخ" : "Date From",
    dateTo: ar ? "إلى تاريخ" : "Date To",
    all: ar ? "الكل" : "All",
    cashbox: ar ? "صندوق نقدي" : "Cashbox",
    bank: ar ? "حساب بنكي" : "Bank Account",
    totalBalance: ar ? "إجمالي الأرصدة" : "Total Balance",
    totalInflow: ar ? "إجمالي الوارد" : "Total Inflow",
    totalOutflow: ar ? "إجمالي الصادر" : "Total Outflow",
    netMovement: ar ? "صافي الحركة" : "Net Movement",
    accountsCount: ar ? "عدد الحسابات" : "Accounts Count",
    transactionsCount: ar ? "عدد الحركات" : "Transactions Count",
    confirmedCount: ar ? "المؤكدة" : "Confirmed",
    draftCount: ar ? "المسودات" : "Drafts",
    cancelledCount: ar ? "الملغاة" : "Cancelled",
    transferCount: ar ? "التحويلات" : "Transfers",
    viewStatement: ar ? "كشف الحساب" : "Statement",
    table: {
      account: ar ? "الحساب" : "Account",
      type: ar ? "النوع" : "Type",
      opening: ar ? "رصيد افتتاحي" : "Opening",
      balance: ar ? "الرصيد الحالي" : "Current Balance",
      inflow: ar ? "وارد" : "Inflow",
      outflow: ar ? "صادر" : "Outflow",
      net: ar ? "الصافي" : "Net",
      count: ar ? "الحركات" : "Transactions",
      confirmed: ar ? "مؤكدة" : "Confirmed",
      draft: ar ? "مسودة" : "Draft",
      cancelled: ar ? "ملغاة" : "Cancelled",
      transfers: ar ? "تحويلات" : "Transfers",
      action: ar ? "الإجراء" : "Action",
    },
    presets: {
      THIS_MONTH: ar ? "هذا الشهر" : "This Month",
      TODAY: ar ? "اليوم" : "Today",
      LAST_30: ar ? "آخر 30 يوم" : "Last 30 Days",
      ALL: ar ? "كل الفترة" : "All Time",
    },
    statuses: {
      ALL: ar ? "كل الحالات" : "All Statuses",
      DRAFT: ar ? "مسودة" : "Draft",
      CONFIRMED: ar ? "مؤكدة" : "Confirmed",
      CANCELLED: ar ? "ملغاة" : "Cancelled",
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
    throw new Error(payload?.message || `HTTP ${response.status}`);
  }

  return payload as T;
}

function isInflowForAccount(txn: TreasuryTransaction, accountId: string) {
  if (
    ["INCOME", "OPENING_BALANCE", "DEPOSIT", "ADJUSTMENT"].includes(
      txn.transaction_type,
    )
  ) {
    return String(txn.treasury_account_id || txn.treasury_account?.id || "") === accountId;
  }

  if (txn.transaction_type === "TRANSFER") {
    return String(txn.destination_account_id || txn.destination_account?.id || "") === accountId;
  }

  return false;
}

function isOutflowForAccount(txn: TreasuryTransaction, accountId: string) {
  if (["EXPENSE", "WITHDRAW"].includes(txn.transaction_type)) {
    return String(txn.treasury_account_id || txn.treasury_account?.id || "") === accountId;
  }

  if (txn.transaction_type === "TRANSFER") {
    return String(txn.treasury_account_id || txn.treasury_account?.id || "") === accountId;
  }

  return false;
}

export default function TreasuryReportsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [accountType, setAccountType] = useState<AccountTypeFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("CONFIRMED");
  const [rangePreset, setRangePreset] = useState<RangePreset>("THIS_MONTH");
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(today());

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const reportLines = useMemo<ReportLine[]>(() => {
    const clean = query.trim().toLowerCase();

    return accounts
      .filter((account) => {
        const matchesType =
          accountType === "ALL" || account.account_type === accountType;

        const searchText = `${account.name} ${account.code} ${account.bank_name || ""}`.toLowerCase();
        const matchesSearch = !clean || searchText.includes(clean);

        return matchesType && matchesSearch;
      })
      .map((account) => {
        const accountId = String(account.id);

        const relatedTransactions = transactions.filter((txn) => {
          const sourceId = String(
            txn.treasury_account_id || txn.treasury_account?.id || "",
          );
          const destinationId = String(
            txn.destination_account_id || txn.destination_account?.id || "",
          );

          const matchesAccount = sourceId === accountId || destinationId === accountId;
          const matchesStatus = status === "ALL" || txn.status === status;

          const matchesDate =
            (!dateFrom || txn.transaction_date >= dateFrom) &&
            (!dateTo || txn.transaction_date <= dateTo);

          return matchesAccount && matchesStatus && matchesDate;
        });

        const inflow = relatedTransactions
          .filter((txn) => isInflowForAccount(txn, accountId))
          .reduce((sum, txn) => sum + toNumber(txn.amount), 0);

        const outflow = relatedTransactions
          .filter((txn) => isOutflowForAccount(txn, accountId))
          .reduce((sum, txn) => sum + toNumber(txn.amount), 0);

        const confirmedCount = relatedTransactions.filter(
          (txn) => txn.status === "CONFIRMED",
        ).length;

        const draftCount = relatedTransactions.filter(
          (txn) => txn.status === "DRAFT",
        ).length;

        const cancelledCount = relatedTransactions.filter(
          (txn) => txn.status === "CANCELLED",
        ).length;

        const transferCount = relatedTransactions.filter(
          (txn) => txn.transaction_type === "TRANSFER",
        ).length;

        return {
          id: String(account.id),
          account_id: account.id,
          account_name: account.name,
          account_code: account.code,
          account_type: account.account_type,
          account_type_label: account.account_type_label || account.account_type,
          opening_balance: toNumber(account.opening_balance),
          current_balance: toNumber(account.current_balance),
          inflow,
          outflow,
          net_movement: inflow - outflow,
          transactions_count: relatedTransactions.length,
          confirmed_count: confirmedCount,
          draft_count: draftCount,
          cancelled_count: cancelledCount,
          transfer_count: transferCount,
          currency: account.currency || "SAR",
        };
      })
      .filter((line) => {
        if (status === "ALL") return true;
        return line.transactions_count > 0 || line.current_balance !== 0;
      });
  }, [accounts, transactions, query, accountType, status, dateFrom, dateTo]);

  const totals = useMemo(() => {
    return reportLines.reduce(
      (acc, line) => {
        acc.totalBalance += line.current_balance;
        acc.totalOpening += line.opening_balance;
        acc.totalInflow += line.inflow;
        acc.totalOutflow += line.outflow;
        acc.netMovement += line.net_movement;
        acc.transactionsCount += line.transactions_count;
        acc.confirmedCount += line.confirmed_count;
        acc.draftCount += line.draft_count;
        acc.cancelledCount += line.cancelled_count;
        acc.transferCount += line.transfer_count;
        return acc;
      },
      {
        totalBalance: 0,
        totalOpening: 0,
        totalInflow: 0,
        totalOutflow: 0,
        netMovement: 0,
        transactionsCount: 0,
        confirmedCount: 0,
        draftCount: 0,
        cancelledCount: 0,
        transferCount: 0,
      },
    );
  }, [reportLines]);

  async function loadData(showToast = false) {
    try {
      setIsLoading(true);

      const params = new URLSearchParams();
      params.set("page_size", "500");

      if (status !== "ALL") params.set("status", status);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const [accountsPayload, transactionsPayload] = await Promise.all([
        fetchJson<unknown>("/api/treasury/accounts/?page_size=500"),
        fetchJson<unknown>(`/api/treasury/transactions/?${params.toString()}`),
      ]);

      setAccounts(toArray<unknown>(accountsPayload).map(normalizeAccount));
      setTransactions(
        toArray<unknown>(transactionsPayload).map(normalizeTransaction),
      );

      if (showToast) toast.success(t.refreshed);
    } catch (error) {
      console.error("Treasury reports load error:", error);
      setAccounts([]);
      setTransactions([]);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function applyPreset(value: RangePreset) {
    setRangePreset(value);
    const range = getPresetRange(value);
    setDateFrom(range.from);
    setDateTo(range.to);
  }

  function exportExcel() {
    const rows = reportLines.map((line) => ({
      "Account Code": line.account_code,
      "Account Name": line.account_name,
      "Account Type": line.account_type_label,
      "Opening Balance": money(line.opening_balance),
      "Current Balance": money(line.current_balance),
      "Inflow": money(line.inflow),
      "Outflow": money(line.outflow),
      "Net Movement": money(line.net_movement),
      "Transactions Count": line.transactions_count,
      "Confirmed": line.confirmed_count,
      "Draft": line.draft_count,
      "Cancelled": line.cancelled_count,
      "Transfers": line.transfer_count,
      "Currency": line.currency,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 30 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Treasury Reports");
    XLSX.writeFile(workbook, `primey-treasury-reports-${today()}.xlsx`);

    toast.success(t.exported);
  }

  function printPage() {
    window.print();
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

  const kpiCards = [
    {
      label: t.totalBalance,
      value: money(totals.totalBalance),
      icon: Wallet,
      currency: true,
    },
    {
      label: t.totalInflow,
      value: money(totals.totalInflow),
      icon: TrendingUp,
      currency: true,
    },
    {
      label: t.totalOutflow,
      value: money(totals.totalOutflow),
      icon: TrendingDown,
      currency: true,
    },
    {
      label: t.netMovement,
      value: money(totals.netMovement),
      icon: FileBarChart,
      currency: true,
    },
    {
      label: t.accountsCount,
      value: formatNumber(reportLines.length),
      icon: Building2,
      currency: false,
    },
    {
      label: t.transactionsCount,
      value: formatNumber(totals.transactionsCount),
      icon: CalendarDays,
      currency: false,
    },
    {
      label: t.confirmedCount,
      value: formatNumber(totals.confirmedCount),
      icon: Banknote,
      currency: false,
    },
    {
      label: t.transferCount,
      value: formatNumber(totals.transferCount),
      icon: RefreshCcw,
      currency: false,
    },
  ];

  return (
    <PermissionGuard
      anyPermissions={[PERMISSIONS.TREASURY_VIEW, PERMISSIONS.REPORTS_VIEW]}
      workspace="system"
      mode="fallback"
    >
      <div className="space-y-5" dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex flex-col gap-3 print:hidden lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                /system/treasury/reports
              </Badge>
              <Badge className="rounded-full">{t.badge}</Badge>
              <Badge variant="outline" className="rounded-full" dir="ltr">
                {dateFrom || "ALL"} → {dateTo || "ALL"}
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

            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              onClick={() => loadData(true)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              {t.refresh}
            </Button>

            <Can
              anyPermissions={[
                PERMISSIONS.TREASURY_EXPORT,
                PERMISSIONS.REPORTS_EXPORT,
              ]}
            >
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                disabled={!reportLines.length}
                onClick={exportExcel}
              >
                <Download className="h-4 w-4" />
                {t.export}
              </Button>
            </Can>

            <Can
              anyPermissions={[
                PERMISSIONS.TREASURY_EXPORT,
                PERMISSIONS.REPORTS_EXPORT,
              ]}
            >
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                disabled={!reportLines.length}
                onClick={printPage}
              >
                <Printer className="h-4 w-4" />
                {t.print}
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

        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="text-base">{t.filters}</CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid gap-3 xl:grid-cols-6">
              <div className="relative xl:col-span-2">
                <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.search}
                  className="h-10 rounded-xl ltr:pl-9 rtl:pr-9"
                />
              </div>

              <select
                value={accountType}
                onChange={(event) =>
                  setAccountType(event.target.value as AccountTypeFilter)
                }
                className="h-10 rounded-xl border bg-background px-3 text-sm"
              >
                <option value="ALL">{t.all}</option>
                <option value="CASHBOX">{t.cashbox}</option>
                <option value="BANK">{t.bank}</option>
              </select>

              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as StatusFilter)
                }
                className="h-10 rounded-xl border bg-background px-3 text-sm"
              >
                <option value="ALL">{t.statuses.ALL}</option>
                <option value="CONFIRMED">{t.statuses.CONFIRMED}</option>
                <option value="DRAFT">{t.statuses.DRAFT}</option>
                <option value="CANCELLED">{t.statuses.CANCELLED}</option>
              </select>

              <select
                value={rangePreset}
                onChange={(event) =>
                  applyPreset(event.target.value as RangePreset)
                }
                className="h-10 rounded-xl border bg-background px-3 text-sm"
              >
                <option value="THIS_MONTH">{t.presets.THIS_MONTH}</option>
                <option value="TODAY">{t.presets.TODAY}</option>
                <option value="LAST_30">{t.presets.LAST_30}</option>
                <option value="ALL">{t.presets.ALL}</option>
              </select>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="h-10 rounded-xl"
                  aria-label={t.dateFrom}
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="h-10 rounded-xl"
                  aria-label={t.dateTo}
                />
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => loadData(true)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                {t.refresh}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="print:block">
            <CardTitle className="text-base">{t.reportTitle}</CardTitle>
            <CardDescription>
              {dateFrom || "ALL"} → {dateTo || "ALL"} —{" "}
              {formatNumber(reportLines.length)}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.loading}
              </div>
            ) : reportLines.length ? (
              <div className="overflow-x-auto rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.table.account}</TableHead>
                      <TableHead>{t.table.type}</TableHead>
                      <TableHead>{t.table.opening}</TableHead>
                      <TableHead>{t.table.balance}</TableHead>
                      <TableHead>{t.table.inflow}</TableHead>
                      <TableHead>{t.table.outflow}</TableHead>
                      <TableHead>{t.table.net}</TableHead>
                      <TableHead>{t.table.count}</TableHead>
                      <TableHead>{t.table.confirmed}</TableHead>
                      <TableHead>{t.table.draft}</TableHead>
                      <TableHead>{t.table.cancelled}</TableHead>
                      <TableHead>{t.table.transfers}</TableHead>
                      <TableHead className="print:hidden">{t.table.action}</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {reportLines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{line.account_name}</p>
                            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                              {line.account_code}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className="rounded-full">
                            {line.account_type_label}
                          </Badge>
                        </TableCell>

                        <TableCell dir="ltr">
                          <div className="flex items-center gap-2">
                            <Image src={SAR_ICON} alt="SAR" width={14} height={14} />
                            {money(line.opening_balance)}
                          </div>
                        </TableCell>

                        <TableCell dir="ltr">
                          <div className="flex items-center gap-2 font-semibold">
                            <Image src={SAR_ICON} alt="SAR" width={14} height={14} />
                            {money(line.current_balance)}
                          </div>
                        </TableCell>

                        <TableCell dir="ltr">
                          <div className="flex items-center gap-2">
                            <Image src={SAR_ICON} alt="SAR" width={14} height={14} />
                            {money(line.inflow)}
                          </div>
                        </TableCell>

                        <TableCell dir="ltr">
                          <div className="flex items-center gap-2">
                            <Image src={SAR_ICON} alt="SAR" width={14} height={14} />
                            {money(line.outflow)}
                          </div>
                        </TableCell>

                        <TableCell dir="ltr">
                          <div className="flex items-center gap-2 font-semibold">
                            <Image src={SAR_ICON} alt="SAR" width={14} height={14} />
                            {money(line.net_movement)}
                          </div>
                        </TableCell>

                        <TableCell dir="ltr">{formatNumber(line.transactions_count)}</TableCell>
                        <TableCell dir="ltr">{formatNumber(line.confirmed_count)}</TableCell>
                        <TableCell dir="ltr">{formatNumber(line.draft_count)}</TableCell>
                        <TableCell dir="ltr">{formatNumber(line.cancelled_count)}</TableCell>
                        <TableCell dir="ltr">{formatNumber(line.transfer_count)}</TableCell>

                        <TableCell className="print:hidden">
                          <Button asChild variant="outline" size="sm" className="rounded-xl">
                            <Link href={`/system/treasury/accounts/${line.account_id}/statement`}>
                              {t.viewStatement}
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex h-56 items-center justify-center rounded-2xl border text-sm text-muted-foreground">
                {t.noData}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}