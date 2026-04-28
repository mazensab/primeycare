"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowDownUp,
  CreditCard,
  Download,
  Eye,
  Loader2,
  MoreHorizontal,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Can } from "@/components/guards/Can";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

type TxStatus = "DRAFT" | "CONFIRMED" | "CANCELLED" | "ALL";
type TxRowStatus = "DRAFT" | "CONFIRMED" | "CANCELLED" | string;

type TxType =
  | "ALL"
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER"
  | "OPENING_BALANCE"
  | "ADJUSTMENT"
  | "DEPOSIT"
  | "WITHDRAW";

type TxRowType =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER"
  | "OPENING_BALANCE"
  | "ADJUSTMENT"
  | "DEPOSIT"
  | "WITHDRAW"
  | string;

type Tx = {
  id: number | string;
  transaction_number: string;
  transaction_type: TxRowType;
  transaction_type_label?: string;
  status: TxRowStatus;
  status_label?: string;
  transaction_date: string;
  amount: string;
  currency: string;
  treasury_account?: { name?: string; code?: string };
  destination_account?: { name?: string; code?: string } | null;
  reference?: string;
  description?: string;
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

function normalizeTx(item: unknown): Tx {
  const row = (item || {}) as Record<string, unknown>;

  return {
    id: (row.id as number | string | undefined) || "",
    transaction_number: String(row.transaction_number || ""),
    transaction_type: String(row.transaction_type || "INCOME"),
    transaction_type_label: row.transaction_type_label
      ? String(row.transaction_type_label)
      : undefined,
    status: String(row.status || "DRAFT"),
    status_label: row.status_label ? String(row.status_label) : undefined,
    transaction_date: String(row.transaction_date || ""),
    amount: String(row.amount || "0.00"),
    currency: String(row.currency || "SAR"),
    treasury_account:
      row.treasury_account && typeof row.treasury_account === "object"
        ? (row.treasury_account as Tx["treasury_account"])
        : undefined,
    destination_account:
      row.destination_account && typeof row.destination_account === "object"
        ? (row.destination_account as Tx["destination_account"])
        : null,
    reference: row.reference ? String(row.reference) : undefined,
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

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "الحركات المالية" : "Treasury Transactions",
    subtitle: ar
      ? "قائمة القبض والصرف والتحويلات والتسويات."
      : "List of receipts, payments, transfers, and adjustments.",
    back: ar ? "الخزينة" : "Treasury",
    create: ar ? "إضافة حركة" : "Create Transaction",
    refresh: ar ? "تحديث" : "Refresh",
    export: ar ? "تصدير Excel" : "Export Excel",
    print: ar ? "طباعة" : "Print",
    search: ar
      ? "ابحث برقم الحركة أو الحساب أو الوصف..."
      : "Search by number, account, or description...",
    all: ar ? "الكل" : "All",
    loading: ar ? "جاري تحميل الحركات..." : "Loading transactions...",
    noData: ar ? "لا توجد حركات." : "No transactions.",
    actions: ar ? "الإجراءات" : "Actions",
    details: ar ? "عرض التفاصيل" : "View Details",
    copied: ar ? "تم النسخ" : "Copied",
    copyNumber: ar ? "نسخ رقم الحركة" : "Copy Number",
    apiError: ar ? "تعذر تحميل الحركات المالية." : "Unable to load transactions.",
    refreshed: ar ? "تم تحديث الحركات المالية" : "Transactions refreshed",
    exported: ar ? "تم تصدير ملف Excel" : "Excel exported",
    selected: ar ? "صفوف محددة" : "selected rows",
    previous: ar ? "السابق" : "Previous",
    next: ar ? "التالي" : "Next",
    table: {
      number: ar ? "رقم الحركة" : "Number",
      type: ar ? "النوع" : "Type",
      account: ar ? "الحساب" : "Account",
      date: ar ? "التاريخ" : "Date",
      amount: ar ? "المبلغ" : "Amount",
      status: ar ? "الحالة" : "Status",
      reference: ar ? "المرجع" : "Reference",
    },
    status: {
      DRAFT: ar ? "مسودة" : "Draft",
      CONFIRMED: ar ? "مؤكدة" : "Confirmed",
      CANCELLED: ar ? "ملغاة" : "Cancelled",
      ALL: ar ? "الكل" : "All",
    },
    types: {
      ALL: ar ? "الكل" : "All",
      INCOME: ar ? "قبض" : "Income",
      EXPENSE: ar ? "صرف" : "Expense",
      TRANSFER: ar ? "تحويل" : "Transfer",
      OPENING_BALANCE: ar ? "رصيد افتتاحي" : "Opening Balance",
      ADJUSTMENT: ar ? "تسوية" : "Adjustment",
      DEPOSIT: ar ? "إيداع" : "Deposit",
      WITHDRAW: ar ? "سحب" : "Withdraw",
    },
  };
}

function statusBadge(status: TxRowStatus, t: ReturnType<typeof dictionary>) {
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
    <Badge variant="secondary" className="rounded-full">
      {String(status || "-")}
    </Badge>
  );
}

