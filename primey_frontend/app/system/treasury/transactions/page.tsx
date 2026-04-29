"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowDownUp,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  Loader2,
  MoreHorizontal,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
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
  id?: number | string;
  name?: string;
  code?: string;
  account_type?: string;
  account_type_label?: string;
  status?: string;
  status_label?: string;
  current_balance?: string;
  currency?: string;
};

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
  treasury_account?: TreasuryAccount | null;
  treasury_account_id?: number | string;
  destination_account?: TreasuryAccount | null;
  destination_account_id?: number | string | null;
  reference?: string;
  external_reference?: string;
  description?: string;
  notes?: string;
  journal_entry_reference?: string;
  created_at?: string | null;
  updated_at?: string | null;
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

function getCookie(name: string) {
  if (typeof document === "undefined") return "";

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || "";
  }

  return "";
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

function normalizeAccount(item: unknown): TreasuryAccount {
  const row = (item || {}) as Record<string, unknown>;

  return {
    id: row.id as number | string | undefined,
    name: row.name ? String(row.name) : "",
    code: row.code ? String(row.code) : "",
    account_type: row.account_type ? String(row.account_type) : "",
    account_type_label: row.account_type_label
      ? String(row.account_type_label)
      : undefined,
    status: row.status ? String(row.status) : "",
    status_label: row.status_label ? String(row.status_label) : undefined,
    current_balance: row.current_balance ? String(row.current_balance) : "0.00",
    currency: row.currency ? String(row.currency) : "SAR",
  };
}

function normalizeTx(item: unknown): Tx {
  const row = (item || {}) as Record<string, unknown>;

  return {
    id: (row.id as number | string | undefined) || "",
    transaction_number: String(row.transaction_number || "-"),
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
        ? normalizeAccount(row.treasury_account)
        : null,
    treasury_account_id: row.treasury_account_id as number | string | undefined,
    destination_account:
      row.destination_account && typeof row.destination_account === "object"
        ? normalizeAccount(row.destination_account)
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
    notes: row.notes ? String(row.notes) : undefined,
    journal_entry_reference: row.journal_entry_reference
      ? String(row.journal_entry_reference)
      : undefined,
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  };
}

