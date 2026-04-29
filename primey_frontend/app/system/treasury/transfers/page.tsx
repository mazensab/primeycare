"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  CheckCircle2,
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
  XCircle,
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

type TransferStatus = "ALL" | "DRAFT" | "CONFIRMED" | "CANCELLED";

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
  status?: string;
  status_label?: string;
  current_balance?: string;
  currency?: string;
};

type TreasuryTransfer = {
  id: number | string;
  transaction_number: string;
  transaction_type: string;
  transaction_type_label?: string;
  status: string;
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
    status: row.status ? String(row.status) : undefined,
    status_label: row.status_label ? String(row.status_label) : undefined,
    current_balance: row.current_balance ? String(row.current_balance) : "0.00",
    currency: row.currency ? String(row.currency) : "SAR",
  };
}

function normalizeTransfer(item: unknown): TreasuryTransfer {
  const row = (item || {}) as Record<string, unknown>;

  return {
    id: (row.id as number | string | undefined) || "",
    transaction_number: String(row.transaction_number || "-"),
    transaction_type: String(row.transaction_type || "TRANSFER"),
    transaction_type_label: row.transaction_type_label
      ? String(row.transaction_type_label)
      : undefined,
    status: String(row.status || "DRAFT"),
    status_label: row.status_label ? String(row.status_label) : undefined,
    transaction_date: String(row.transaction_date || ""),
    treasury_account:
      row.treasury_account && typeof row.treasury_account === "object"
        ? normalizeTreasuryAccount(row.treasury_account)
        : null,
    treasury_account_id: row.treasury_account_id as number | string | undefined,
    destination_account:
      row.destination_account && typeof row.destination_account === "object"
        ? normalizeTreasuryAccount(row.destination_account)
        : null,
    destination_account_id: row.destination_account_id as
      | number
      | string
      | null
      | undefined,
    amount: String(row.amount || "0.00"),
    currency: String(row.currency || "SAR"),
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
    title: ar ? "تحويلات الخزينة" : "Treasury Transfers",
    subtitle: ar
      ? "متابعة التحويلات بين الصناديق والحسابات البنكية داخل الخزينة."
      : "Track internal transfers between cashboxes and bank accounts.",
    badge: ar ? "حركات من نوع TRANSFER" : "TRANSFER transactions",
    back: ar ? "الرجوع للخزينة" : "Back to Treasury",
    refresh: ar ? "تحديث" : "Refresh",
    create: ar ? "إنشاء تحويل" : "Create Transfer",
    search: ar ? "بحث برقم التحويل أو المرجع أو الحساب" : "Search by number, reference, or account",
    status: ar ? "الحالة" : "Status",
    source: ar ? "الحساب المصدر" : "Source Account",
    destination: ar ? "الحساب الوجهة" : "Destination Account",
    dateFrom: ar ? "من تاريخ" : "Date From",
    dateTo: ar ? "إلى تاريخ" : "Date To",
    all: ar ? "الكل" : "All",
    draft: ar ? "مسودة" : "Draft",
    confirmed: ar ? "مؤكدة" : "Confirmed",
    cancelled: ar ? "ملغاة" : "Cancelled",
    exportExcel: ar ? "تصدير Excel" : "Export Excel",
    print: ar ? "طباعة Web PDF" : "Web PDF Print",
    totalTransfers: ar ? "إجمالي التحويلات" : "Total Transfers",
    confirmedTransfers: ar ? "التحويلات المؤكدة" : "Confirmed Transfers",
    draftTransfers: ar ? "التحويلات المسودة" : "Draft Transfers",
    cancelledTransfers: ar ? "التحويلات الملغاة" : "Cancelled Transfers",
    totalAmount: ar ? "إجمالي المبالغ" : "Total Amount",
    confirmedAmount: ar ? "مبالغ مؤكدة" : "Confirmed Amount",
    listTitle: ar ? "قائمة التحويلات" : "Transfers List",
    listDescription: ar
      ? "كل تحويل هو حركة خزينة من نوع TRANSFER مرتبطة بحساب مصدر وحساب وجهة."
      : "Each transfer is a TRANSFER treasury transaction linked to a source and destination account.",
    transferNumber: ar ? "رقم التحويل" : "Transfer Number",
    transferDate: ar ? "التاريخ" : "Date",
    amount: ar ? "المبلغ" : "Amount",
    reference: ar ? "المرجع" : "Reference",
    actions: ar ? "الإجراءات" : "Actions",
    view: ar ? "عرض التفاصيل" : "View Details",
    confirm: ar ? "تأكيد التحويل" : "Confirm Transfer",
    cancel: ar ? "إلغاء التحويل" : "Cancel Transfer",
    noData: ar ? "لا توجد تحويلات مطابقة." : "No matching transfers.",
    loading: ar ? "جاري تحميل التحويلات..." : "Loading transfers...",
    apiError: ar ? "تعذر تحميل تحويلات الخزينة." : "Unable to load treasury transfers.",
    refreshed: ar ? "تم تحديث تحويلات الخزينة" : "Treasury transfers refreshed.",
    confirmSuccess: ar ? "تم تأكيد التحويل بنجاح." : "Transfer confirmed successfully.",
    cancelSuccess: ar ? "تم إلغاء التحويل بنجاح." : "Transfer cancelled successfully.",
    actionError: ar ? "تعذر تنفيذ العملية." : "Unable to complete action.",
    exported: ar ? "تم تصدير ملف Excel." : "Excel file exported.",
    menu: ar ? "خيارات التحويل" : "Transfer Options",
    notAvailable: ar ? "غير محدد" : "Not set",
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

function statusBadgeClass(status: string) {
  if (status === "CONFIRMED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
  }

  if (status === "CANCELLED") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300";
  }

  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300";
}

export default function TreasuryTransfersPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [items, setItems] = useState<TreasuryTransfer[]>([]);
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | number | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TransferStatus>("ALL");
  const [sourceAccountId, setSourceAccountId] = useState("ALL");
  const [destinationAccountId, setDestinationAccountId] = useState("ALL");
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(today());

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return items.filter((item) => {
      const source = `${item.treasury_account?.name || ""} ${item.treasury_account?.code || ""}`;
      const destination = `${item.destination_account?.name || ""} ${item.destination_account?.code || ""}`;

      const matchesSearch =
        !normalizedSearch ||
        item.transaction_number.toLowerCase().includes(normalizedSearch) ||
        String(item.reference || "").toLowerCase().includes(normalizedSearch) ||
        String(item.external_reference || "").toLowerCase().includes(normalizedSearch) ||
        String(item.description || "").toLowerCase().includes(normalizedSearch) ||
        source.toLowerCase().includes(normalizedSearch) ||
        destination.toLowerCase().includes(normalizedSearch);

      const matchesStatus = status === "ALL" || item.status === status;

      const matchesSource =
        sourceAccountId === "ALL" ||
        String(item.treasury_account_id || item.treasury_account?.id || "") ===
          sourceAccountId;

      const matchesDestination =
        destinationAccountId === "ALL" ||
        String(item.destination_account_id || item.destination_account?.id || "") ===
          destinationAccountId;

      const matchesDate =
        (!dateFrom || item.transaction_date >= dateFrom) &&
        (!dateTo || item.transaction_date <= dateTo);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSource &&
        matchesDestination &&
        matchesDate
      );
    });
  }, [items, search, status, sourceAccountId, destinationAccountId, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const confirmedItems = filteredItems.filter((item) => item.status === "CONFIRMED");
    const draftItems = filteredItems.filter((item) => item.status === "DRAFT");
    const cancelledItems = filteredItems.filter((item) => item.status === "CANCELLED");

    const totalAmount = filteredItems.reduce(
      (sum, item) => sum + toNumber(item.amount),
      0,
    );

    const confirmedAmount = confirmedItems.reduce(
      (sum, item) => sum + toNumber(item.amount),
      0,
    );

    return {
      totalTransfers: toNumber(summary.total_transactions || filteredItems.length),
      confirmedTransfers: confirmedItems.length,
      draftTransfers: draftItems.length,
      cancelledTransfers: cancelledItems.length,
      totalAmount,
      confirmedAmount,
    };
  }, [filteredItems, summary]);

  async function loadData(showToast = false) {
    try {
      setIsLoading(true);

      const params = new URLSearchParams();
      params.set("transaction_type", "TRANSFER");
      params.set("page_size", "100");

      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (status !== "ALL") params.set("status", status);

      const [transfersPayload, accountsPayload] = await Promise.all([
        fetchJson<unknown>(`/api/treasury/transactions/?${params.toString()}`),
        fetchJson<unknown>("/api/treasury/accounts/?page_size=100&status=ACTIVE"),
      ]);

      setItems(toArray<unknown>(transfersPayload).map(normalizeTransfer));
      setAccounts(toArray<unknown>(accountsPayload).map(normalizeTreasuryAccount));
      setSummary(getPayloadSummary(transfersPayload));

      if (showToast) toast.success(t.refreshed);
    } catch (error) {
      console.error("Treasury transfers load error:", error);
      toast.error(t.apiError);
      setItems([]);
      setAccounts([]);
      setSummary({});
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm(item: TreasuryTransfer) {
    try {
      setActionId(item.id);

      await fetchJson(`/api/treasury/transactions/${item.id}/confirm/`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      toast.success(t.confirmSuccess);
      await loadData(false);
    } catch (error) {
      console.error("Confirm transfer error:", error);
      toast.error(t.actionError);
    } finally {
      setActionId(null);
    }
  }

  async function handleCancel(item: TreasuryTransfer) {
    try {
      setActionId(item.id);

      await fetchJson(`/api/treasury/transactions/${item.id}/cancel/`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      toast.success(t.cancelSuccess);
      await loadData(false);
    } catch (error) {
      console.error("Cancel transfer error:", error);
      toast.error(t.actionError);
    } finally {
      setActionId(null);
    }
  }

  function exportExcel() {
    const rows = filteredItems.map((item) => ({
      "Transfer Number": item.transaction_number,
      "Date": item.transaction_date,
      "Status": item.status_label || item.status,
      "Source Account": item.treasury_account?.name || "",
      "Source Code": item.treasury_account?.code || "",
      "Destination Account": item.destination_account?.name || "",
      "Destination Code": item.destination_account?.code || "",
      "Amount": money(item.amount),
      "Currency": item.currency,
      "Reference": item.reference || "",
      "External Reference": item.external_reference || "",
      "Description": item.description || "",
      "Journal Entry": item.journal_entry_reference || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Treasury Transfers");
    XLSX.writeFile(workbook, `primey-treasury-transfers-${today()}.xlsx`);

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
      label: t.totalTransfers,
      value: formatNumber(stats.totalTransfers),
      icon: ArrowLeftRight,
      currency: false,
    },
    {
      label: t.confirmedTransfers,
      value: formatNumber(stats.confirmedTransfers),
      icon: CheckCircle2,
      currency: false,
    },
    {
      label: t.totalAmount,
      value: money(stats.totalAmount),
      icon: Wallet,
      currency: true,
    },
    {
      label: t.confirmedAmount,
      value: money(stats.confirmedAmount),
      icon: Building2,
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
                /system/treasury/transfers
              </Badge>
              <Badge className="rounded-full">{t.badge}</Badge>
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
              <Button asChild className="h-10 rounded-xl">
                <Link href="/system/treasury/transactions/create?transaction_type=TRANSFER">
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
            <CardTitle className="text-base">{t.listTitle}</CardTitle>
            <CardDescription>{t.listDescription}</CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid gap-3 lg:grid-cols-6">
              <div className="relative lg:col-span-2">
                <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t.search}
                  className="h-10 rounded-xl ltr:pl-9 rtl:pr-9"
                />
              </div>

              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as TransferStatus)}
                className="h-10 rounded-xl border bg-background px-3 text-sm"
              >
                <option value="ALL">{t.all}</option>
                <option value="DRAFT">{t.draft}</option>
                <option value="CONFIRMED">{t.confirmed}</option>
                <option value="CANCELLED">{t.cancelled}</option>
              </select>

              <select
                value={sourceAccountId}
                onChange={(event) => setSourceAccountId(event.target.value)}
                className="h-10 rounded-xl border bg-background px-3 text-sm"
              >
                <option value="ALL">{t.source}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={String(account.id)}>
                    {account.name} - {account.code}
                  </option>
                ))}
              </select>

              <select
                value={destinationAccountId}
                onChange={(event) => setDestinationAccountId(event.target.value)}
                className="h-10 rounded-xl border bg-background px-3 text-sm"
              >
                <option value="ALL">{t.destination}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={String(account.id)}>
                    {account.name} - {account.code}
                  </option>
                ))}
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

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => loadData(true)}
              >
                <RefreshCcw className="h-4 w-4" />
                {t.refresh}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={exportExcel}
                disabled={!filteredItems.length}
              >
                <Download className="h-4 w-4" />
                {t.exportExcel}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={printPage}
                disabled={!filteredItems.length}
              >
                <Printer className="h-4 w-4" />
                {t.print}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="print:block">
            <div>
              <CardTitle className="text-base">{t.listTitle}</CardTitle>
              <CardDescription>
                {t.listDescription} — {formatNumber(filteredItems.length)}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.loading}
              </div>
            ) : filteredItems.length ? (
              <div className="overflow-x-auto rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.transferNumber}</TableHead>
                      <TableHead>{t.transferDate}</TableHead>
                      <TableHead>{t.source}</TableHead>
                      <TableHead>{t.destination}</TableHead>
                      <TableHead>{t.amount}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead>{t.reference}</TableHead>
                      <TableHead className="print:hidden">{t.actions}</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {item.transaction_number}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.transaction_type_label || item.transaction_type}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell dir="ltr">{dateOnly(item.transaction_date)}</TableCell>

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
                              {item.destination_account?.name || t.notAvailable}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                              {item.destination_account?.code || "-"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div
                            className="flex items-center gap-2 font-semibold"
                            dir="ltr"
                          >
                            <Image src={SAR_ICON} alt="SAR" width={16} height={16} />
                            {money(item.amount)}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`rounded-full ${statusBadgeClass(item.status)}`}
                          >
                            {item.status_label || item.status}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="max-w-[180px] truncate">
                            {item.reference || item.external_reference || "-"}
                          </div>
                        </TableCell>

                        <TableCell className="print:hidden">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-xl"
                              >
                                {actionId === item.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent
                              align={isArabic ? "start" : "end"}
                              className="w-48"
                            >
                              <DropdownMenuLabel>{t.menu}</DropdownMenuLabel>

                              <DropdownMenuItem asChild>
                                <Link href={`/system/treasury/transactions/${item.id}`}>
                                  <Eye className="h-4 w-4" />
                                  {t.view}
                                </Link>
                              </DropdownMenuItem>

                              <DropdownMenuItem asChild>
                                <Link href={`/system/treasury/accounts/${item.treasury_account_id}/statement`}>
                                  <FileText className="h-4 w-4" />
                                  {t.source}
                                </Link>
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
                            </DropdownMenuContent>
                          </DropdownMenu>
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