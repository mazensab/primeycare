"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  FileText,
  Loader2,
  Printer,
  RefreshCcw,
  Search,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

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

type AppLocale = "ar" | "en";

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
  iban?: string;
  description?: string;
  is_default?: boolean;
};

type StatementSummary = {
  treasury_account_id: number | string;
  treasury_account_name: string;
  treasury_account_code: string;
  treasury_account_status: string;
  currency: string;
  total_inflow_amount: string;
  total_outflow_amount: string;
  net_movement_amount: string;
  total_transactions_count: number;
  confirmed_transactions_count: number;
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
  metadata?: {
    reference?: string;
    external_reference?: string;
    journal_entry_reference?: string;
    destination_account_id?: number | string | null;
    transaction_date?: string | null;
  };
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

function readLocale(): AppLocale {
  if (typeof window === "undefined") return "ar";

  const saved = window.localStorage.getItem("primey-locale");
  if (saved === "ar" || saved === "en") return saved;

  return document.documentElement.lang === "en" ? "en" : "ar";
}

function money(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "كشف حساب الخزينة" : "Treasury Statement",
    subtitle: ar
      ? "كشف تفصيلي لحركات الصندوق أو الحساب البنكي مع الرصيد بعد كل حركة."
      : "Detailed statement of cashbox or bank transactions with running balance.",
    back: ar ? "تفاصيل الحساب" : "Account Details",
    accounts: ar ? "حسابات الخزينة" : "Treasury Accounts",
    transactions: ar ? "الحركات المالية" : "Transactions",
    refresh: ar ? "تحديث" : "Refresh",
    export: ar ? "تصدير Excel" : "Export Excel",
    print: ar ? "طباعة" : "Print",
    search: ar ? "ابحث بالمرجع أو الوصف أو نوع الحركة..." : "Search by reference, description, or type...",
    filters: ar ? "الفلاتر" : "Filters",
    dateFrom: ar ? "من تاريخ" : "Date From",
    dateTo: ar ? "إلى تاريخ" : "Date To",
    includeDraft: ar ? "إظهار المسودات" : "Include Draft",
    includeCancelled: ar ? "إظهار الملغاة" : "Include Cancelled",
    apply: ar ? "تطبيق الفلاتر" : "Apply Filters",
    loading: ar ? "جاري تحميل كشف الحساب..." : "Loading statement...",
    noData: ar ? "لا توجد حركات في كشف الحساب." : "No statement lines found.",
    apiError: ar ? "تعذر تحميل كشف الحساب." : "Unable to load statement.",
    refreshed: ar ? "تم تحديث كشف الحساب" : "Statement refreshed",
    exported: ar ? "تم تصدير كشف الحساب Excel" : "Statement exported to Excel",
    summary: ar ? "ملخص كشف الحساب" : "Statement Summary",
    accountData: ar ? "بيانات الحساب" : "Account Data",
    totalInflow: ar ? "إجمالي الداخل" : "Total Inflow",
    totalOutflow: ar ? "إجمالي الخارج" : "Total Outflow",
    netMovement: ar ? "صافي الحركة" : "Net Movement",
    currentBalance: ar ? "الرصيد الحالي" : "Current Balance",
    totalTransactions: ar ? "عدد الحركات" : "Transactions Count",
    confirmedTransactions: ar ? "الحركات المؤكدة" : "Confirmed Transactions",
    selected: ar ? "صفوف محددة" : "selected rows",
    previous: ar ? "السابق" : "Previous",
    next: ar ? "التالي" : "Next",
    table: {
      date: ar ? "التاريخ" : "Date",
      reference: ar ? "المرجع" : "Reference",
      type: ar ? "النوع" : "Type",
      description: ar ? "الوصف" : "Description",
      debit: ar ? "مدين" : "Debit",
      credit: ar ? "دائن" : "Credit",
      balance: ar ? "الرصيد بعد الحركة" : "Balance After",
      status: ar ? "الحالة" : "Status",
      actions: ar ? "الإجراءات" : "Actions",
    },
    status: {
      DRAFT: ar ? "مسودة" : "Draft",
      CONFIRMED: ar ? "مؤكدة" : "Confirmed",
      CANCELLED: ar ? "ملغاة" : "Cancelled",
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
  };
}

function statusBadge(status: string, t: ReturnType<typeof dictionary>) {
  if (status === "CONFIRMED") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50">
        {t.status.CONFIRMED}
      </Badge>
    );
  }

  if (status === "DRAFT") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50">
        {t.status.DRAFT}
      </Badge>
    );
  }

  if (status === "CANCELLED") {
    return (
      <Badge variant="outline" className="rounded-full px-3 py-1">
        {t.status.CANCELLED}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="rounded-full px-3 py-1">
      {status || "-"}
    </Badge>
  );
}

