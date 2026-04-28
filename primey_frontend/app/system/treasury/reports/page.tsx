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
  CreditCard,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type TreasuryAccount = {
  id: number | string;
  name: string;
  code: string;
  account_type: "CASHBOX" | "BANK" | string;
  account_type_label?: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "CLOSED" | string;
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
  transaction_type:
    | "INCOME"
    | "EXPENSE"
    | "TRANSFER"
    | "OPENING_BALANCE"
    | "ADJUSTMENT"
    | "DEPOSIT"
    | "WITHDRAW"
    | string;
  transaction_type_label?: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED" | string;
  status_label?: string;
  transaction_date: string;
  amount: string;
  currency: string;
  treasury_account?: {
    id?: number | string;
    name?: string;
    code?: string;
    account_type?: string;
  } | null;
  treasury_account_id?: number | string | null;
  destination_account?: {
    id?: number | string;
    name?: string;
    code?: string;
  } | null;
  destination_account_id?: number | string | null;
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
  current_balance: number;
  opening_balance: number;
  inflow: number;
  outflow: number;
  transfer_count: number;
  transactions_count: number;
  confirmed_count: number;
  draft_count: number;
  cancelled_count: number;
  currency: string;
};

type DateRangePreset = "THIS_MONTH" | "TODAY" | "LAST_30" | "ALL";

type AccountTypeFilter = "ALL" | "CASHBOX" | "BANK";
type TransactionStatusFilter = "ALL" | "DRAFT" | "CONFIRMED" | "CANCELLED";

const CURRENCY_ICON_PATH = "/currency/sar.svg";

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

function toArray(payload: unknown): unknown[] {
  const data = payload as {
    data?: unknown[] | { items?: unknown[] };
    items?: unknown[];
    results?: unknown[];
  };

  if (Array.isArray(payload)) return payload;

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
  if (Array.isArray(data?.data)) return data.data;

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
    bank_name: row.bank_name ? String(row.bank_name) : undefined,
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
    treasury_account:
      row.treasury_account && typeof row.treasury_account === "object"
        ? (row.treasury_account as TreasuryTransaction["treasury_account"])
        : null,
    treasury_account_id: row.treasury_account_id as
      | number
      | string
      | null
      | undefined,
    destination_account:
      row.destination_account && typeof row.destination_account === "object"
        ? (row.destination_account as TreasuryTransaction["destination_account"])
        : null,
    destination_account_id: row.destination_account_id as
      | number
      | string
      | null
      | undefined,
    reference: row.reference ? String(row.reference) : undefined,
    external_reference: row.external_reference
      ? String(row.external_reference)
      : undefined,
    description: row.description ? String(row.description) : undefined,
  };
}

function money(value: string | number | null | undefined) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

function formatNumber(value: string | number | null | undefined) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(number) ? number : 0);
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

function isWithinDateRange(value: string, dateFrom: string, dateTo: string) {
  if (!value) return false;
  if (dateFrom && value < dateFrom) return false;
  if (dateTo && value > dateTo) return false;

  return true;
}