function toNumber(value: unknown): number {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
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
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "الحركات المالية" : "Treasury Transactions",
    subtitle: ar
      ? "إدارة حركات القبض والصرف والتحويلات والتسويات داخل الخزينة."
      : "Manage receipts, payments, transfers, and adjustments inside treasury.",
    back: ar ? "الخزينة" : "Treasury",
    create: ar ? "إضافة حركة" : "Create Transaction",
    refresh: ar ? "تحديث" : "Refresh",
    export: ar ? "تصدير Excel" : "Export Excel",
    print: ar ? "طباعة Web PDF" : "Web PDF Print",
    search: ar
      ? "ابحث برقم الحركة أو الحساب أو المرجع أو الوصف"
      : "Search by number, account, reference, or description",
    all: ar ? "الكل" : "All",
    loading: ar ? "جاري تحميل الحركات..." : "Loading transactions...",
    noData: ar ? "لا توجد حركات مطابقة." : "No matching transactions.",
    actions: ar ? "الإجراءات" : "Actions",
    details: ar ? "عرض التفاصيل" : "View Details",
    copied: ar ? "تم نسخ رقم الحركة" : "Transaction number copied",
    copyNumber: ar ? "نسخ رقم الحركة" : "Copy Number",
    apiError: ar ? "تعذر تحميل الحركات المالية." : "Unable to load transactions.",
    refreshed: ar ? "تم تحديث الحركات المالية" : "Transactions refreshed",
    exported: ar ? "تم تصدير ملف Excel" : "Excel exported",
    selected: ar ? "صفوف محددة" : "selected rows",
    previous: ar ? "السابق" : "Previous",
    next: ar ? "التالي" : "Next",
    confirm: ar ? "تأكيد الحركة" : "Confirm Transaction",
    cancel: ar ? "إلغاء الحركة" : "Cancel Transaction",
    confirmSuccess: ar ? "تم تأكيد الحركة بنجاح." : "Transaction confirmed successfully.",
    cancelSuccess: ar ? "تم إلغاء الحركة بنجاح." : "Transaction cancelled successfully.",
    actionError: ar ? "تعذر تنفيذ العملية." : "Unable to complete action.",
    source: ar ? "الحساب الأساسي" : "Source Account",
    destination: ar ? "الحساب الوجهة" : "Destination Account",
    dateFrom: ar ? "من تاريخ" : "Date From",
    dateTo: ar ? "إلى تاريخ" : "Date To",
    totalTransactions: ar ? "إجمالي الحركات" : "Total Transactions",
    confirmedTransactions: ar ? "الحركات المؤكدة" : "Confirmed Transactions",
    incomeTotal: ar ? "إجمالي الوارد" : "Total Inflow",
    expenseTotal: ar ? "إجمالي الصادر" : "Total Outflow",
    transferTotal: ar ? "إجمالي التحويلات" : "Total Transfers",
    notAvailable: ar ? "غير محدد" : "Not set",
    menu: ar ? "خيارات الحركة" : "Transaction Options",
    table: {
      number: ar ? "رقم الحركة" : "Number",
      type: ar ? "النوع" : "Type",
      account: ar ? "الحساب" : "Account",
      destination: ar ? "الوجهة" : "Destination",
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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const method = init?.method || "GET";
  const headers = new Headers(init?.headers || {});

  headers.set("Accept", "application/json");

  if (method !== "GET") {
    headers.set("Content-Type", "application/json");
    headers.set("X-CSRFToken", getCookie("csrftoken"));
  }

  const response = await fetch(url, {
    ...init,
    method,
    credentials: "include",
    headers,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || "Treasury API error");
  }

  return payload as T;
}

function statusBadge(status: TxRowStatus, t: ReturnType<typeof dictionary>) {
  if (status === "CONFIRMED") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
        {t.status.CONFIRMED}
      </Badge>
    );
  }

  if (status === "DRAFT") {
    return (
      <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        {t.status.DRAFT}
      </Badge>
    );
  }

  if (status === "CANCELLED") {
    return (
      <Badge className="rounded-full border-red-200 bg-red-50 px-3 py-1 text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
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
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | number | null>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TxStatus>("ALL");
  const [type, setType] = useState<TxType>("ALL");
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [pageIndex, setPageIndex] = useState(0);

  const pageSize = 10;

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const filtered = useMemo(() => {
    const clean = query.toLowerCase().trim();

    return rows.filter((item) => {
      const matchesStatus = status === "ALL" || item.status === status;
      const matchesType = type === "ALL" || item.transaction_type === type;

      const matchesDate =
        (!dateFrom || item.transaction_date >= dateFrom) &&
        (!dateTo || item.transaction_date <= dateTo);

      const text = [
        item.transaction_number,
        item.transaction_type,
        item.status,
        item.treasury_account?.name,
        item.treasury_account?.code,
        item.destination_account?.name,
        item.destination_account?.code,
        item.reference,
        item.external_reference,
        item.description,
        item.notes,
        item.journal_entry_reference,
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && matchesType && matchesDate && (!clean || text.includes(clean));
    });
  }, [rows, query, status, type, dateFrom, dateTo]);

  const pageCount = Math.max(Math.ceil(filtered.length / pageSize), 1);

  const pageRows = useMemo(() => {
    return filtered.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);
  }, [filtered, pageIndex]);

  const allPageSelected =
    pageRows.length > 0 && pageRows.every((item) => selectedIds.includes(item.id));

  const stats = useMemo(() => {
    const confirmedRows = filtered.filter((item) => item.status === "CONFIRMED");

    const incomeTotal = confirmedRows
      .filter((item) =>
        ["INCOME", "OPENING_BALANCE", "DEPOSIT", "ADJUSTMENT"].includes(
          item.transaction_type,
        ),
      )
      .reduce((sum, item) => sum + toNumber(item.amount), 0);

    const expenseTotal = confirmedRows
      .filter((item) => ["EXPENSE", "WITHDRAW"].includes(item.transaction_type))
      .reduce((sum, item) => sum + toNumber(item.amount), 0);

    const transferTotal = confirmedRows
      .filter((item) => item.transaction_type === "TRANSFER")
      .reduce((sum, item) => sum + toNumber(item.amount), 0);

    return {
      totalTransactions: toNumber(summary.total_transactions || filtered.length),
      confirmedTransactions: confirmedRows.length,
      incomeTotal: toNumber(summary.income_total || incomeTotal),
      expenseTotal: toNumber(summary.expense_total || expenseTotal),
      transferTotal: toNumber(summary.transfer_total || transferTotal),
    };
  }, [filtered, summary]);

  async function loadRows(showToast = false) {
    try {
      setIsLoading(true);

      const params = new URLSearchParams();
      params.set("page_size", "100");

      if (type !== "ALL") params.set("transaction_type", type);
      if (status !== "ALL") params.set("status", status);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (query.trim()) params.set("search", query.trim());

      const payload = await fetchJson<unknown>(
        `/api/treasury/transactions/?${params.toString()}`,
      );

      setRows(toArray<unknown>(payload).map(normalizeTx));
      setSummary(getPayloadSummary(payload));
      setSelectedIds([]);

      if (showToast) toast.success(t.refreshed);
    } catch (error) {
      console.error("Treasury transactions load error:", error);
      setRows([]);
      setSummary({});
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm(item: Tx) {
    try {
      setActionId(item.id);

      await fetchJson(`/api/treasury/transactions/${item.id}/confirm/`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      toast.success(t.confirmSuccess);
      await loadRows(false);
    } catch (error) {
      console.error("Confirm transaction error:", error);
      toast.error(t.actionError);
    } finally {
      setActionId(null);
    }
  }

  async function handleCancel(item: Tx) {
    try {
      setActionId(item.id);

      await fetchJson(`/api/treasury/transactions/${item.id}/cancel/`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      toast.success(t.cancelSuccess);
      await loadRows(false);
    } catch (error) {
      console.error("Cancel transaction error:", error);
      toast.error(t.actionError);
    } finally {
      setActionId(null);
    }
  }

  function exportExcel() {
    const data = filtered.map((item) => ({
      [t.table.number]: item.transaction_number,
      [t.table.type]: txTypeLabel(item.transaction_type, t),
      [t.table.account]: item.treasury_account?.name || "-",
      [t.table.destination]: item.destination_account?.name || "-",
      [t.table.date]: item.transaction_date || "-",
      [t.table.amount]: money(item.amount),
      [t.table.status]:
        t.status[item.status as keyof typeof t.status] || item.status,
      [t.table.reference]: item.reference || item.external_reference || "-",
      "Journal Entry": item.journal_entry_reference || "",
      "Description": item.description || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);

    ws["!cols"] = [
      { wch: 24 },
      { wch: 18 },
      { wch: 28 },
      { wch: 28 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 28 },
      { wch: 24 },
      { wch: 40 },
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
    loadRows(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    setPageIndex(0);
    setSelectedIds([]);
  }, [query, status, type, dateFrom, dateTo]);

  const kpiCards = [
    {
      label: t.totalTransactions,
      value: formatNumber(stats.totalTransactions),
      icon: CreditCard,
      currency: false,
    },
    {
      label: t.confirmedTransactions,
      value: formatNumber(stats.confirmedTransactions),
      icon: CheckCircle2,
      currency: false,
    },
    {
      label: t.incomeTotal,
      value: money(stats.incomeTotal),
      icon: TrendingUp,
      currency: true,
    },
    {
      label: t.expenseTotal,
      value: money(stats.expenseTotal),
      icon: TrendingDown,
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
                /system/treasury/transactions
              </Badge>
              <Badge className="rounded-full">
                {formatNumber(filtered.length)} / {formatNumber(rows.length)}
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
              <Link href="/system/treasury">{t.back}</Link>
            </Button>

            <Button
              type="button"
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
                type="button"
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
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={handlePrint}
                disabled={!filtered.length}
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
                          <Image src={SAR_ICON} alt="SAR" width={18} height={18} />
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
            <CardTitle className="text-base">{t.title}</CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
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
                value={status}
                onChange={(event) => setStatus(event.target.value as TxStatus)}
                className="h-10 rounded-xl border bg-background px-3 text-sm"
              >
                {(["ALL", "DRAFT", "CONFIRMED", "CANCELLED"] as TxStatus[]).map(
                  (item) => (
                    <option key={item} value={item}>
                      {t.status[item]}
                    </option>
                  ),
                )}
              </select>

              <select
                value={type}
                onChange={(event) => setType(event.target.value as TxType)}
                className="h-10 rounded-xl border bg-background px-3 text-sm"
              >
                {(
                  [
                    "ALL",
                    "INCOME",
                    "EXPENSE",
                    "TRANSFER",
                    "OPENING_BALANCE",
                    "ADJUSTMENT",
                    "DEPOSIT",
                    "WITHDRAW",
                  ] as TxType[]
                ).map((item) => (
                  <option key={item} value={item}>
                    {t.types[item]}
                  </option>
                ))}
              </select>

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

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => loadRows(true)}
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
            <CardTitle className="text-base">{t.title}</CardTitle>
            <CardDescription>
              {t.subtitle} — {formatNumber(filtered.length)}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 print:hidden">
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
                    <TableHead>{t.table.destination}</TableHead>
                    <TableHead>{t.table.date}</TableHead>
                    <TableHead>{t.table.amount}</TableHead>
                    <TableHead>{t.table.status}</TableHead>
                    <TableHead className="print:hidden">{t.actions}</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-40 text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.loading}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : pageRows.length ? (
                    pageRows.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="print:hidden">
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

                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {item.transaction_number}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.reference || item.external_reference || "-"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="secondary" className="rounded-full">
                            {txTypeLabel(item.transaction_type, t)}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {item.treasury_account?.name || t.notAvailable}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                              {item.treasury_account?.code || "-"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {item.destination_account?.name || "-"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                              {item.destination_account?.code || "-"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell dir="ltr">{dateOnly(item.transaction_date)}</TableCell>

                        <TableCell>
                          <span
                            className="flex items-center gap-2 font-semibold"
                            dir="ltr"
                          >
                            <Image src={SAR_ICON} alt="SAR" width={16} height={16} />
                            {money(item.amount)}
                          </span>
                        </TableCell>

                        <TableCell>{statusBadge(item.status, t)}</TableCell>

                        <TableCell className="print:hidden">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-8 w-8 rounded-xl p-0"
                              >
                                {actionId === item.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align={isArabic ? "start" : "end"}>
                              <div dir={isArabic ? "rtl" : "ltr"}>
                                <DropdownMenuLabel>{t.menu}</DropdownMenuLabel>
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

                                <DropdownMenuSeparator />

                                <Can permission={PERMISSIONS.TREASURY_EDIT}>
                                  <DropdownMenuItem
                                    disabled={
                                      item.status === "CONFIRMED" ||
                                      item.status === "CANCELLED" ||
                                      actionId === item.id
                                    }
                                    onSelect={(event) => {
                                      event.preventDefault();
                                      handleConfirm(item);
                                    }}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    {t.confirm}
                                  </DropdownMenuItem>
                                </Can>

                                <Can permission={PERMISSIONS.TREASURY_EDIT}>
                                  <DropdownMenuItem
                                    disabled={
                                      item.status === "CANCELLED" ||
                                      actionId === item.id
                                    }
                                    onSelect={(event) => {
                                      event.preventDefault();
                                      handleCancel(item);
                                    }}
                                  >
                                    <XCircle className="h-4 w-4" />
                                    {t.cancel}
                                  </DropdownMenuItem>
                                </Can>
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="h-40 text-center">
                        {t.noData}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-end">
              <div className="flex-1 text-sm text-muted-foreground">
                {formatNumber(selectedIds.length)} / {formatNumber(filtered.length)}{" "}
                {t.selected}
              </div>

              <div className="text-sm text-muted-foreground">
                {formatNumber(pageIndex + 1)} / {formatNumber(pageCount)}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((value) => Math.max(value - 1, 0))}
                >
                  {t.previous}
                </Button>

                <Button
                  type="button"
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