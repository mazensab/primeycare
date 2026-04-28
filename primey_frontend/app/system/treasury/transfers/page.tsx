"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AppLocale = "ar" | "en";

type TransferStatus = "ALL" | "DRAFT" | "CONFIRMED" | "CANCELLED";

type TreasuryAccount = {
  id?: number | string;
  name?: string;
  code?: string;
  account_type?: string;
  current_balance?: string;
  currency?: string;
};

type TreasuryTransfer = {
  id: number | string;
  transaction_number: string;
  transaction_type: "TRANSFER" | string;
  transaction_type_label?: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED" | string;
  status_label?: string;
  transaction_date: string;
  treasury_account?: TreasuryAccount | null;
  treasury_account_id?: number | string;
  destination_account?: TreasuryAccount | null;
  destination_account_id?: number | string | null;
  amount: string;
  currency: string;
  reference?: string;
  external_reference?: string;
  description?: string;
  notes?: string;
  journal_entry_reference?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

function readLocale(): AppLocale {
  if (typeof window === "undefined") return "ar";

  const saved = window.localStorage.getItem("primey-locale");
  if (saved === "ar" || saved === "en") return saved;

  return document.documentElement.lang === "en" ? "en" : "ar";
}

function toArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
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

function isWithinDateRange(value: string, dateFrom: string, dateTo: string) {
  if (!value) return false;
  if (dateFrom && value < dateFrom) return false;
  if (dateTo && value > dateTo) return false;
  return true;
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "التحويلات" : "Transfers",
    subtitle: ar
      ? "متابعة التحويلات بين الصناديق والحسابات البنكية داخل الخزينة."
      : "Track transfers between cashboxes and bank accounts inside treasury.",
    back: ar ? "الخزينة" : "Treasury",
    transactions: ar ? "الحركات المالية" : "Transactions",
    accounts: ar ? "حسابات الخزينة" : "Treasury Accounts",
    createTransfer: ar ? "إنشاء تحويل" : "Create Transfer",
    refresh: ar ? "تحديث" : "Refresh",
    export: ar ? "تصدير Excel" : "Export Excel",
    print: ar ? "طباعة" : "Print",
    search: ar
      ? "ابحث برقم التحويل أو الحساب أو المرجع أو الوصف..."
      : "Search by transfer number, account, reference, or description...",
    loading: ar ? "جاري تحميل التحويلات..." : "Loading transfers...",
    noData: ar ? "لا توجد تحويلات." : "No transfers found.",
    apiError: ar ? "تعذر تحميل التحويلات." : "Unable to load transfers.",
    refreshed: ar ? "تم تحديث التحويلات" : "Transfers refreshed",
    exported: ar ? "تم تصدير التحويلات Excel" : "Transfers exported to Excel",
    confirmSuccess: ar ? "تم تأكيد التحويل بنجاح" : "Transfer confirmed successfully",
    confirmError: ar ? "تعذر تأكيد التحويل." : "Unable to confirm transfer.",
    cancelSuccess: ar ? "تم إلغاء التحويل بنجاح" : "Transfer cancelled successfully",
    cancelError: ar ? "تعذر إلغاء التحويل." : "Unable to cancel transfer.",
    actions: ar ? "الإجراءات" : "Actions",
    details: ar ? "عرض التفاصيل" : "View Details",
    confirm: ar ? "تأكيد التحويل" : "Confirm Transfer",
    cancel: ar ? "إلغاء التحويل" : "Cancel Transfer",
    filters: ar ? "الفلاتر" : "Filters",
    dateFrom: ar ? "من تاريخ" : "Date From",
    dateTo: ar ? "إلى تاريخ" : "Date To",
    totalTransfers: ar ? "عدد التحويلات" : "Total Transfers",
    confirmedTransfers: ar ? "تحويلات مؤكدة" : "Confirmed Transfers",
    draftTransfers: ar ? "تحويلات مسودة" : "Draft Transfers",
    totalAmount: ar ? "إجمالي التحويلات" : "Total Transfer Amount",
    selected: ar ? "صفوف محددة" : "selected rows",
    previous: ar ? "السابق" : "Previous",
    next: ar ? "التالي" : "Next",
    all: ar ? "الكل" : "All",
    table: {
      number: ar ? "رقم التحويل" : "Transfer Number",
      date: ar ? "التاريخ" : "Date",
      from: ar ? "من حساب" : "From Account",
      to: ar ? "إلى حساب" : "To Account",
      amount: ar ? "المبلغ" : "Amount",
      status: ar ? "الحالة" : "Status",
      reference: ar ? "المرجع" : "Reference",
      description: ar ? "الوصف" : "Description",
      journal: ar ? "مرجع القيد" : "Journal Ref",
    },
    statuses: {
      ALL: ar ? "الكل" : "All",
      DRAFT: ar ? "مسودة" : "Draft",
      CONFIRMED: ar ? "مؤكدة" : "Confirmed",
      CANCELLED: ar ? "ملغاة" : "Cancelled",
    },
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

function accountLabel(account?: TreasuryAccount | null, fallbackId?: number | string | null) {
  if (!account && !fallbackId) return "-";

  const code = account?.code || "";
  const name = account?.name || "";
  const label = `${code} ${name}`.trim();

  return label || `#${fallbackId}`;
}

function accountIcon(account?: TreasuryAccount | null) {
  return account?.account_type === "BANK" ? Building2 : Banknote;
}

export default function TreasuryTransfersPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<TreasuryTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TransferStatus>("ALL");
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);

  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 10;

  const t = useMemo(() => dictionary(locale), [locale]);

  const filteredRows = useMemo(() => {
    const clean = query.trim().toLowerCase();

    return rows.filter((item) => {
      const matchesStatus = status === "ALL" || item.status === status;
      const matchesDate = isWithinDateRange(item.transaction_date, dateFrom, dateTo);

      const text = [
        item.transaction_number,
        item.status,
        item.reference,
        item.external_reference,
        item.description,
        item.notes,
        item.journal_entry_reference,
        accountLabel(item.treasury_account, item.treasury_account_id),
        accountLabel(item.destination_account, item.destination_account_id),
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && matchesDate && (!clean || text.includes(clean));
    });
  }, [rows, query, status, dateFrom, dateTo]);

  const summary = useMemo(() => {
    const confirmedRows = filteredRows.filter((item) => item.status === "CONFIRMED");
    const draftRows = filteredRows.filter((item) => item.status === "DRAFT");

    return {
      totalTransfers: filteredRows.length,
      confirmedTransfers: confirmedRows.length,
      draftTransfers: draftRows.length,
      totalAmount: confirmedRows.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    };
  }, [filteredRows]);

  const pageCount = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
  const pageRows = filteredRows.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);

  const allPageSelected =
    pageRows.length > 0 && pageRows.every((item) => selectedIds.includes(item.id));

  async function loadRows(showToast = false) {
    try {
      setIsLoading(true);

      const response = await fetch(
        "/api/treasury/transactions/?page_size=500&transaction_type=TRANSFER",
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

      const nextRows = toArray(payload).filter(
        (item) => item.transaction_type === "TRANSFER",
      ) as TreasuryTransfer[];

      setRows(nextRows);
      setSelectedIds([]);
      setPageIndex(0);

      if (showToast) toast.success(t.refreshed);
    } catch (error) {
      console.error(error);
      setRows([]);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  async function confirmTransfer(id: string | number) {
    try {
      setActionLoadingId(id);

      const response = await fetch(`/api/treasury/transactions/${id}/confirm/`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      toast.success(t.confirmSuccess);
      await loadRows(false);
    } catch (error) {
      console.error(error);
      toast.error(t.confirmError);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function cancelTransfer(id: string | number) {
    try {
      setActionLoadingId(id);

      const response = await fetch(`/api/treasury/transactions/${id}/`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      toast.success(t.cancelSuccess);
      await loadRows(false);
    } catch (error) {
      console.error(error);
      toast.error(t.cancelError);
    } finally {
      setActionLoadingId(null);
    }
  }

  function exportExcel() {
    const data = filteredRows.map((item) => ({
      [t.table.number]: item.transaction_number,
      [t.table.date]: item.transaction_date || "-",
      [t.table.from]: accountLabel(item.treasury_account, item.treasury_account_id),
      [t.table.to]: accountLabel(item.destination_account, item.destination_account_id),
      [t.table.amount]: money(item.amount),
      [t.table.status]: t.statuses[item.status as keyof typeof t.statuses] || item.status,
      [t.table.reference]: item.reference || "-",
      [t.table.description]: item.description || "-",
      [t.table.journal]: item.journal_entry_reference || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 24 },
      { wch: 16 },
      { wch: 34 },
      { wch: 34 },
      { wch: 18 },
      { wch: 16 },
      { wch: 24 },
      { wch: 40 },
      { wch: 20 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      locale === "ar" ? "التحويلات" : "Transfers",
    );

    XLSX.writeFile(
      workbook,
      `primey-treasury-transfers-${new Date().toISOString().slice(0, 10)}.xlsx`,
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
    loadRows(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    setSelectedIds([]);
    setPageIndex(0);
  }, [query, status, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              /system/treasury/transfers
            </Badge>
            <Badge className="rounded-full">
              {filteredRows.length} / {rows.length}
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

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            disabled={isLoading}
            onClick={() => loadRows(true)}
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
            disabled={!filteredRows.length}
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

          <Link href="/system/treasury/transactions/create">
            <Button className="h-10 rounded-xl">
              <PlusCircle className="h-4 w-4" />
              {t.createTransfer}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{t.totalTransfers}</p>
                <p className="mt-2 text-2xl font-bold">
                  {isLoading ? "..." : summary.totalTransfers}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <ArrowLeftRight className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{t.confirmedTransfers}</p>
                <p className="mt-2 text-2xl font-bold">
                  {isLoading ? "..." : summary.confirmedTransfers}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{t.draftTransfers}</p>
                <p className="mt-2 text-2xl font-bold">
                  {isLoading ? "..." : summary.draftTransfers}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <FileText className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{t.totalAmount}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Image src="/currency/sar.svg" alt="SAR" width={18} height={18} />
                  <p className="text-2xl font-bold">
                    {isLoading ? "..." : money(summary.totalAmount)}
                  </p>
                </div>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowLeftRight className="h-4 w-4" />
                {t.filters}
              </CardTitle>
              <CardDescription>{t.subtitle}</CardDescription>
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
          <div className="grid gap-3 lg:grid-cols-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">{t.dateFrom}</p>
              <Input
                type="date"
                className="h-10 rounded-xl"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t.dateTo}</p>
              <Input
                type="date"
                className="h-10 rounded-xl"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <p className="text-sm font-medium">{t.table.status}</p>
              <div className="flex flex-wrap gap-2">
                {(["ALL", "DRAFT", "CONFIRMED", "CANCELLED"] as TransferStatus[]).map(
                  (item) => (
                    <Button
                      key={item}
                      variant={status === item ? "default" : "outline"}
                      className="h-10 rounded-xl"
                      onClick={() => setStatus(item)}
                    >
                      {t.statuses[item]}
                    </Button>
                  ),
                )}
              </div>
            </div>
          </div>

          <div id="treasury-transfers-print-area" className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border"
                      checked={allPageSelected}
                      onChange={() => {
                        const ids = pageRows.map((item) => item.id);

                        setSelectedIds((current) =>
                          allPageSelected
                            ? current.filter((id) => !ids.includes(id))
                            : Array.from(new Set([...current, ...ids])),
                        );
                      }}
                    />
                  </TableHead>
                  <TableHead>{t.table.number}</TableHead>
                  <TableHead>{t.table.date}</TableHead>
                  <TableHead>{t.table.from}</TableHead>
                  <TableHead>{t.table.to}</TableHead>
                  <TableHead>{t.table.amount}</TableHead>
                  <TableHead>{t.table.status}</TableHead>
                  <TableHead>{t.actions}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.loading}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : pageRows.length ? (
                  pageRows.map((item) => {
                    const SourceIcon = accountIcon(item.treasury_account);
                    const DestinationIcon = accountIcon(item.destination_account);
                    const canConfirm = item.status === "DRAFT";
                    const canCancel =
                      item.status !== "CONFIRMED" && item.status !== "CANCELLED";

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border"
                            checked={selectedIds.includes(item.id)}
                            onChange={() =>
                              setSelectedIds((current) =>
                                current.includes(item.id)
                                  ? current.filter((id) => id !== item.id)
                                  : [...current, item.id],
                              )
                            }
                          />
                        </TableCell>

                        <TableCell>
                          <Link
                            href={`/system/treasury/transactions/${item.id}`}
                            className="font-medium hover:underline"
                          >
                            {item.transaction_number}
                          </Link>
                          <p className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground">
                            {item.reference || item.description || "-"}
                          </p>
                        </TableCell>

                        <TableCell>{dateOnly(item.transaction_date)}</TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                              <SourceIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {accountLabel(item.treasury_account, item.treasury_account_id)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.treasury_account?.account_type || "-"}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                              <DestinationIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {accountLabel(
                                  item.destination_account,
                                  item.destination_account_id,
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.destination_account?.account_type || "-"}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="flex items-center gap-2 font-bold">
                            <Image src="/currency/sar.svg" alt="SAR" width={15} height={15} />
                            {money(item.amount)}
                          </span>
                        </TableCell>

                        <TableCell>{statusBadge(item.status, t)}</TableCell>

                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                {actionLoadingId === item.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent>
                              <DropdownMenuLabel>{t.actions}</DropdownMenuLabel>
                              <DropdownMenuSeparator />

                              <DropdownMenuItem asChild>
                                <Link href={`/system/treasury/transactions/${item.id}`}>
                                  <Eye className="h-4 w-4" />
                                  {t.details}
                                </Link>
                              </DropdownMenuItem>

                              {canConfirm ? (
                                <DropdownMenuItem onClick={() => confirmTransfer(item.id)}>
                                  <CheckCircle2 className="h-4 w-4" />
                                  {t.confirm}
                                </DropdownMenuItem>
                              ) : null}

                              {canCancel ? (
                                <DropdownMenuItem onClick={() => cancelTransfer(item.id)}>
                                  <FileText className="h-4 w-4" />
                                  {t.cancel}
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      {t.noData}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex-1 text-sm text-muted-foreground">
              {selectedIds.length} / {filteredRows.length} {t.selected}
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