function numeric(value: string | number | null | undefined) {
  const number = Number(value || 0);

  return Number.isFinite(number) ? number : 0;
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "تقارير الخزينة" : "Treasury Reports",
    subtitle: ar
      ? "تحليل أرصدة الصناديق والبنوك وحركات القبض والصرف والتحويلات."
      : "Analyze cashbox and bank balances, receipts, payments, and transfers.",
    back: ar ? "الخزينة" : "Treasury",
    accounts: ar ? "حسابات الخزينة" : "Treasury Accounts",
    transactions: ar ? "الحركات المالية" : "Transactions",
    refresh: ar ? "تحديث" : "Refresh",
    export: ar ? "تصدير Excel" : "Export Excel",
    print: ar ? "طباعة" : "Print",
    filters: ar ? "الفلاتر" : "Filters",
    dateFrom: ar ? "من تاريخ" : "Date From",
    dateTo: ar ? "إلى تاريخ" : "Date To",
    accountType: ar ? "نوع الحساب" : "Account Type",
    transactionStatus: ar ? "حالة الحركات" : "Transaction Status",
    includeCancelled: ar ? "إظهار الملغاة" : "Include Cancelled",
    search: ar
      ? "ابحث باسم الحساب أو الكود أو نوع الحساب..."
      : "Search by account name, code, or type...",
    apply: ar ? "تطبيق" : "Apply",
    loading: ar ? "جاري تحميل تقرير الخزينة..." : "Loading treasury report...",
    apiError: ar ? "تعذر تحميل تقرير الخزينة." : "Unable to load treasury report.",
    refreshed: ar ? "تم تحديث تقرير الخزينة" : "Treasury report refreshed",
    exported: ar
      ? "تم تصدير تقرير الخزينة Excel"
      : "Treasury report exported to Excel",
    noData: ar ? "لا توجد بيانات مطابقة للتقرير." : "No matching report data.",
    reportTable: ar ? "تفصيل التقرير حسب الحساب" : "Report Breakdown by Account",
    latestTransactions: ar
      ? "آخر الحركات ضمن التقرير"
      : "Latest Transactions in Report",
    totalBalance: ar ? "إجمالي الأرصدة" : "Total Balance",
    openingBalance: ar
      ? "إجمالي الأرصدة الافتتاحية"
      : "Total Opening Balance",
    totalInflow: ar ? "إجمالي الداخل" : "Total Inflow",
    totalOutflow: ar ? "إجمالي الخارج" : "Total Outflow",
    netMovement: ar ? "صافي الحركة" : "Net Movement",
    activeAccounts: ar ? "الحسابات النشطة" : "Active Accounts",
    cashboxes: ar ? "الصناديق" : "Cashboxes",
    banks: ar ? "البنوك" : "Banks",
    confirmedTransactions: ar ? "حركات مؤكدة" : "Confirmed Transactions",
    draftTransactions: ar ? "حركات مسودة" : "Draft Transactions",
    selected: ar ? "صفوف محددة" : "selected rows",
    all: ar ? "الكل" : "All",
    presets: {
      THIS_MONTH: ar ? "هذا الشهر" : "This Month",
      TODAY: ar ? "اليوم" : "Today",
      LAST_30: ar ? "آخر 30 يوم" : "Last 30 Days",
      ALL: ar ? "كل الفترة" : "All Time",
    },
    types: {
      ALL: ar ? "الكل" : "All",
      CASHBOX: ar ? "صندوق نقدي" : "Cashbox",
      BANK: ar ? "حساب بنكي" : "Bank Account",
    },
    statuses: {
      ALL: ar ? "الكل" : "All",
      DRAFT: ar ? "مسودة" : "Draft",
      CONFIRMED: ar ? "مؤكدة" : "Confirmed",
      CANCELLED: ar ? "ملغاة" : "Cancelled",
    },
    txTypes: {
      INCOME: ar ? "قبض" : "Income",
      EXPENSE: ar ? "صرف" : "Expense",
      TRANSFER: ar ? "تحويل" : "Transfer",
      OPENING_BALANCE: ar ? "رصيد افتتاحي" : "Opening Balance",
      ADJUSTMENT: ar ? "تسوية" : "Adjustment",
      DEPOSIT: ar ? "إيداع" : "Deposit",
      WITHDRAW: ar ? "سحب" : "Withdraw",
    },
    table: {
      account: ar ? "الحساب" : "Account",
      type: ar ? "النوع" : "Type",
      opening: ar ? "الرصيد الافتتاحي" : "Opening",
      balance: ar ? "الرصيد الحالي" : "Current Balance",
      inflow: ar ? "الداخل" : "Inflow",
      outflow: ar ? "الخارج" : "Outflow",
      net: ar ? "الصافي" : "Net",
      count: ar ? "عدد الحركات" : "Transactions",
      confirmed: ar ? "المؤكدة" : "Confirmed",
      draft: ar ? "المسودات" : "Draft",
      date: ar ? "التاريخ" : "Date",
      number: ar ? "رقم الحركة" : "Transaction Number",
      status: ar ? "الحالة" : "Status",
      amount: ar ? "المبلغ" : "Amount",
    },
  };
}

