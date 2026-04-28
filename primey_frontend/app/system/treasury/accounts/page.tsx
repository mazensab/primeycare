"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Banknote,
  Building2,
  Download,
  Eye,
  Loader2,
  MoreHorizontal,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Can } from "@/components/guards/Can";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
type AccountType = "ALL" | "CASHBOX" | "BANK";
type AccountStatus = "ALL" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "CLOSED";

type Account = {
  id: number | string;
  name: string;
  code: string;
  account_type: AccountType;
  account_type_label?: string;
  status: AccountStatus;
  status_label?: string;
  opening_balance: string;
  current_balance: string;
  currency: string;
  bank_name?: string;
  iban?: string;
  is_default?: boolean;
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

function normalizeAccountType(value: unknown): AccountType {
  const accountType = String(value || "").toUpperCase();

  if (accountType === "CASHBOX") return "CASHBOX";
  if (accountType === "BANK") return "BANK";

  return "CASHBOX";
}

function normalizeAccountStatus(value: unknown): AccountStatus {
  const status = String(value || "").toUpperCase();

  if (status === "ACTIVE") return "ACTIVE";
  if (status === "INACTIVE") return "INACTIVE";
  if (status === "SUSPENDED") return "SUSPENDED";
  if (status === "CLOSED") return "CLOSED";

  return "ACTIVE";
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

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function normalizeAccount(item: unknown): Account {
  const row = (item || {}) as Record<string, unknown>;

  return {
    id: (row.id as number | string | undefined) || "",
    name: String(row.name || ""),
    code: String(row.code || ""),
    account_type: normalizeAccountType(row.account_type),
    account_type_label: row.account_type_label
      ? String(row.account_type_label)
      : undefined,
    status: normalizeAccountStatus(row.status),
    status_label: row.status_label ? String(row.status_label) : undefined,
    opening_balance: String(row.opening_balance || "0.00"),
    current_balance: String(row.current_balance || "0.00"),
    currency: String(row.currency || "SAR"),
    bank_name: row.bank_name ? String(row.bank_name) : undefined,
    iban: row.iban ? String(row.iban) : undefined,
    is_default: Boolean(row.is_default),
  };
}

function money(value: string | number) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "حسابات الخزينة" : "Treasury Accounts",
    subtitle: ar
      ? "إدارة الصناديق والحسابات البنكية وأرصدة الخزينة."
      : "Manage cashboxes, bank accounts, and balances.",
    back: ar ? "الخزينة" : "Treasury",
    create: ar ? "إنشاء حساب" : "Create Account",
    refresh: ar ? "تحديث" : "Refresh",
    export: ar ? "تصدير Excel" : "Export Excel",
    print: ar ? "طباعة" : "Print",
    search: ar
      ? "ابحث بالاسم أو الكود أو البنك أو IBAN..."
      : "Search by name, code, bank, or IBAN...",
    loading: ar ? "جاري تحميل الحسابات..." : "Loading accounts...",
    noData: ar ? "لا توجد حسابات." : "No accounts.",
    apiError: ar ? "تعذر تحميل حسابات الخزينة." : "Unable to load accounts.",
    refreshed: ar ? "تم تحديث الحسابات" : "Accounts refreshed",
    exported: ar ? "تم تصدير Excel" : "Excel exported",
    actions: ar ? "الإجراءات" : "Actions",
    details: ar ? "عرض التفاصيل" : "View Details",
    statement: ar ? "كشف الحساب" : "Statement",
    all: ar ? "الكل" : "All",
    table: {
      account: ar ? "الحساب" : "Account",
      code: ar ? "الكود" : "Code",
      type: ar ? "النوع" : "Type",
      balance: ar ? "الرصيد الحالي" : "Current Balance",
      status: ar ? "الحالة" : "Status",
      bank: ar ? "البنك" : "Bank",
      default: ar ? "افتراضي" : "Default",
    },
    types: {
      ALL: ar ? "الكل" : "All",
      CASHBOX: ar ? "صندوق نقدي" : "Cashbox",
      BANK: ar ? "حساب بنكي" : "Bank Account",
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

export default function TreasuryAccountsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [rows, setRows] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<AccountType>("ALL");
  const [status, setStatus] = useState<AccountStatus>("ALL");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const filtered = useMemo(() => {
    const clean = query.toLowerCase().trim();

    return rows.filter((item) => {
      const matchesType = type === "ALL" || item.account_type === type;
      const matchesStatus = status === "ALL" || item.status === status;

      const text = [
        item.name,
        item.code,
        item.bank_name,
        item.iban,
        item.account_type,
        item.status,
      ]
        .join(" ")
        .toLowerCase();

      return matchesType && matchesStatus && (!clean || text.includes(clean));
    });
  }, [rows, query, type, status]);

  async function loadRows(showToast = false) {
    try {
      setIsLoading(true);

      const response = await fetch("/api/treasury/accounts/?page_size=100", {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json();
      setRows(toArray(payload).map(normalizeAccount));

      if (showToast) toast.success(t.refreshed);
    } catch (error) {
      console.error("Treasury accounts load error:", error);
      setRows([]);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function exportExcel() {
    const data = filtered.map((item) => ({
      [t.table.code]: item.code,
      [t.table.account]: item.name,
      [t.table.type]: t.types[item.account_type] || item.account_type,
      [t.table.balance]: money(item.current_balance),
      [t.table.status]: t.statuses[item.status] || item.status,
      [t.table.bank]: item.bank_name || "-",
      [t.table.default]: item.is_default ? "Yes" : "No",
    }));

    const ws = XLSX.utils.json_to_sheet(data);

    ws["!cols"] = [
      { wch: 18 },
      { wch: 32 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 24 },
      { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      locale === "ar" ? "حسابات الخزينة" : "Treasury Accounts",
    );

    XLSX.writeFile(
      wb,
      `primey-treasury-accounts-${new Date().toISOString().slice(0, 10)}.xlsx`,
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
                /system/treasury/accounts
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
                disabled={!filtered.length}
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
                  className={`h-10 rounded-xl ${
                    isArabic ? "pr-10" : "pl-10"
                  }`}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(["ALL", "CASHBOX", "BANK"] as AccountType[]).map((item) => (
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

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "ALL",
                    "ACTIVE",
                    "INACTIVE",
                    "SUSPENDED",
                    "CLOSED",
                  ] as AccountStatus[]
                ).map((item) => (
                  <Button
                    key={item}
                    variant={status === item ? "default" : "outline"}
                    className="h-10 rounded-xl"
                    onClick={() => setStatus(item)}
                  >
                    {t.statuses[item]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.table.account}</TableHead>
                    <TableHead>{t.table.code}</TableHead>
                    <TableHead>{t.table.type}</TableHead>
                    <TableHead>{t.table.balance}</TableHead>
                    <TableHead>{t.table.status}</TableHead>
                    <TableHead>{t.table.bank}</TableHead>
                    <TableHead>{t.actions}</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-28 text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.loading}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filtered.length ? (
                    filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                              {item.account_type === "BANK" ? (
                                <Building2 className="h-5 w-5" />
                              ) : (
                                <Banknote className="h-5 w-5" />
                              )}
                            </div>

                            <div>
                              <p className="font-medium">{item.name}</p>
                              {item.is_default ? (
                                <p className="text-muted-foreground text-xs">
                                  {t.table.default}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="font-medium">{item.code}</TableCell>

                        <TableCell>
                          <Badge variant="secondary" className="rounded-full">
                            {t.types[item.account_type] || item.account_type}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <span className="flex items-center gap-2 font-semibold" dir="ltr">
                            <Image
                              src="/currency/sar.svg"
                              alt="SAR"
                              width={16}
                              height={16}
                            />
                            {money(item.current_balance)}
                          </span>
                        </TableCell>

                        <TableCell>
                          <Badge className="rounded-full">
                            {t.statuses[item.status] || item.status}
                          </Badge>
                        </TableCell>

                        <TableCell>{item.bank_name || "-"}</TableCell>

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
                                      <Wallet className="h-4 w-4" />
                                      {t.statement}
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
                      <TableCell colSpan={7} className="h-28 text-center">
                        {t.noData}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}