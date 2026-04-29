"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  Download,
  FileText,
  Loader2,
  Printer,
  RefreshCcw,
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

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
};

type TreasuryAccount = {
  id: number | string;
  name: string;
  code: string;
  account_type: string;
  account_type_label?: string;
  status: string;
  status_label?: string;
  opening_balance?: string;
  current_balance?: string;
  currency: string;
  bank_name?: string;
  is_default?: boolean;
};

type StatementSummary = {
  treasury_account_id?: number | string;
  treasury_account_name?: string;
  treasury_account_code?: string;
  treasury_account_status?: string;
  currency?: string;
  total_inflow_amount?: string;
  total_outflow_amount?: string;
  net_movement_amount?: string;
  total_transactions_count?: number;
  confirmed_transactions_count?: number;
};

type StatementLine = {
  line_type: string;
  line_date: string | null;
  reference: string;
  transaction_id: number | string | null;
  description: string;
  debit_amount: string;
  credit_amount: string;
  balance_after: string;
  currency: string;
  status: string;
  metadata?: Record<string, unknown>;
};

type StatementPayload = {
  account?: TreasuryAccount;
  statement?: {
    summary?: StatementSummary;
    lines?: StatementLine[];
  };
  filters?: {
    date_from?: string | null;
    date_to?: string | null;
    include_draft?: boolean;
    include_cancelled?: boolean;
  };
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

function dateOnly(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizeAccount(item: unknown): TreasuryAccount | null {
  if (!item || typeof item !== "object") return null;

  const row = item as Record<string, unknown>;

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
    opening_balance: row.opening_balance ? String(row.opening_balance) : "0.00",
    current_balance: row.current_balance ? String(row.current_balance) : "0.00",
    currency: String(row.currency || "SAR"),
    bank_name: row.bank_name ? String(row.bank_name) : "",
    is_default: Boolean(row.is_default),
  };
}

function normalizeStatementPayload(payload: unknown): StatementPayload {
  const envelope = payload as ApiEnvelope<StatementPayload>;
  const data = envelope?.data || (payload as StatementPayload);

  return {
    account: normalizeAccount(data?.account) || undefined,
    statement: {
      summary: data?.statement?.summary || {},
      lines: Array.isArray(data?.statement?.lines)
        ? data.statement.lines.map((line) => ({
            line_type: String(line.line_type || ""),
            line_date: line.line_date ? String(line.line_date) : null,
            reference: String(line.reference || "-"),
            transaction_id: line.transaction_id ?? null,
            description: String(line.description || ""),
            debit_amount: String(line.debit_amount || "0.00"),
            credit_amount: String(line.credit_amount || "0.00"),
            balance_after: String(line.balance_after || "0.00"),
            currency: String(line.currency || "SAR"),
            status: String(line.status || ""),
            metadata: line.metadata || {},
          }))
        : [],
    },
    filters: data?.filters || {},
  };
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "كشف حساب الخزينة" : "Treasury Statement",
    subtitle: ar
      ? "عرض حركة الحساب الخزيني حسب الفترة، مع الوارد والصادر والرصيد بعد كل حركة."
      : "View treasury account movements by period with inflow, outflow, and running balance.",
    badge: ar ? "كشف حساب" : "Statement",
    backAccount: ar ? "تفاصيل الحساب" : "Account Details",
    backAccounts: ar ? "حسابات الخزينة" : "Treasury Accounts",
    refresh: ar ? "تحديث" : "Refresh",
    export: ar ? "تصدير Excel" : "Export Excel",
    print: ar ? "طباعة Web PDF" : "Web PDF Print",
    loading: ar ? "جاري تحميل كشف الحساب..." : "Loading statement...",
    apiError: ar ? "تعذر تحميل كشف حساب الخزينة." : "Unable to load treasury statement.",
    refreshed: ar ? "تم تحديث كشف الحساب." : "Statement refreshed.",
    exported: ar ? "تم تصدير كشف الحساب." : "Statement exported.",
    noData: ar ? "لا توجد حركات في هذه الفترة." : "No movements in this period.",
    filters: ar ? "الفلاتر" : "Filters",
    dateFrom: ar ? "من تاريخ" : "Date From",
    dateTo: ar ? "إلى تاريخ" : "Date To",
    includeDraft: ar ? "إظهار المسودات" : "Include Draft",
    includeCancelled: ar ? "إظهار الملغاة" : "Include Cancelled",
    accountSummary: ar ? "ملخص الحساب" : "Account Summary",
    statementLines: ar ? "حركات كشف الحساب" : "Statement Lines",
    accountCode: ar ? "كود الحساب" : "Account Code",
    accountType: ar ? "نوع الحساب" : "Account Type",
    accountStatus: ar ? "حالة الحساب" : "Account Status",
    currentBalance: ar ? "الرصيد الحالي" : "Current Balance",
    totalInflow: ar ? "إجمالي الوارد" : "Total Inflow",
    totalOutflow: ar ? "إجمالي الصادر" : "Total Outflow",
    netMovement: ar ? "صافي الحركة" : "Net Movement",
    totalTransactions: ar ? "عدد الحركات" : "Transactions",
    confirmedTransactions: ar ? "الحركات المؤكدة" : "Confirmed",
    openingBalance: ar ? "الرصيد الافتتاحي" : "Opening Balance",
    table: {
      date: ar ? "التاريخ" : "Date",
      reference: ar ? "المرجع" : "Reference",
      type: ar ? "النوع" : "Type",
      description: ar ? "الوصف" : "Description",
      debit: ar ? "وارد" : "Inflow",
      credit: ar ? "صادر" : "Outflow",
      balance: ar ? "الرصيد بعد الحركة" : "Balance After",
      status: ar ? "الحالة" : "Status",
      action: ar ? "الإجراء" : "Action",
      view: ar ? "عرض الحركة" : "View Transaction",
    },
    types: {
      INCOME: ar ? "قبض" : "Income",
      EXPENSE: ar ? "صرف" : "Expense",
      TRANSFER: ar ? "تحويل" : "Transfer",
      OPENING_BALANCE: ar ? "رصيد افتتاحي" : "Opening Balance",
      ADJUSTMENT: ar ? "تسوية" : "Adjustment",
      DEPOSIT: ar ? "إيداع" : "Deposit",
      WITHDRAW: ar ? "سحب" : "Withdraw",
      TREASURY: ar ? "خزينة" : "Treasury",
    },
    statuses: {
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

function statusBadgeClass(status: string) {
  if (status === "CONFIRMED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
  }

  if (status === "CANCELLED") {
    return "border-red-200 bg-red-50 text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-red-950 dark:text-red-300";
  }

  return "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300";
}

function typeLabel(lineType: string, t: ReturnType<typeof dictionary>) {
  return t.types[lineType as keyof typeof t.types] || lineType || "-";
}

function statusLabel(status: string, t: ReturnType<typeof dictionary>) {
  return t.statuses[status as keyof typeof t.statuses] || status || "-";
}

function CurrencyValue({
  value,
  strong = false,
}: {
  value: string | number | null | undefined;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 ${strong ? "font-semibold" : ""}`}
      dir="ltr"
    >
      <Image src={SAR_ICON} alt="SAR" width={15} height={15} />
      {money(value)}
    </div>
  );
}

export default function TreasuryAccountStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = use(params);

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [account, setAccount] = useState<TreasuryAccount | null>(null);
  const [summary, setSummary] = useState<StatementSummary>({});
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [includeDraft, setIncludeDraft] = useState(true);
  const [includeCancelled, setIncludeCancelled] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const totals = useMemo(() => {
    const debit = lines.reduce(
      (sum, line) => sum + toNumber(line.debit_amount),
      0,
    );

    const credit = lines.reduce(
      (sum, line) => sum + toNumber(line.credit_amount),
      0,
    );

    const lastBalance = lines.length
      ? toNumber(lines[lines.length - 1]?.balance_after)
      : 0;

    return {
      debit,
      credit,
      net: debit - credit,
      lastBalance,
      totalLines: lines.length,
      confirmed: lines.filter((line) => line.status === "CONFIRMED").length,
    };
  }, [lines]);

  async function loadStatement(showToast = false) {
    try {
      setIsLoading(true);

      const paramsQuery = new URLSearchParams();

      if (dateFrom) paramsQuery.set("date_from", dateFrom);
      if (dateTo) paramsQuery.set("date_to", dateTo);

      paramsQuery.set("include_draft", includeDraft ? "true" : "false");
      paramsQuery.set("include_cancelled", includeCancelled ? "true" : "false");

      const payload = await fetchJson<unknown>(
        `/api/treasury/accounts/${resolved.id}/statement/?${paramsQuery.toString()}`,
      );

      const normalized = normalizeStatementPayload(payload);

      setAccount(normalized.account || null);
      setSummary(normalized.statement?.summary || {});
      setLines(normalized.statement?.lines || []);

      if (showToast) toast.success(t.refreshed);
    } catch (error) {
      console.error("Treasury account statement load error:", error);
      setAccount(null);
      setSummary({});
      setLines([]);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function exportExcel() {
    const rows = lines.map((line) => ({
      "Date": line.line_date || "",
      "Reference": line.reference,
      "Type": typeLabel(line.line_type, t),
      "Description": line.description,
      "Inflow": money(line.debit_amount),
      "Outflow": money(line.credit_amount),
      "Balance After": money(line.balance_after),
      "Currency": line.currency,
      "Status": statusLabel(line.status, t),
      "Transaction ID": line.transaction_id || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 26 },
      { wch: 18 },
      { wch: 44 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Treasury Statement");
    XLSX.writeFile(
      workbook,
      `primey-treasury-statement-${resolved.id}-${today()}.xlsx`,
    );

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
    loadStatement(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved.id, locale]);

  const kpiCards = [
    {
      label: t.totalInflow,
      value: summary.total_inflow_amount || totals.debit,
      icon: TrendingUp,
      currency: true,
    },
    {
      label: t.totalOutflow,
      value: summary.total_outflow_amount || totals.credit,
      icon: TrendingDown,
      currency: true,
    },
    {
      label: t.netMovement,
      value: summary.net_movement_amount || totals.net,
      icon: FileText,
      currency: true,
    },
    {
      label: t.totalTransactions,
      value: summary.total_transactions_count ?? totals.totalLines,
      icon: CalendarDays,
      currency: false,
    },
    {
      label: t.confirmedTransactions,
      value: summary.confirmed_transactions_count ?? totals.confirmed,
      icon: Banknote,
      currency: false,
    },
    {
      label: t.currentBalance,
      value: account?.current_balance || "0.00",
      icon: Wallet,
      currency: true,
    },
  ];

  return (
    <PermissionGuard
      permission={PERMISSIONS.TREASURY_VIEW}
      workspace="system"
      mode="fallback"
    >
      <div className="space-y-5" dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex flex-col gap-3 print:hidden lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                /system/treasury/accounts/{resolved.id}/statement
              </Badge>
              <Badge className="rounded-full">{t.badge}</Badge>
              {account ? (
                <Badge variant="outline" className="rounded-full" dir="ltr">
                  {account.code}
                </Badge>
              ) : null}
            </div>

            <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
              {t.title}
            </h1>

            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {account?.name ? `${account.name} — ${t.subtitle}` : t.subtitle}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href={`/system/treasury/accounts/${resolved.id}`}>
                <ArrowLeft className="h-4 w-4" />
                {t.backAccount}
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/system/treasury/accounts">{t.backAccounts}</Link>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              disabled={isLoading}
              onClick={() => loadStatement(true)}
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
                disabled={!lines.length}
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
                disabled={!lines.length}
                onClick={printPage}
              >
                <Printer className="h-4 w-4" />
                {t.print}
              </Button>
            </Can>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                          {isLoading
                            ? "..."
                            : item.currency
                              ? money(item.value)
                              : formatNumber(item.value)}
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
            <div className="grid gap-3 lg:grid-cols-6">
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

              <label className="flex h-10 items-center gap-2 rounded-xl border px-3 text-sm">
                <input
                  type="checkbox"
                  checked={includeDraft}
                  onChange={(event) => setIncludeDraft(event.target.checked)}
                />
                {t.includeDraft}
              </label>

              <label className="flex h-10 items-center gap-2 rounded-xl border px-3 text-sm">
                <input
                  type="checkbox"
                  checked={includeCancelled}
                  onChange={(event) => setIncludeCancelled(event.target.checked)}
                />
                {t.includeCancelled}
              </label>

              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl lg:col-span-2"
                disabled={isLoading}
                onClick={() => loadStatement(true)}
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

        {account ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.accountSummary}</CardTitle>
              <CardDescription>
                {account.name} — {account.code}
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{t.accountCode}</p>
                <p className="mt-1 font-medium" dir="ltr">
                  {account.code}
                </p>
              </div>

              <div className="rounded-2xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{t.accountType}</p>
                <p className="mt-1 font-medium">
                  {account.account_type_label || account.account_type}
                </p>
              </div>

              <div className="rounded-2xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{t.accountStatus}</p>
                <p className="mt-1 font-medium">
                  {account.status_label || account.status}
                </p>
              </div>

              <div className="rounded-2xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">
                  {t.openingBalance}
                </p>
                <div className="mt-1">
                  <CurrencyValue value={account.opening_balance || "0.00"} strong />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="print:block">
            <CardTitle className="text-base">{t.statementLines}</CardTitle>
            <CardDescription>
              {dateFrom || "ALL"} → {dateTo || "ALL"} —{" "}
              {formatNumber(lines.length)}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.loading}
              </div>
            ) : lines.length ? (
              <div className="overflow-x-auto rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.table.date}</TableHead>
                      <TableHead>{t.table.reference}</TableHead>
                      <TableHead>{t.table.type}</TableHead>
                      <TableHead>{t.table.description}</TableHead>
                      <TableHead>{t.table.debit}</TableHead>
                      <TableHead>{t.table.credit}</TableHead>
                      <TableHead>{t.table.balance}</TableHead>
                      <TableHead>{t.table.status}</TableHead>
                      <TableHead className="print:hidden">
                        {t.table.action}
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {lines.map((line, index) => (
                      <TableRow
                        key={`${line.transaction_id || "line"}-${index}-${line.reference}`}
                      >
                        <TableCell dir="ltr">
                          {dateOnly(line.line_date)}
                        </TableCell>

                        <TableCell>
                          <div>
                            <p className="font-medium" dir="ltr">
                              {line.reference}
                            </p>
                            {line.transaction_id ? (
                              <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                                #{line.transaction_id}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="secondary" className="rounded-full">
                            {typeLabel(line.line_type, t)}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="max-w-[320px]">
                            <p className="truncate">{line.description || "-"}</p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <CurrencyValue value={line.debit_amount} />
                        </TableCell>

                        <TableCell>
                          <CurrencyValue value={line.credit_amount} />
                        </TableCell>

                        <TableCell>
                          <CurrencyValue value={line.balance_after} strong />
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`rounded-full ${statusBadgeClass(line.status)}`}
                          >
                            {statusLabel(line.status, t)}
                          </Badge>
                        </TableCell>

                        <TableCell className="print:hidden">
                          {line.transaction_id ? (
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                            >
                              <Link
                                href={`/system/treasury/transactions/${line.transaction_id}`}
                              >
                                {t.table.view}
                              </Link>
                            </Button>
                          ) : (
                            "-"
                          )}
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