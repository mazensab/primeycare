"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  Banknote,
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

type TreasuryAccountStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "CLOSED" | string;

type TreasuryCashbox = {
  id: number | string;
  name: string;
  code: string;
  account_type: "CASHBOX" | string;
  account_type_label?: string;
  status: TreasuryAccountStatus;
  status_label?: string;
  ledger_account_id?: number | string | null;
  ledger_account?: {
    id?: number | string;
    code?: string;
    name?: string;
    name_ar?: string;
    name_en?: string;
    is_group?: boolean;
  } | null;
  opening_balance: string;
  current_balance: string;
  currency: string;
  description?: string;
  is_default?: boolean;
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

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "الصناديق النقدية" : "Cashboxes",
    subtitle: ar
      ? "إدارة الصناديق النقدية وأرصدة الكاش والحركات المرتبطة بها."
      : "Manage cashboxes, cash balances, and linked treasury transactions.",
    back: ar ? "الخزينة" : "Treasury",
    allAccounts: ar ? "حسابات الخزينة" : "Treasury Accounts",
    transactions: ar ? "الحركات المالية" : "Transactions",
    createAccount: ar ? "إنشاء صندوق" : "Create Cashbox",
    createTransaction: ar ? "إضافة حركة" : "Create Transaction",
    refresh: ar ? "تحديث" : "Refresh",
    export: ar ? "تصدير Excel" : "Export Excel",
    print: ar ? "طباعة" : "Print",
    search: ar ? "ابحث باسم الصندوق أو الكود أو الوصف..." : "Search by cashbox name, code, or description...",
    loading: ar ? "جاري تحميل الصناديق النقدية..." : "Loading cashboxes...",
    noData: ar ? "لا توجد صناديق نقدية." : "No cashboxes found.",
    apiError: ar ? "تعذر تحميل الصناديق النقدية." : "Unable to load cashboxes.",
    refreshed: ar ? "تم تحديث الصناديق النقدية" : "Cashboxes refreshed",
    exported: ar ? "تم تصدير الصناديق النقدية Excel" : "Cashboxes exported to Excel",
    actions: ar ? "الإجراءات" : "Actions",
    details: ar ? "عرض التفاصيل" : "View Details",
    statement: ar ? "كشف الحساب" : "Statement",
    defaultAccount: ar ? "افتراضي" : "Default",
    totalBalance: ar ? "إجمالي أرصدة الصناديق" : "Total Cashbox Balance",
    activeCashboxes: ar ? "الصناديق النشطة" : "Active Cashboxes",
    inactiveCashboxes: ar ? "غير النشطة" : "Inactive Cashboxes",
    defaultCashboxes: ar ? "الصناديق الافتراضية" : "Default Cashboxes",
    selected: ar ? "صفوف محددة" : "selected rows",
    all: ar ? "الكل" : "All",
    table: {
      cashbox: ar ? "الصندوق" : "Cashbox",
      code: ar ? "الكود" : "Code",
      openingBalance: ar ? "الرصيد الافتتاحي" : "Opening Balance",
      currentBalance: ar ? "الرصيد الحالي" : "Current Balance",
      status: ar ? "الحالة" : "Status",
      ledgerAccount: ar ? "الحساب المحاسبي" : "Ledger Account",
      createdAt: ar ? "تاريخ الإنشاء" : "Created At",
      description: ar ? "الوصف" : "Description",
    },
    statuses: {
      ALL: ar ? "الكل" : "All",
      ACTIVE: ar ? "نشط" : "Active",
      INACTIVE: ar ? "غير نشط" : "Inactive",
      SUSPENDED: ar ? "موقوف" : "Suspended",
      CLOSED: ar ? "مغلق" : "Closed",
    },
  };
}

function statusBadge(status: string, t: ReturnType<typeof dictionary>) {
  if (status === "ACTIVE") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50">
        {t.statuses.ACTIVE}
      </Badge>
    );
  }

  if (status === "SUSPENDED") {
    return (
      <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50">
        {t.statuses.SUSPENDED}
      </Badge>
    );
  }

  if (status === "CLOSED") {
    return (
      <Badge variant="outline" className="rounded-full px-3 py-1">
        {t.statuses.CLOSED}
      </Badge>
    );
  }

  if (status === "INACTIVE") {
    return (
      <Badge variant="secondary" className="rounded-full px-3 py-1">
        {t.statuses.INACTIVE}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="rounded-full px-3 py-1">
      {status || "-"}
    </Badge>
  );
}

function ledgerName(account: TreasuryCashbox) {
  if (!account.ledger_account) return "-";

  const ledger = account.ledger_account;

  return `${ledger.code || ""} ${
    ledger.name_ar || ledger.name || ledger.name_en || ""
  }`.trim();
}