function txTypeLabel(type: TxRowType, t: ReturnType<typeof dictionary>) {
  return t.types[type as keyof typeof t.types] || type || "-";
}

export default function TreasuryTransactionsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<Tx[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TxStatus>("ALL");
  const [type, setType] = useState<TxType>("ALL");
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [pageIndex, setPageIndex] = useState(0);

  const pageSize = 8;

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const filtered = useMemo(() => {
    const clean = query.toLowerCase().trim();

    return rows.filter((item) => {
      const matchesStatus = status === "ALL" || item.status === status;
      const matchesType = type === "ALL" || item.transaction_type === type;

      const text = [
        item.transaction_number,
        item.transaction_type,
        item.status,
        item.treasury_account?.name,
        item.treasury_account?.code,
        item.destination_account?.name,
        item.destination_account?.code,
        item.reference,
        item.description,
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && matchesType && (!clean || text.includes(clean));
    });
  }, [rows, query, status, type]);

  const pageCount = Math.max(Math.ceil(filtered.length / pageSize), 1);

  const pageRows = useMemo(() => {
    return filtered.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);
  }, [filtered, pageIndex]);

  const allPageSelected =
    pageRows.length > 0 && pageRows.every((item) => selectedIds.includes(item.id));

  async function loadRows(showToast = false) {
    try {
      setIsLoading(true);

      const response = await fetch("/api/treasury/transactions/?page_size=100", {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.success === false || payload?.ok === false) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      setRows(toArray(payload).map(normalizeTx));
      setSelectedIds([]);

      if (showToast) toast.success(t.refreshed);
    } catch (error) {
      console.error("Treasury transactions load error:", error);
      setRows([]);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function exportExcel() {
    const data = filtered.map((item) => ({
      [t.table.number]: item.transaction_number,
      [t.table.type]: txTypeLabel(item.transaction_type, t),
      [t.table.account]: item.treasury_account?.name || "-",
      [t.table.date]: item.transaction_date || "-",
      [t.table.amount]: money(item.amount),
      [t.table.status]:
        t.status[item.status as keyof typeof t.status] || item.status,
      [t.table.reference]: item.reference || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(data);

    ws["!cols"] = [
      { wch: 22 },
      { wch: 18 },
      { wch: 30 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 28 },
    ];

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      locale === "ar" ? "الحركات" : "Transactions",
    );

    XLSX.writeFile(
      wb,
      `primey-treasury-transactions-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );

    toast.success(t.exported);
  }

  function handlePrint() {
    if (typeof window === "undefined") return;
    window.print();
  }

  async function copyTransactionNumber(transactionNumber: string) {
    try {
      await navigator.clipboard.writeText(String(transactionNumber));
      toast.success(t.copied);
    } catch (error) {
      console.error("Copy transaction number error:", error);
      toast.error(t.apiError);
    }
  }

  useEffect(() => {
    const next = readLocale();
    applyDocumentLocale(next);
    setLocale(next);
  }, []);

  useEffect(() => {
    loadRows(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    setPageIndex(0);
    setSelectedIds([]);
  }, [query, status, type]);

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
                /system/treasury/transactions
              </Badge>
              <Badge className="rounded-full">
                {filtered.length} / {rows.length}
              </Badge>
            </div>

            <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
              {t.title}
            </h1>

            <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
              {t.subtitle}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/system/treasury">{t.back}</Link>
            </Button>

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

            <Can
              anyPermissions={[
                PERMISSIONS.TREASURY_EXPORT,
                PERMISSIONS.REPORTS_EXPORT,
              ]}
            >
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={exportExcel}
                disabled={!filtered.length}
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

            <Can permission={PERMISSIONS.TREASURY_CREATE}>
              <Button asChild className="h-10 rounded-xl">
                <Link href="/system/treasury/transactions/create">
                  <PlusCircle className="h-4 w-4" />
                  {t.create}
                </Link>
              </Button>
            </Can>
          </div>
        </div>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t.title}</CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative w-full md:max-w-sm">
                <Search
                  className={`text-muted-foreground absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                    isArabic ? "right-3" : "left-3"
                  }`}
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.search}
                  className={`h-10 rounded-xl ${isArabic ? "pr-10" : "pl-10"}`}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(["ALL", "DRAFT", "CONFIRMED", "CANCELLED"] as TxStatus[]).map(
                  (item) => (
                    <Button
                      key={item}
                      variant={status === item ? "default" : "outline"}
                      className="h-10 rounded-xl"
                      onClick={() => setStatus(item)}
                    >
                      {t.status[item]}
                    </Button>
                  ),
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  ["ALL", "INCOME", "EXPENSE", "TRANSFER", "ADJUSTMENT"] as TxType[]
                ).map((item) => (
                  <Button
                    key={item}
                    variant={type === item ? "default" : "outline"}
                    className="h-10 rounded-xl"
                    onClick={() => setType(item)}
                  >
                    {t.types[item]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allPageSelected}
                        onCheckedChange={() => {
                          const ids = pageRows.map((item) => item.id);

                          setSelectedIds((current) =>
                            allPageSelected
                              ? current.filter((id) => !ids.includes(id))
                              : Array.from(new Set([...current, ...ids])),
                          );
                        }}
                      />
                    </TableHead>

                    <TableHead>
                      {t.table.number}{" "}
                      <ArrowDownUp className="inline h-3 w-3" />
                    </TableHead>
                    <TableHead>{t.table.type}</TableHead>
                    <TableHead>{t.table.account}</TableHead>
                    <TableHead>{t.table.date}</TableHead>
                    <TableHead>{t.table.amount}</TableHead>
                    <TableHead>{t.table.status}</TableHead>
                    <TableHead>{t.actions}</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-28 text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.loading}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : pageRows.length ? (
                    pageRows.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(item.id)}
                            onCheckedChange={() =>
                              setSelectedIds((current) =>
                                current.includes(item.id)
                                  ? current.filter((id) => id !== item.id)
                                  : [...current, item.id],
                              )
                            }
                          />
                        </TableCell>

                        <TableCell className="font-medium">
                          {item.transaction_number}
                        </TableCell>

                        <TableCell>
                          <Badge variant="secondary" className="rounded-full">
                            {txTypeLabel(item.transaction_type, t)}
                          </Badge>
                        </TableCell>

                        <TableCell>{item.treasury_account?.name || "-"}</TableCell>

                        <TableCell>{item.transaction_date || "-"}</TableCell>

                        <TableCell>
                          <span
                            className="flex items-center gap-2 font-semibold"
                            dir="ltr"
                          >
                            <Image
                              src="/currency/sar.svg"
                              alt="SAR"
                              width={16}
                              height={16}
                            />
                            {money(item.amount)}
                          </span>
                        </TableCell>

                        <TableCell>{statusBadge(item.status, t)}</TableCell>

                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align={isArabic ? "start" : "end"}>
                              <div dir={isArabic ? "rtl" : "ltr"}>
                                <DropdownMenuLabel>{t.actions}</DropdownMenuLabel>
                                <DropdownMenuSeparator />

                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/system/treasury/transactions/${item.id}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                    {t.details}
                                  </Link>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() =>
                                    copyTransactionNumber(item.transaction_number)
                                  }
                                >
                                  {t.copyNumber}
                                </DropdownMenuItem>
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-28 text-center">
                        {t.noData}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="text-muted-foreground flex-1 text-sm">
                {formatNumber(selectedIds.length)} / {formatNumber(filtered.length)}{" "}
                {t.selected}
              </div>

              <div className="text-muted-foreground text-sm">
                {formatNumber(pageIndex + 1)} / {formatNumber(pageCount)}
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
                  onClick={() =>
                    setPageIndex((value) => Math.min(value + 1, pageCount - 1))
                  }
                >
                  {t.next}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}