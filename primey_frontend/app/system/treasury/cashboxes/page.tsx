"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  Banknote,
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
  ShieldCheck,
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
type AccountStatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "CLOSED";

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

type LedgerAccount = {
  id?: number | string;
  code?: string;
  name?: string;
  name_ar?: string;
  name_en?: string;
  is_group?: boolean;
};

type TreasuryCashbox = {
  id: number | string;
  name: string;
  code: string;
  account_type: string;
  account_type_label?: string;
  status: string;
  status_label?: string;
  ledger_account?: LedgerAccount | null;
  ledger_account_id?: number | string | null;
  opening_balance: string;
  current_balance: string;
  currency: string;
  description?: string;
  is_default?: boolean;
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

function normalizeCashbox(item: unknown): TreasuryCashbox {
  const row = (item || {}) as Record<string, unknown>;

  return {
    id: (row.id as number | string | undefined) || "",
    name: String(row.name || ""),
    code: String(row.code || ""),
    account_type: String(row.account_type || "CASHBOX"),
    account_type_label: row.account_type_label
      ? String(row.account_type_label)
      : undefined,
    status: String(row.status || ""),
    status_label: row.status_label ? String(row.status_label) : undefined,
    ledger_account:
      row.ledger_account && typeof row.ledger_account === "object"
        ? (row.ledger_account as LedgerAccount)
        : null,
    ledger_account_id: row.ledger_account_id as number | string | null | undefined,
    opening_balance: String(row.opening_balance || "0.00"),
    current_balance: String(row.current_balance || "0.00"),
    currency: String(row.currency || "SAR"),
    description: row.description ? String(row.description) : "",
    is_default: Boolean(row.is_default),
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

function today() {
  return new Date().toISOString().slice(0, 10);
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
      ? "إدارة ومتابعة الصناديق النقدية وأرصدة الكاش المرتبطة بالخزينة."
      : "Manage and monitor cashboxes and cash balances linked to treasury.",
    badge: ar ? "CASHBOX" : "CASHBOX",
    back: ar ? "الرجوع للخزينة" : "Back to Treasury",
    refresh: ar ? "تحديث" : "Refresh",
    create: ar ? "إنشاء صندوق" : "Create Cashbox",
    search: ar ? "بحث باسم الصندوق أو الكود أو الوصف" : "Search by cashbox name, code, or description",
    status: ar ? "الحالة" : "Status",
    all: ar ? "الكل" : "All",
    active: ar ? "نشط" : "Active",
    inactive: ar ? "غير نشط" : "Inactive",
    suspended: ar ? "موقوف" : "Suspended",
    closed: ar ? "مغلق" : "Closed",
    exportExcel: ar ? "تصدير Excel" : "Export Excel",
    print: ar ? "طباعة Web PDF" : "Web PDF Print",
    totalCashboxes: ar ? "إجمالي الصناديق" : "Total Cashboxes",
    activeCashboxes: ar ? "الصناديق النشطة" : "Active Cashboxes",
    defaultCashboxes: ar ? "الصناديق الافتراضية" : "Default Cashboxes",
    totalBalance: ar ? "إجمالي أرصدة الكاش" : "Total Cash Balance",
    openingBalance: ar ? "إجمالي الرصيد الافتتاحي" : "Total Opening Balance",
    listTitle: ar ? "قائمة الصناديق النقدية" : "Cashboxes List",
    listDescription: ar
      ? "الصناديق هي حسابات خزينة من نوع CASHBOX وتستخدم للمدفوعات النقدية والتحصيل المباشر."
      : "Cashboxes are treasury accounts of type CASHBOX used for cash receipts and direct collection.",
    name: ar ? "اسم الصندوق" : "Cashbox Name",
    code: ar ? "الكود" : "Code",
    currentBalance: ar ? "الرصيد الحالي" : "Current Balance",
    ledgerAccount: ar ? "الحساب المحاسبي" : "Ledger Account",
    defaultAccount: ar ? "افتراضي" : "Default",
    createdAt: ar ? "تاريخ الإنشاء" : "Created At",
    actions: ar ? "الإجراءات" : "Actions",
    menu: ar ? "خيارات الصندوق" : "Cashbox Options",
    view: ar ? "عرض التفاصيل" : "View Details",
    statement: ar ? "كشف الحساب" : "Statement",
    deactivate: ar ? "تعطيل الصندوق" : "Deactivate Cashbox",
    noData: ar ? "لا توجد صناديق مطابقة." : "No matching cashboxes.",
    loading: ar ? "جاري تحميل الصناديق..." : "Loading cashboxes...",
    apiError: ar ? "تعذر تحميل الصناديق النقدية." : "Unable to load cashboxes.",
    refreshed: ar ? "تم تحديث الصناديق النقدية." : "Cashboxes refreshed.",
    exported: ar ? "تم تصدير ملف Excel." : "Excel file exported.",
    actionSuccess: ar ? "تم تحديث حالة الصندوق بنجاح." : "Cashbox status updated successfully.",
    actionError: ar ? "تعذر تنفيذ العملية." : "Unable to complete action.",
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
    throw new Error(payload?.message || `HTTP ${response.status}`);
  }

  return payload as T;
}

function statusBadgeClass(status: string) {
  if (status === "ACTIVE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
  }

  if (status === "INACTIVE") {
    return "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300";
  }

  if (status === "SUSPENDED") {
    return "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300";
  }

  return "border-red-200 bg-red-50 text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-red-950 dark:text-red-300";
}

export default function TreasuryCashboxesPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [items, setItems] = useState<TreasuryCashbox[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | number | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AccountStatusFilter>("ALL");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const filteredItems = useMemo(() => {
    const clean = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesStatus = status === "ALL" || item.status === status;

      const text = [
        item.name,
        item.code,
        item.description,
        item.status,
        item.status_label,
        item.ledger_account?.code,
        item.ledger_account?.name,
        item.ledger_account?.name_ar,
        item.ledger_account?.name_en,
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!clean || text.includes(clean));
    });
  }, [items, search, status]);

  const stats = useMemo(() => {
    const activeItems = filteredItems.filter((item) => item.status === "ACTIVE");
    const defaultItems = filteredItems.filter((item) => item.is_default);

    const totalBalance = filteredItems.reduce(
      (sum, item) => sum + toNumber(item.current_balance),
      0,
    );

    const openingBalance = filteredItems.reduce(
      (sum, item) => sum + toNumber(item.opening_balance),
      0,
    );

    return {
      totalCashboxes: toNumber(summary.total_accounts || filteredItems.length),
      activeCashboxes: activeItems.length,
      defaultCashboxes: defaultItems.length,
      totalBalance,
      openingBalance,
    };
  }, [filteredItems, summary]);

  async function loadData(showToast = false) {
    try {
      setIsLoading(true);

      const params = new URLSearchParams();
      params.set("page_size", "100");

      if (status !== "ALL") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());

      const payload = await fetchJson<unknown>(
        `/api/treasury/cashboxes/?${params.toString()}`,
      );

      setItems(toArray<unknown>(payload).map(normalizeCashbox));
      setSummary(getPayloadSummary(payload));

      if (showToast) toast.success(t.refreshed);
    } catch (error) {
      console.error("Treasury cashboxes load error:", error);
      setItems([]);
      setSummary({});
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  async function deactivateCashbox(item: TreasuryCashbox) {
    try {
      setActionId(item.id);

      await fetchJson(`/api/treasury/accounts/${item.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "INACTIVE",
        }),
      });

      toast.success(t.actionSuccess);
      await loadData(false);
    } catch (error) {
      console.error("Deactivate cashbox error:", error);
      toast.error(t.actionError);
    } finally {
      setActionId(null);
    }
  }

  function exportExcel() {
    const rows = filteredItems.map((item) => ({
      "Code": item.code,
      "Name": item.name,
      "Status": item.status_label || item.status,
      "Opening Balance": money(item.opening_balance),
      "Current Balance": money(item.current_balance),
      "Currency": item.currency,
      "Default": item.is_default ? "Yes" : "No",
      "Ledger Account": item.ledger_account?.code || "",
      "Description": item.description || "",
      "Created At": item.created_at || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 30 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 22 },
      { wch: 40 },
      { wch: 24 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Cashboxes");
    XLSX.writeFile(workbook, `primey-treasury-cashboxes-${today()}.xlsx`);

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
      label: t.totalCashboxes,
      value: formatNumber(stats.totalCashboxes),
      icon: Wallet,
      currency: false,
    },
    {
      label: t.activeCashboxes,
      value: formatNumber(stats.activeCashboxes),
      icon: CheckCircle2,
      currency: false,
    },
    {
      label: t.totalBalance,
      value: money(stats.totalBalance),
      icon: Banknote,
      currency: true,
    },
    {
      label: t.openingBalance,
      value: money(stats.openingBalance),
      icon: ShieldCheck,
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
                /system/treasury/cashboxes
              </Badge>
              <Badge className="rounded-full">{t.badge}</Badge>
              <Badge variant="outline" className="rounded-full">
                {formatNumber(filteredItems.length)}
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
                disabled={!filteredItems.length}
                onClick={exportExcel}
              >
                <Download className="h-4 w-4" />
                {t.exportExcel}
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
                disabled={!filteredItems.length}
                onClick={printPage}
              >
                <Printer className="h-4 w-4" />
                {t.print}
              </Button>
            </Can>

            <Can permission={PERMISSIONS.TREASURY_CREATE}>
              <Button asChild className="h-10 rounded-xl">
                <Link href="/system/treasury/accounts/create?account_type=CASHBOX">
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
            <CardTitle className="text-base">{t.listTitle}</CardTitle>
            <CardDescription>{t.listDescription}</CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid gap-3 lg:grid-cols-4">
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
                onChange={(event) =>
                  setStatus(event.target.value as AccountStatusFilter)
                }
                className="h-10 rounded-xl border bg-background px-3 text-sm"
              >
                <option value="ALL">{t.all}</option>
                <option value="ACTIVE">{t.active}</option>
                <option value="INACTIVE">{t.inactive}</option>
                <option value="SUSPENDED">{t.suspended}</option>
                <option value="CLOSED">{t.closed}</option>
              </select>

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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="print:block">
            <CardTitle className="text-base">{t.listTitle}</CardTitle>
            <CardDescription>
              {t.listDescription} — {formatNumber(filteredItems.length)}
            </CardDescription>
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
                      <TableHead>{t.name}</TableHead>
                      <TableHead>{t.code}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead>{t.currentBalance}</TableHead>
                      <TableHead>{t.openingBalance}</TableHead>
                      <TableHead>{t.ledgerAccount}</TableHead>
                      <TableHead>{t.createdAt}</TableHead>
                      <TableHead className="print:hidden">{t.actions}</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{item.name}</p>
                              {item.is_default ? (
                                <Badge className="rounded-full">
                                  {t.defaultAccount}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.description || item.account_type_label || "CASHBOX"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell dir="ltr">{item.code}</TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`rounded-full ${statusBadgeClass(item.status)}`}
                          >
                            {item.status_label || item.status}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2 font-semibold" dir="ltr">
                            <Image src={SAR_ICON} alt="SAR" width={16} height={16} />
                            {money(item.current_balance)}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2" dir="ltr">
                            <Image src={SAR_ICON} alt="SAR" width={16} height={16} />
                            {money(item.opening_balance)}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>
                            <p className="font-medium" dir="ltr">
                              {item.ledger_account?.code || "-"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {isArabic
                                ? item.ledger_account?.name_ar ||
                                  item.ledger_account?.name ||
                                  "-"
                                : item.ledger_account?.name_en ||
                                  item.ledger_account?.name ||
                                  "-"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell dir="ltr">{dateOnly(item.created_at)}</TableCell>

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
                                <Link href={`/system/treasury/accounts/${item.id}`}>
                                  <Eye className="h-4 w-4" />
                                  {t.view}
                                </Link>
                              </DropdownMenuItem>

                              <DropdownMenuItem asChild>
                                <Link href={`/system/treasury/accounts/${item.id}/statement`}>
                                  <FileText className="h-4 w-4" />
                                  {t.statement}
                                </Link>
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <Can permission={PERMISSIONS.TREASURY_EDIT}>
                                <DropdownMenuItem
                                  disabled={
                                    item.status !== "ACTIVE" ||
                                    actionId === item.id
                                  }
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    deactivateCashbox(item);
                                  }}
                                >
                                  <XCircle className="h-4 w-4" />
                                  {t.deactivate}
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