export default function TreasuryCashboxesPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<TreasuryCashbox[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<
    "ALL" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "CLOSED"
  >("ALL");
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);

  const t = useMemo(() => dictionary(locale), [locale]);

  const filteredRows = useMemo(() => {
    const clean = query.trim().toLowerCase();

    return rows.filter((item) => {
      const matchesStatus = status === "ALL" || item.status === status;

      const text = [
        item.name,
        item.code,
        item.status,
        item.description,
        ledgerName(item),
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!clean || text.includes(clean));
    });
  }, [rows, query, status]);

  const summary = useMemo(() => {
    const totalBalance = filteredRows.reduce(
      (sum, item) => sum + Number(item.current_balance || 0),
      0,
    );

    const activeCashboxes = rows.filter((item) => item.status === "ACTIVE").length;
    const inactiveCashboxes = rows.filter((item) => item.status === "INACTIVE").length;
    const defaultCashboxes = rows.filter((item) => item.is_default).length;

    return {
      totalBalance,
      activeCashboxes,
      inactiveCashboxes,
      defaultCashboxes,
    };
  }, [rows, filteredRows]);

  const allSelected =
    filteredRows.length > 0 && filteredRows.every((item) => selectedIds.includes(item.id));

  async function loadRows(showToast = false) {
    try {
      setIsLoading(true);

      const response = await fetch(
        "/api/treasury/accounts/?page_size=500&account_type=CASHBOX",
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

      setRows(toArray(payload) as TreasuryCashbox[]);
      setSelectedIds([]);

      if (showToast) toast.success(t.refreshed);
    } catch (error) {
      console.error(error);
      setRows([]);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function exportExcel() {
    const data = filteredRows.map((item) => ({
      [t.table.code]: item.code,
      [t.table.cashbox]: item.name,
      [t.table.openingBalance]: money(item.opening_balance),
      [t.table.currentBalance]: money(item.current_balance),
      [t.table.status]: t.statuses[item.status as keyof typeof t.statuses] || item.status,
      [t.table.ledgerAccount]: ledgerName(item),
      [t.table.createdAt]: dateOnly(item.created_at),
      [t.table.description]: item.description || "-",
      [t.defaultAccount]: item.is_default ? "Yes" : "No",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 32 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 32 },
      { wch: 16 },
      { wch: 40 },
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      locale === "ar" ? "الصناديق" : "Cashboxes",
    );

    XLSX.writeFile(
      workbook,
      `primey-treasury-cashboxes-${new Date().toISOString().slice(0, 10)}.xlsx`,
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
  }, [query, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              /system/treasury/cashboxes
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
              {t.allAccounts}
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

          <Link href="/system/treasury/accounts/create">
            <Button className="h-10 rounded-xl">
              <PlusCircle className="h-4 w-4" />
              {t.createAccount}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{t.totalBalance}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Image src="/currency/sar.svg" alt="SAR" width={18} height={18} />
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
                <p className="text-sm text-muted-foreground">{t.activeCashboxes}</p>
                <p className="mt-2 text-2xl font-bold">
                  {isLoading ? "..." : summary.activeCashboxes}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <Banknote className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{t.inactiveCashboxes}</p>
                <p className="mt-2 text-2xl font-bold">
                  {isLoading ? "..." : summary.inactiveCashboxes}
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
                <p className="text-sm text-muted-foreground">{t.defaultCashboxes}</p>
                <p className="mt-2 text-2xl font-bold">
                  {isLoading ? "..." : summary.defaultCashboxes}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <Banknote className="h-5 w-5" />
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
                <Banknote className="h-4 w-4" />
                {t.title}
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
          <div className="flex flex-wrap gap-2">
            {(["ALL", "ACTIVE", "INACTIVE", "SUSPENDED", "CLOSED"] as const).map(
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

          <div id="treasury-cashboxes-print-area" className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border"
                      checked={allSelected}
                      onChange={() => {
                        const ids = filteredRows.map((item) => item.id);

                        setSelectedIds((current) =>
                          allSelected
                            ? current.filter((id) => !ids.includes(id))
                            : Array.from(new Set([...current, ...ids])),
                        );
                      }}
                    />
                  </TableHead>
                  <TableHead>{t.table.cashbox}</TableHead>
                  <TableHead>{t.table.code}</TableHead>
                  <TableHead>{t.table.openingBalance}</TableHead>
                  <TableHead>{t.table.currentBalance}</TableHead>
                  <TableHead>{t.table.status}</TableHead>
                  <TableHead>{t.table.ledgerAccount}</TableHead>
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
                ) : filteredRows.length ? (
                  filteredRows.map((item) => (
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
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                            <Banknote className="h-5 w-5" />
                          </div>

                          <div>
                            <Link
                              href={`/system/treasury/accounts/${item.id}`}
                              className="font-medium hover:underline"
                            >
                              {item.name}
                            </Link>

                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {item.is_default ? (
                                <Badge variant="outline" className="rounded-full text-xs">
                                  {t.defaultAccount}
                                </Badge>
                              ) : null}

                              {item.description ? (
                                <p className="max-w-[260px] truncate text-xs text-muted-foreground">
                                  {item.description}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="font-medium">{item.code}</TableCell>

                      <TableCell>
                        <span className="flex items-center gap-2 font-semibold">
                          <Image src="/currency/sar.svg" alt="SAR" width={15} height={15} />
                          {money(item.opening_balance)}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="flex items-center gap-2 font-bold">
                          <Image src="/currency/sar.svg" alt="SAR" width={15} height={15} />
                          {money(item.current_balance)}
                        </span>
                      </TableCell>

                      <TableCell>{statusBadge(item.status, t)}</TableCell>

                      <TableCell>{ledgerName(item)}</TableCell>

                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent>
                            <DropdownMenuLabel>{t.actions}</DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            <DropdownMenuItem asChild>
                              <Link href={`/system/treasury/accounts/${item.id}`}>
                                <Eye className="h-4 w-4" />
                                {t.details}
                              </Link>
                            </DropdownMenuItem>

                            <DropdownMenuItem asChild>
                              <Link href={`/system/treasury/accounts/${item.id}/statement`}>
                                <FileText className="h-4 w-4" />
                                {t.statement}
                              </Link>
                            </DropdownMenuItem>

                            <DropdownMenuItem asChild>
                              <Link href="/system/treasury/transactions/create">
                                <CreditCard className="h-4 w-4" />
                                {t.createTransaction}
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
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

          <div className="text-sm text-muted-foreground">
            {selectedIds.length} / {filteredRows.length} {t.selected}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}