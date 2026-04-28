"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  Building2,
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
  ShieldCheck,
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

type TreasuryAccountStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "CLOSED"
  | string;

type TreasuryBankAccount = {
  id: number | string;
  name: string;
  code: string;
  account_type: "BANK" | string;
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
  bank_name?: string;
  account_holder_name?: string;
  account_number?: string;
  iban?: string;
  branch_name?: string;
  description?: string;
  is_default?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

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

function normalizeBankAccount(item: unknown): TreasuryBankAccount {
  const row = (item || {}) as Record<string, unknown>;

  return {
    id: (row.id as number | string | undefined) || "",
    name: String(row.name || ""),
    code: String(row.code || ""),
    account_type: String(row.account_type || "BANK"),
    account_type_label: row.account_type_label
      ? String(row.account_type_label)
      : undefined,
    status: String(row.status || "ACTIVE"),
    status_label: row.status_label ? String(row.status_label) : undefined,
    ledger_account_id:
      row.ledger_account_id === undefined || row.ledger_account_id === null
        ? null
        : (row.ledger_account_id as number | string),
    ledger_account:
      row.ledger_account && typeof row.ledger_account === "object"
        ? (row.ledger_account as TreasuryBankAccount["ledger_account"])
        : null,
    opening_balance: String(row.opening_balance || "0.00"),
    current_balance: String(row.current_balance || "0.00"),
    currency: String(row.currency || "SAR"),
    bank_name: row.bank_name ? String(row.bank_name) : undefined,
    account_holder_name: row.account_holder_name
      ? String(row.account_holder_name)
      : undefined,
    account_number: row.account_number ? String(row.account_number) : undefined,
    iban: row.iban ? String(row.iban) : undefined,
    branch_name: row.branch_name ? String(row.branch_name) : undefined,
    description: row.description ? String(row.description) : undefined,
    is_default: Boolean(row.is_default),
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
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

function maskIban(value?: string) {
  if (!value) return "-";

  const clean = value.replace(/\s+/g, "");
  if (clean.length <= 8) return clean;

  return `${clean.slice(0, 4)} **** **** ${clean.slice(-4)}`;
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "الحسابات البنكية" : "Bank Accounts",
    subtitle: ar
      ? "إدارة الحسابات البنكية المرتبطة بالخزينة ومتابعة أرصدتها وحركاتها."
      : "Manage treasury bank accounts and track their balances and transactions.",
    back: ar ? "الخزينة" : "Treasury",
    allAccounts: ar ? "حسابات الخزينة" : "Treasury Accounts",
    transactions: ar ? "الحركات المالية" : "Transactions",
    createAccount: ar ? "إنشاء حساب بنكي" : "Create Bank Account",
    createTransaction: ar ? "إضافة حركة" : "Create Transaction",
    refresh: ar ? "تحديث" : "Refresh",
    export: ar ? "تصدير Excel" : "Export Excel",
    print: ar ? "طباعة" : "Print",
    search: ar
      ? "ابحث باسم الحساب أو البنك أو رقم الحساب أو IBAN..."
      : "Search by account name, bank, account number, or IBAN...",
    loading: ar ? "جاري تحميل الحسابات البنكية..." : "Loading bank accounts...",
    noData: ar ? "لا توجد حسابات بنكية." : "No bank accounts found.",
    apiError: ar
      ? "تعذر تحميل الحسابات البنكية."
      : "Unable to load bank accounts.",
    refreshed: ar ? "تم تحديث الحسابات البنكية" : "Bank accounts refreshed",
    exported: ar
      ? "تم تصدير الحسابات البنكية Excel"
      : "Bank accounts exported to Excel",
    actions: ar ? "الإجراءات" : "Actions",
    details: ar ? "عرض التفاصيل" : "View Details",
    statement: ar ? "كشف الحساب" : "Statement",
    defaultAccount: ar ? "افتراضي" : "Default",
    totalBalance: ar ? "إجمالي أرصدة البنوك" : "Total Bank Balance",
    activeBanks: ar ? "الحسابات النشطة" : "Active Bank Accounts",
    suspendedBanks: ar ? "الحسابات الموقوفة" : "Suspended Bank Accounts",
    defaultBanks: ar ? "الحسابات الافتراضية" : "Default Bank Accounts",
    selected: ar ? "صفوف محددة" : "selected rows",
    table: {
      account: ar ? "الحساب" : "Account",
      code: ar ? "الكود" : "Code",
      bankName: ar ? "البنك" : "Bank",
      holder: ar ? "صاحب الحساب" : "Holder",
      accountNumber: ar ? "رقم الحساب" : "Account Number",
      iban: ar ? "IBAN" : "IBAN",
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

function ledgerName(account: TreasuryBankAccount) {
  if (!account.ledger_account) return "-";

  const ledger = account.ledger_account;

  return `${ledger.code || ""} ${
    ledger.name_ar || ledger.name || ledger.name_en || ""
  }`.trim();
}

export default function TreasuryBanksPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<TreasuryBankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<
    "ALL" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "CLOSED"
  >("ALL");
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const filteredRows = useMemo(() => {
    const clean = query.trim().toLowerCase();

    return rows.filter((item) => {
      const matchesStatus = status === "ALL" || item.status === status;

      const text = [
        item.name,
        item.code,
        item.status,
        item.bank_name,
        item.account_holder_name,
        item.account_number,
        item.iban,
        item.branch_name,
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

    const activeBanks = rows.filter((item) => item.status === "ACTIVE").length;
    const suspendedBanks = rows.filter(
      (item) => item.status === "SUSPENDED",
    ).length;
    const defaultBanks = rows.filter((item) => item.is_default).length;

    return {
      totalBalance,
      activeBanks,
      suspendedBanks,
      defaultBanks,
    };
  }, [rows, filteredRows]);

  const allSelected =
    filteredRows.length > 0 &&
    filteredRows.every((item) => selectedIds.includes(item.id));

  async function loadRows(showToast = false) {
    try {
      setIsLoading(true);

      const response = await fetch(
        "/api/treasury/accounts/?page_size=500&account_type=BANK",
        {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.success === false || payload?.ok === false) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      setRows(toArray(payload).map(normalizeBankAccount));
      setSelectedIds([]);

      if (showToast) toast.success(t.refreshed);
    } catch (error) {
      console.error("Treasury banks load error:", error);
      setRows([]);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function exportExcel() {
    const data = filteredRows.map((item) => ({
      [t.table.code]: item.code,
      [t.table.account]: item.name,
      [t.table.bankName]: item.bank_name || "-",
      [t.table.holder]: item.account_holder_name || "-",
      [t.table.accountNumber]: item.account_number || "-",
      [t.table.iban]: item.iban || "-",
      [t.table.openingBalance]: money(item.opening_balance),
      [t.table.currentBalance]: money(item.current_balance),
      [t.table.status]:
        t.statuses[item.status as keyof typeof t.statuses] || item.status,
      [t.table.ledgerAccount]: ledgerName(item),
      [t.table.createdAt]: dateOnly(item.created_at),
      [t.table.description]: item.description || "-",
      [t.defaultAccount]: item.is_default ? "Yes" : "No",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);

    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 32 },
      { wch: 24 },
      { wch: 28 },
      { wch: 22 },
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
      locale === "ar" ? "الحسابات البنكية" : "Bank Accounts",
    );

    XLSX.writeFile(
      workbook,
      `primey-treasury-banks-${new Date().toISOString().slice(0, 10)}.xlsx`,
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
    loadRows(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    setSelectedIds([]);
  }, [query, status]);

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
                /system/treasury/banks
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
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/system/treasury">
                <ArrowLeft className="h-4 w-4" />
                {t.back}
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/system/treasury/accounts">
                <Wallet className="h-4 w-4" />
                {t.allAccounts}
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
                disabled={!filteredRows.length}
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

            <Can permission={PERMISSIONS.TREASURY_CREATE}>
              <Button asChild className="h-10 rounded-xl">
                <Link href="/system/treasury/accounts/create">
                  <PlusCircle className="h-4 w-4" />
                  {t.createAccount}
                </Link>
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
                  <div className="mt-2 flex items-center gap-2">
                    <Image
                      src="/currency/sar.svg"
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
                  <p className="text-sm text-muted-foreground">{t.activeBanks}</p>
                  <p className="mt-2 text-2xl font-bold">
                    {isLoading ? "..." : formatNumber(summary.activeBanks)}
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t.suspendedBanks}
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {isLoading ? "..." : formatNumber(summary.suspendedBanks)}
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
                  <p className="text-sm text-muted-foreground">{t.defaultBanks}</p>
                  <p className="mt-2 text-2xl font-bold">
                    {isLoading ? "..." : formatNumber(summary.defaultBanks)}
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Building2 className="h-5 w-5" />
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
                  <Building2 className="h-4 w-4" />
                  {t.title}
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
                  className={`h-10 rounded-xl ${isArabic ? "pr-10" : "pl-10"}`}
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

            <div
              id="treasury-banks-print-area"
              className="overflow-hidden rounded-lg border"
            >
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
                    <TableHead>{t.table.account}</TableHead>
                    <TableHead>{t.table.bankName}</TableHead>
                    <TableHead>{t.table.accountNumber}</TableHead>
                    <TableHead>{t.table.iban}</TableHead>
                    <TableHead>{t.table.currentBalance}</TableHead>
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
                              <Building2 className="h-5 w-5" />
                            </div>

                            <div>
                              <Link
                                href={`/system/treasury/accounts/${item.id}`}
                                className="font-medium hover:underline"
                              >
                                {item.code} - {item.name}
                              </Link>

                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                {item.is_default ? (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full text-xs"
                                  >
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

                        <TableCell>
                          <div>
                            <p className="font-medium">{item.bank_name || "-"}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.branch_name || "-"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {item.account_number || "-"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.account_holder_name || "-"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell className="font-medium">
                          {maskIban(item.iban)}
                        </TableCell>

                        <TableCell>
                          <span
                            className="flex items-center gap-2 font-bold"
                            dir="ltr"
                          >
                            <Image
                              src="/currency/sar.svg"
                              alt="SAR"
                              width={15}
                              height={15}
                            />
                            {money(item.current_balance)}
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
                                  <Link href={`/system/treasury/accounts/${item.id}`}>
                                    <Eye className="h-4 w-4" />
                                    {t.details}
                                  </Link>
                                </DropdownMenuItem>

                                <Can
                                  anyPermissions={[
                                    PERMISSIONS.TREASURY_VIEW,
                                    PERMISSIONS.REPORTS_VIEW,
                                  ]}
                                >
                                  <DropdownMenuItem asChild>
                                    <Link
                                      href={`/system/treasury/accounts/${item.id}/statement`}
                                    >
                                      <FileText className="h-4 w-4" />
                                      {t.statement}
                                    </Link>
                                  </DropdownMenuItem>
                                </Can>

                                <Can permission={PERMISSIONS.TREASURY_CREATE}>
                                  <DropdownMenuItem asChild>
                                    <Link href="/system/treasury/transactions/create">
                                      <CreditCard className="h-4 w-4" />
                                      {t.createTransaction}
                                    </Link>
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
                      <TableCell
                        colSpan={8}
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
              {formatNumber(selectedIds.length)} / {formatNumber(filteredRows.length)}{" "}
              {t.selected}
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}