function getTransactionSignedEffect(transaction: TreasuryTransaction) {
  const amount = numeric(transaction.amount);

  if (
    transaction.transaction_type === "INCOME" ||
    transaction.transaction_type === "OPENING_BALANCE" ||
    transaction.transaction_type === "DEPOSIT"
  ) {
    return {
      inflow: amount,
      outflow: 0,
    };
  }

  if (
    transaction.transaction_type === "EXPENSE" ||
    transaction.transaction_type === "WITHDRAW"
  ) {
    return {
      inflow: 0,
      outflow: amount,
    };
  }

  if (transaction.transaction_type === "ADJUSTMENT") {
    return {
      inflow: amount,
      outflow: 0,
    };
  }

  return {
    inflow: 0,
    outflow: 0,
  };
}

function statusBadge(status: string, t: ReturnType<typeof dictionary>) {
  if (status === "CONFIRMED") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50">
        {t.statuses.CONFIRMED}
      </Badge>
    );
  }

  if (status === "DRAFT") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50">
        {t.statuses.DRAFT}
      </Badge>
    );
  }

  if (status === "CANCELLED") {
    return (
      <Badge variant="outline" className="rounded-full px-3 py-1">
        {t.statuses.CANCELLED}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="rounded-full px-3 py-1">
      {status || "-"}
    </Badge>
  );
}

function MoneyValue({ value }: { value: string | number | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold" dir="ltr">
      <Image src={CURRENCY_ICON_PATH} alt="SAR" width={15} height={15} />
      {money(value)}
    </span>
  );
}