function typeLabel(type: string, t: ReturnType<typeof dictionary>) {
  return t.types[type as keyof typeof t.types] || type || "-";
}

export default function TreasuryAccountStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [account, setAccount] = useState<TreasuryAccount | null>(null);
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [includeDraft, setIncludeDraft] = useState(true);
  const [includeCancelled, setIncludeCancelled] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 10;

  const t = useMemo(() => dictionary(locale), [locale]);

  const filteredLines = useMemo(() => {
    const clean = query.trim().toLowerCase();

    return lines.filter((line) => {
      const text = [
        line.reference,
        line.line_type,
        line.description,
        line.status,
        line.metadata?.reference,
        line.metadata?.external_reference,
        line.metadata?.journal_entry_reference,
      ]
        .join(" ")
        .toLowerCase();

      return !clean || text.includes(clean);
    });
  }, [lines, query]);

  const pageCount = Math.max(Math.ceil(filteredLines.length / pageSize), 1);
  const pageRows = filteredLines.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);

  const allPageSelected =
    pageRows.length > 0 &&
    pageRows.every((line) => selectedIds.includes(line.transaction_id || line.reference));

  async function loadStatement(showToast = false) {
    try {
      setIsLoading(true);

      const params = new URLSearchParams();

      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      params.set("include_draft", includeDraft ? "true" : "false");
      params.set("include_cancelled", includeCancelled ? "true" : "false");

      const response = await fetch(
        `/api/treasury/accounts/${resolvedParams.id}/statement/?${params.toString()}`,
        {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      const data = (payload?.data || payload) as StatementPayload;

      setAccount(data.account || null);
      setSummary(data.statement?.summary || null);
      setLines(Array.isArray(data.statement?.lines) ? data.statement.lines : []);
      setSelectedIds([]);
      setPageIndex(0);

      if (showToast) toast.success(t.refreshed);
    } catch (error) {
      console.error(error);
      setAccount(null);
      setSummary(null);
      setLines([]);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function exportExcel() {
    const exportRows = filteredLines.map((line) => ({
      [t.table.date]: dateOnly(line.line_date || line.metadata?.transaction_date),
      [t.table.reference]: line.reference,
      [t.table.type]: typeLabel(line.line_type, t),
      [t.table.description]: line.description,
      [t.table.debit]: money(line.debit_amount),
      [t.table.credit]: money(line.credit_amount),
      [t.table.balance]: money(line.balance_after),
      [t.table.status]: t.status[line.status as keyof typeof t.status] || line.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet["!cols"] = [
      { wch: 16 },
      { wch: 24 },
      { wch: 18 },
      { wch: 40 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      locale === "ar" ? "كشف الحساب" : "Statement",
    );

    XLSX.writeFile(
      workbook,
      `primey-treasury-statement-${resolvedParams.id}-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`,
    );

    toast.success(t.exported);
  }

  useEffect(() => {
    const next = readLocale();
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    setLocale(next);
  }, []);

  useEffect(() => {
    loadStatement(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id, locale]);

  useEffect(() => {
    setPageIndex(0);
    setSelectedIds([]);
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              /system/treasury/accounts/{resolvedParams.id}/statement
            </Badge>

            {account ? (
              <Badge className="rounded-full">
                {account.code} - {account.name}
              </Badge>
            ) : null}
          </div>

          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.title}
          </h1>

          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {account?.description || t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={`/system/treasury/accounts/${resolvedParams.id}`}>
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

          <Button
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

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            disabled={!filteredLines.length}
            onClick={exportExcel}
          >
            <Download className="h-4 w-4" />
            {t.export}
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            {t.print}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t.totalInflow}</p>
            <div className="mt-2 flex items-center gap-2">
              <Image src="/currency/sar.svg" alt="SAR" width={18} height={18} />
              <p className="text-2xl font-bold">
                {isLoading ? "..." : money(summary?.total_inflow_amount)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t.totalOutflow}</p>
            <div className="mt-2 flex items-center gap-2">
              <Image src="/currency/sar.svg" alt="SAR" width={18} height={18} />
              <p className="text-2xl font-bold">
                {isLoading ? "..." : money(summary?.total_outflow_amount)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t.netMovement}</p>
            <div className="mt-2 flex items-center gap-2">
              <Image src="/currency/sar.svg" alt="SAR" width={18} height={18} />
              <p className="text-2xl font-bold">
                {isLoading ? "..." : money(summary?.net_movement_amount)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t.currentBalance}</p>
            <div className="mt-2 flex items-center gap-2">
              <Image src="/currency/sar.svg" alt="SAR" width={18} height={18} />
              <p className="text-2xl font-bold">
                {isLoading ? "..." : money(account?.current_balance)}
              </p>
            </div>
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

        <CardContent className="grid gap-4 lg:grid-cols-5">
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

          <label className="flex h-10 items-center gap-2 self-end rounded-xl border px-3 text-sm">
            <Checkbox
              checked={includeDraft}
              onCheckedChange={(checked) => setIncludeDraft(Boolean(checked))}
            />
            {t.includeDraft}
          </label>

          <label className="flex h-10 items-center gap-2 self-end rounded-xl border px-3 text-sm">
            <Checkbox
              checked={includeCancelled}
              onCheckedChange={(checked) => setIncludeCancelled(Boolean(checked))}
            />
            {t.includeCancelled}
          </label>

          <Button
            className="h-10 self-end rounded-xl"
            disabled={isLoading}
            onClick={() => loadStatement(true)}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            {t.apply}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                {t.summary}
              </CardTitle>
              <CardDescription>
                {summary
                  ? `${t.totalTransactions}: ${summary.total_transactions_count} · ${t.confirmedTransactions}: ${summary.confirmed_transactions_count}`
                  : t.subtitle}
              </CardDescription>
            </div>

            <div className="relative w-full xl:max-w-sm">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.search}
                className="h-10 rounded-xl pr-10"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div id="treasury-statement-print-area" className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allPageSelected}
                      onCheckedChange={() => {
                        const ids = pageRows.map((line) => line.transaction_id || line.reference);

                        setSelectedIds((current) =>
                          allPageSelected
                            ? current.filter((id) => !ids.includes(id))
                            : Array.from(new Set([...current, ...ids])),
                        );
                      }}
                    />
                  </TableHead>
                  <TableHead>{t.table.date}</TableHead>
                  <TableHead>{t.table.reference}</TableHead>
                  <TableHead>{t.table.type}</TableHead>
                  <TableHead>{t.table.description}</TableHead>
                  <TableHead>{t.table.debit}</TableHead>
                  <TableHead>{t.table.credit}</TableHead>
                  <TableHead>{t.table.balance}</TableHead>
                  <TableHead>{t.table.status}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.loading}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : pageRows.length ? (
                  pageRows.map((line) => {
                    const rowId = line.transaction_id || line.reference;

                    return (
                      <TableRow key={String(rowId)}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(rowId)}
                            onCheckedChange={() =>
                              setSelectedIds((current) =>
                                current.includes(rowId)
                                  ? current.filter((id) => id !== rowId)
                                  : [...current, rowId],
                              )
                            }
                          />
                        </TableCell>

                        <TableCell>
                          {dateOnly(line.line_date || line.metadata?.transaction_date)}
                        </TableCell>

                        <TableCell className="font-medium">
                          {line.transaction_id ? (
                            <Link
                              className="hover:underline"
                              href={`/system/treasury/transactions/${line.transaction_id}`}
                            >
                              {line.reference}
                            </Link>
                          ) : (
                            line.reference
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge variant="secondary" className="rounded-full">
                            {typeLabel(line.line_type, t)}
                          </Badge>
                        </TableCell>

                        <TableCell className="max-w-[320px] truncate">
                          {line.description || "-"}
                        </TableCell>

                        <TableCell>
                          <span className="flex items-center gap-2 font-semibold">
                            <Image src="/currency/sar.svg" alt="SAR" width={15} height={15} />
                            {money(line.debit_amount)}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="flex items-center gap-2 font-semibold">
                            <Image src="/currency/sar.svg" alt="SAR" width={15} height={15} />
                            {money(line.credit_amount)}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="flex items-center gap-2 font-bold">
                            <Image src="/currency/sar.svg" alt="SAR" width={15} height={15} />
                            {money(line.balance_after)}
                          </span>
                        </TableCell>

                        <TableCell>{statusBadge(line.status, t)}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      {t.noData}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex-1 text-sm text-muted-foreground">
              {selectedIds.length} / {filteredLines.length} {t.selected}
            </div>

            <div className="text-sm text-muted-foreground">
              {pageIndex + 1} / {pageCount}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((value) => Math.max(value - 1, 0))}
              >
                {t.previous}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={pageIndex >= pageCount - 1}
                onClick={() => setPageIndex((value) => Math.min(value + 1, pageCount - 1))}
              >
                {t.next}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}