export default function TreasuryReportsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");

  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [accountType, setAccountType] = useState<AccountTypeFilter>("ALL");
  const [status, setStatus] = useState<TransactionStatusFilter>("ALL");
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesDate =
        !dateFrom && !dateTo
          ? true
          : isWithinDateRange(transaction.transaction_date, dateFrom, dateTo);

      const matchesStatus = status === "ALL" || transaction.status === status;
      const matchesCancelled =
        includeCancelled || transaction.status !== "CANCELLED";

      return matchesDate && matchesStatus && matchesCancelled;
    });
  }, [transactions, dateFrom, dateTo, status, includeCancelled]);

  const reportLines = useMemo<ReportLine[]>(() => {
    const clean = query.trim().toLowerCase();

    return accounts
      .filter(
        (account) =>
          accountType === "ALL" || account.account_type === accountType,
      )
      .map((account) => {
        const accountTransactions = filteredTransactions.filter(
          (transaction) =>
            String(transaction.treasury_account?.id || "") ===
              String(account.id) ||
            String(transaction.treasury_account_id || "") === String(account.id),
        );

        const totals = accountTransactions.reduce(
          (sum, transaction) => {
            const effect =
              transaction.status === "CONFIRMED"
                ? getTransactionSignedEffect(transaction)
                : { inflow: 0, outflow: 0 };

            return {
              inflow: sum.inflow + effect.inflow,
              outflow: sum.outflow + effect.outflow,
              transfer_count:
                sum.transfer_count +
                (transaction.transaction_type === "TRANSFER" ? 1 : 0),
              confirmed_count:
                sum.confirmed_count +
                (transaction.status === "CONFIRMED" ? 1 : 0),
              draft_count:
                sum.draft_count + (transaction.status === "DRAFT" ? 1 : 0),
              cancelled_count:
                sum.cancelled_count +
                (transaction.status === "CANCELLED" ? 1 : 0),
            };
          },
          {
            inflow: 0,
            outflow: 0,
            transfer_count: 0,
            confirmed_count: 0,
            draft_count: 0,
            cancelled_count: 0,
          },
        );

        return {
          id: String(account.id),
          account_id: account.id,
          account_name: account.name,
          account_code: account.code,
          account_type: account.account_type,
          current_balance: numeric(account.current_balance),
          opening_balance: numeric(account.opening_balance),
          inflow: totals.inflow,
          outflow: totals.outflow,
          transfer_count: totals.transfer_count,
          transactions_count: accountTransactions.length,
          confirmed_count: totals.confirmed_count,
          draft_count: totals.draft_count,
          cancelled_count: totals.cancelled_count,
          currency: account.currency || "SAR",
        };
      })
      .filter((line) => {
        const text = [
          line.account_name,
          line.account_code,
          line.account_type,
          t.types[line.account_type as keyof typeof t.types],
        ]
          .join(" ")
          .toLowerCase();

        return !clean || text.includes(clean);
      });
  }, [accounts, filteredTransactions, accountType, query, t]);

  const summary = useMemo(() => {
    const totalBalance = reportLines.reduce(
      (sum, line) => sum + line.current_balance,
      0,
    );
    const openingBalance = reportLines.reduce(
      (sum, line) => sum + line.opening_balance,
      0,
    );
    const totalInflow = reportLines.reduce(
      (sum, line) => sum + line.inflow,
      0,
    );
    const totalOutflow = reportLines.reduce(
      (sum, line) => sum + line.outflow,
      0,
    );

    const activeAccounts = accounts.filter(
      (account) =>
        account.status === "ACTIVE" &&
        (accountType === "ALL" || account.account_type === accountType),
    ).length;

    const cashboxes = accounts.filter(
      (account) => account.account_type === "CASHBOX",
    ).length;
    const banks = accounts.filter(
      (account) => account.account_type === "BANK",
    ).length;

    const confirmedTransactions = filteredTransactions.filter(
      (transaction) => transaction.status === "CONFIRMED",
    ).length;

    const draftTransactions = filteredTransactions.filter(
      (transaction) => transaction.status === "DRAFT",
    ).length;

    return {
      totalBalance,
      openingBalance,
      totalInflow,
      totalOutflow,
      netMovement: totalInflow - totalOutflow,
      activeAccounts,
      cashboxes,
      banks,
      confirmedTransactions,
      draftTransactions,
    };
  }, [reportLines, accounts, accountType, filteredTransactions]);

  const latestTransactions = useMemo(() => {
    return [...filteredTransactions]
      .sort((a, b) => {
        const dateA = `${a.transaction_date || ""}-${String(a.id)}`;
        const dateB = `${b.transaction_date || ""}-${String(b.id)}`;

        return dateB.localeCompare(dateA);
      })
      .slice(0, 10);
  }, [filteredTransactions]);

  async function loadReport(showToast = false) {
    try {
      setIsLoading(true);

      const [accountsResponse, transactionsResponse] = await Promise.all([
        fetch("/api/treasury/accounts/?page_size=500", {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        }),
        fetch("/api/treasury/transactions/?page_size=500", {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        }),
      ]);

      const accountsPayload = await accountsResponse.json().catch(() => null);
      const transactionsPayload = await transactionsResponse
        .json()
        .catch(() => null);

      if (
        !accountsResponse.ok ||
        accountsPayload?.success === false ||
        accountsPayload?.ok === false
      ) {
        throw new Error(
          accountsPayload?.message || `HTTP ${accountsResponse.status}`,
        );
      }

      if (
        !transactionsResponse.ok ||
        transactionsPayload?.success === false ||
        transactionsPayload?.ok === false
      ) {
        throw new Error(
          transactionsPayload?.message || `HTTP ${transactionsResponse.status}`,
        );
      }

      setAccounts(toArray(accountsPayload).map(normalizeAccount));
      setTransactions(toArray(transactionsPayload).map(normalizeTransaction));
      setSelectedIds([]);

      if (showToast) toast.success(t.refreshed);
    } catch (error) {
      console.error("Treasury report load error:", error);
      setAccounts([]);
      setTransactions([]);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function applyPreset(preset: DateRangePreset) {
    if (preset === "TODAY") {
      setDateFrom(today());
      setDateTo(today());
      return;
    }

    if (preset === "THIS_MONTH") {
      setDateFrom(firstDayOfMonth());
      setDateTo(today());
      return;
    }

    if (preset === "LAST_30") {
      setDateFrom(last30Days());
      setDateTo(today());
      return;
    }

    setDateFrom("");
    setDateTo("");
  }

  function exportExcel() {
    const overviewRows = [
      { label: t.totalBalance, value: money(summary.totalBalance) },
      { label: t.openingBalance, value: money(summary.openingBalance) },
      { label: t.totalInflow, value: money(summary.totalInflow) },
      { label: t.totalOutflow, value: money(summary.totalOutflow) },
      { label: t.netMovement, value: money(summary.netMovement) },
      { label: t.activeAccounts, value: summary.activeAccounts },
      { label: t.confirmedTransactions, value: summary.confirmedTransactions },
      { label: t.draftTransactions, value: summary.draftTransactions },
    ];

    const linesRows = reportLines.map((line) => ({
      [t.table.account]: `${line.account_code} - ${line.account_name}`,
      [t.table.type]:
        t.types[line.account_type as keyof typeof t.types] || line.account_type,
      [t.table.opening]: money(line.opening_balance),
      [t.table.balance]: money(line.current_balance),
      [t.table.inflow]: money(line.inflow),
      [t.table.outflow]: money(line.outflow),
      [t.table.net]: money(line.inflow - line.outflow),
      [t.table.count]: line.transactions_count,
      [t.table.confirmed]: line.confirmed_count,
      [t.table.draft]: line.draft_count,
    }));

    const txRows = latestTransactions.map((transaction) => ({
      [t.table.date]: transaction.transaction_date || "-",
      [t.table.number]: transaction.transaction_number,
      [t.table.type]:
        t.txTypes[transaction.transaction_type as keyof typeof t.txTypes] ||
        transaction.transaction_type,
      [t.table.account]: transaction.treasury_account?.name || "-",
      [t.table.amount]: money(transaction.amount),
      [t.table.status]:
        t.statuses[transaction.status as keyof typeof t.statuses] ||
        transaction.status,
    }));

    const workbook = XLSX.utils.book_new();

    const overviewSheet = XLSX.utils.json_to_sheet(overviewRows);
    overviewSheet["!cols"] = [{ wch: 34 }, { wch: 22 }];

    const linesSheet = XLSX.utils.json_to_sheet(linesRows);
    linesSheet["!cols"] = [
      { wch: 34 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
    ];

    const txSheet = XLSX.utils.json_to_sheet(txRows);
    txSheet["!cols"] = [
      { wch: 16 },
      { wch: 24 },
      { wch: 18 },
      { wch: 28 },
      { wch: 18 },
      { wch: 16 },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      overviewSheet,
      locale === "ar" ? "الملخص" : "Summary",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      linesSheet,
      locale === "ar" ? "الحسابات" : "Accounts",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      txSheet,
      locale === "ar" ? "آخر الحركات" : "Latest Transactions",
    );

    XLSX.writeFile(
      workbook,
      `primey-treasury-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );

    toast.success(t.exported);
  }

  function handlePrint() {
    if (typeof window === "undefined") return;
    window.print();
  }

  useEffect(() => {
    const next = readLocale();
    applyDocumentLocale(next);
    setLocale(next);
  }, []);

  useEffect(() => {
    loadReport(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const allSelected =
    reportLines.length > 0 &&
    reportLines.every((line) => selectedIds.includes(line.id));

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
                /system/treasury/reports
              </Badge>
              <Badge className="rounded-full">
                {formatNumber(reportLines.length)} / {formatNumber(accounts.length)}
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

            <Button
              variant="outline"
              className="h-10 rounded-xl"
              disabled={isLoading}
              onClick={() => loadReport(true)}
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
                variant="outline"
                className="h-10 rounded-xl"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4" />
                {t.print}
              </Button>
            </Can>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t.totalBalance}
                  </p>
                  <div className="mt-2 flex items-center gap-2" dir="ltr">
                    <Image
                      src={CURRENCY_ICON_PATH}
                      alt="SAR"
                      width={18}
                      height={18}
                    />
                    <p className="text-2xl font-bold">
                      {isLoading ? "..." : money(summary.totalBalance)}
                    </p>
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t.totalInflow}
                  </p>
                  <div className="mt-2 flex items-center gap-2" dir="ltr">
                    <Image
                      src={CURRENCY_ICON_PATH}
                      alt="SAR"
                      width={18}
                      height={18}
                    />
                    <p className="text-2xl font-bold">
                      {isLoading ? "..." : money(summary.totalInflow)}
                    </p>
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t.totalOutflow}
                  </p>
                  <div className="mt-2 flex items-center gap-2" dir="ltr">
                    <Image
                      src={CURRENCY_ICON_PATH}
                      alt="SAR"
                      width={18}
                      height={18}
                    />
                    <p className="text-2xl font-bold">
                      {isLoading ? "..." : money(summary.totalOutflow)}
                    </p>
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <TrendingDown className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t.netMovement}
                  </p>
                  <div className="mt-2 flex items-center gap-2" dir="ltr">
                    <Image
                      src={CURRENCY_ICON_PATH}
                      alt="SAR"
                      width={18}
                      height={18}
                    />
                    <p className="text-2xl font-bold">
                      {isLoading ? "..." : money(summary.netMovement)}
                    </p>
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <FileBarChart className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                {t.activeAccounts}
              </p>
              <p className="mt-2 text-2xl font-bold">
                {isLoading ? "..." : formatNumber(summary.activeAccounts)}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{t.cashboxes}</p>
              <div className="mt-2 flex items-center gap-2">
                <Banknote className="h-5 w-5" />
                <p className="text-2xl font-bold">
                  {isLoading ? "..." : formatNumber(summary.cashboxes)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{t.banks}</p>
              <div className="mt-2 flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                <p className="text-2xl font-bold">
                  {isLoading ? "..." : formatNumber(summary.banks)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                {t.confirmedTransactions}
              </p>
              <p className="mt-2 text-2xl font-bold">
                {isLoading
                  ? "..."
                  : formatNumber(summary.confirmedTransactions)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              {t.filters}
            </CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(["THIS_MONTH", "TODAY", "LAST_30", "ALL"] as DateRangePreset[]).map(
                (preset) => (
                  <Button
                    key={preset}
                    variant="outline"
                    className="h-10 rounded-xl"
                    onClick={() => applyPreset(preset)}
                  >
                    {t.presets[preset]}
                  </Button>
                ),
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-6">
              <div className="space-y-2">
                <Label>{t.dateFrom}</Label>
                <Input
                  type="date"
                  className="h-10 rounded-xl"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t.dateTo}</Label>
                <Input
                  type="date"
                  className="h-10 rounded-xl"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t.accountType}</Label>
                <select
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  value={accountType}
                  onChange={(event) =>
                    setAccountType(event.target.value as AccountTypeFilter)
                  }
                >
                  <option value="ALL">{t.types.ALL}</option>
                  <option value="CASHBOX">{t.types.CASHBOX}</option>
                  <option value="BANK">{t.types.BANK}</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>{t.transactionStatus}</Label>
                <select
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as TransactionStatusFilter)
                  }
                >
                  <option value="ALL">{t.statuses.ALL}</option>
                  <option value="CONFIRMED">{t.statuses.CONFIRMED}</option>
                  <option value="DRAFT">{t.statuses.DRAFT}</option>
                  <option value="CANCELLED">{t.statuses.CANCELLED}</option>
                </select>
              </div>

              <label className="flex h-10 items-center gap-2 self-end rounded-xl border px-3 text-sm">
                <Checkbox
                  checked={includeCancelled}
                  onCheckedChange={(checked) =>
                    setIncludeCancelled(Boolean(checked))
                  }
                />
                {t.includeCancelled}
              </label>

              <Button
                className="h-10 self-end rounded-xl"
                disabled={isLoading}
                onClick={() => loadReport(true)}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                {t.apply}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileBarChart className="h-4 w-4" />
                  {t.reportTable}
                </CardTitle>
                <CardDescription>{t.subtitle}</CardDescription>
              </div>

              <div className="relative w-full xl:max-w-sm">
                <Search
                  className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                    isArabic ? "right-3" : "left-3"
                  }`}
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.search}
                  className={`h-10 rounded-xl ${
                    isArabic ? "pr-10" : "pl-10"
                  }`}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div
              id="treasury-report-print-area"
              className="overflow-hidden rounded-lg border"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={() => {
                          const ids = reportLines.map((line) => line.id);
                          setSelectedIds((current) =>
                            allSelected
                              ? current.filter((id) => !ids.includes(String(id)))
                              : Array.from(new Set([...current, ...ids])),
                          );
                        }}
                      />
                    </TableHead>
                    <TableHead>{t.table.account}</TableHead>
                    <TableHead>{t.table.type}</TableHead>
                    <TableHead>{t.table.opening}</TableHead>
                    <TableHead>{t.table.balance}</TableHead>
                    <TableHead>{t.table.inflow}</TableHead>
                    <TableHead>{t.table.outflow}</TableHead>
                    <TableHead>{t.table.net}</TableHead>
                    <TableHead>{t.table.count}</TableHead>
                    <TableHead>{t.table.confirmed}</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-32 text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.loading}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : reportLines.length ? (
                    reportLines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(line.id)}
                            onCheckedChange={() =>
                              setSelectedIds((current) =>
                                current.includes(line.id)
                                  ? current.filter((id) => id !== line.id)
                                  : [...current, line.id],
                              )
                            }
                          />
                        </TableCell>

                        <TableCell>
                          <Link
                            href={`/system/treasury/accounts/${line.account_id}`}
                            className="font-medium hover:underline"
                          >
                            {line.account_code} - {line.account_name}
                          </Link>
                        </TableCell>

                        <TableCell>
                          <Badge variant="secondary" className="rounded-full">
                            {t.types[line.account_type as keyof typeof t.types] ||
                              line.account_type}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <MoneyValue value={line.opening_balance} />
                        </TableCell>

                        <TableCell>
                          <MoneyValue value={line.current_balance} />
                        </TableCell>

                        <TableCell>
                          <MoneyValue value={line.inflow} />
                        </TableCell>

                        <TableCell>
                          <MoneyValue value={line.outflow} />
                        </TableCell>

                        <TableCell>
                          <span className="font-bold">
                            <MoneyValue value={line.inflow - line.outflow} />
                          </span>
                        </TableCell>

                        <TableCell>{formatNumber(line.transactions_count)}</TableCell>
                        <TableCell>{formatNumber(line.confirmed_count)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="h-32 text-center text-muted-foreground"
                      >
                        {t.noData}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="text-sm text-muted-foreground">
              {formatNumber(selectedIds.length)} /{" "}
              {formatNumber(reportLines.length)} {t.selected}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              {t.latestTransactions}
            </CardTitle>
            <CardDescription>{t.transactions}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.loading}
              </div>
            ) : latestTransactions.length ? (
              latestTransactions.map((transaction) => (
                <Link
                  key={transaction.id}
                  href={`/system/treasury/transactions/${transaction.id}`}
                >
                  <div className="flex flex-col gap-3 rounded-xl border p-3 transition hover:bg-muted/40 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">
                        {transaction.transaction_number}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {transaction.transaction_date || "-"} ·{" "}
                        {t.txTypes[
                          transaction.transaction_type as keyof typeof t.txTypes
                        ] || transaction.transaction_type}{" "}
                        · {transaction.treasury_account?.name || "-"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {statusBadge(transaction.status, t)}
                      <span
                        className="flex items-center gap-2 font-bold"
                        dir="ltr"
                      >
                        <Image
                          src={CURRENCY_ICON_PATH}
                          alt="SAR"
                          width={16}
                          height={16}
                        />
                        {money(transaction.amount)}
                      </span>
                    </div>
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