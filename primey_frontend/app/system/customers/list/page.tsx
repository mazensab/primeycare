"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowDownUp,
  Building2,
  ColumnsIcon,
  Download,
  Eye,
  FileText,
  Loader2,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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

/* ============================================================
   📂 app/system/customers/list/page.tsx
   🧠 Primey Care | Customers List
   ------------------------------------------------------------
   ✅ تصدير Excel للقائمة فقط
   ✅ طباعة / Web PDF للقائمة فقط
   ✅ لا يطبع الهيدر أو البطاقات أو الفلاتر
   ✅ نفس أسلوب قائمة المراكز
============================================================ */

type AppLocale = "ar" | "en";

type CustomerStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "BLOCKED"
  | "LEAD"
  | "UNKNOWN";

type CustomerType = "INDIVIDUAL" | "CORPORATE" | "UNKNOWN";

type StatusFilter = "ALL" | CustomerStatus;
type TypeFilter = "ALL" | CustomerType;

type SortKey = "name" | "code" | "customerType" | "city" | "status";
type SortDirection = "asc" | "desc";

type Customer = {
  id: number | string;
  name: string;
  code: string;
  customerType: CustomerType;
  status: CustomerStatus;
  source: string;
  email: string;
  phone: string;
  whatsapp: string;
  primaryContact: string;
  city: string;
  district: string;
  nationalId: string;
  nationality: string;
  createdAt: string;
  updatedAt: string;
};

type CustomersApiResponse = {
  ok?: boolean;
  message?: string;
  results?: unknown[];
  customers?: unknown[];
  data?: unknown[] | { results?: unknown[]; customers?: unknown[] };
  count?: number;
};

type VisibleColumns = {
  select: boolean;
  customer: boolean;
  code: boolean;
  customerType: boolean;
  city: boolean;
  contact: boolean;
  status: boolean;
  source: boolean;
  actions: boolean;
};

const PAGE_SIZE = 10;

function readLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const savedLocale = window.localStorage.getItem("primey-locale");
    if (savedLocale === "en") return "en";
    if (savedLocale === "ar") return "ar";

    return document.documentElement.lang === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

function applyDocumentLocale(locale: AppLocale) {
  if (typeof document === "undefined") return;

  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  document.body.dir = locale === "ar" ? "rtl" : "ltr";
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "قائمة العملاء" : "Customers",
    addCustomer: ar ? "إضافة عميل" : "Add Customer",
    refresh: ar ? "تحديث" : "Refresh",
    export: ar ? "تصدير Excel" : "Export Excel",
    printPdf: ar ? "طباعة / Web PDF" : "Print / Web PDF",
    columns: ar ? "الأعمدة" : "Columns",
    search: ar ? "ابحث في العملاء..." : "Search customers...",
    all: ar ? "الكل" : "All",

    totalCustomers: ar ? "إجمالي العملاء" : "Total Customers",
    activeCustomers: ar ? "العملاء النشطون" : "Active Customers",
    corporateCustomers: ar ? "عملاء الشركات" : "Corporate Customers",
    leadCustomers: ar ? "العملاء المحتملون" : "Lead Customers",

    customersData: ar ? "بيانات العملاء" : "Customers Data",
    customersDataDesc: ar
      ? "جدول العملاء مرتبط مباشرة بواجهة customers API."
      : "Customers table connected directly to customers API.",

    selectedRows: ar ? "صفوف محددة" : "row(s) selected",
    previous: ar ? "السابق" : "Previous",
    next: ar ? "التالي" : "Next",
    loading: ar ? "جاري تحميل العملاء..." : "Loading customers...",
    noResults: ar ? "لا توجد نتائج." : "No results.",

    actions: ar ? "الإجراءات" : "Actions",
    viewDetails: ar ? "عرض التفاصيل" : "View details",
    statement: ar ? "كشف الحساب" : "Statement",
    copyCode: ar ? "نسخ كود العميل" : "Copy customer code",
    copyId: ar ? "نسخ المعرف" : "Copy ID",

    loadError: ar ? "تعذر تحميل قائمة العملاء." : "Failed to load customers.",
    refreshSuccess: ar
      ? "تم تحديث قائمة العملاء بنجاح."
      : "Customers refreshed successfully.",
    exportSuccess: ar
      ? "تم تصدير القائمة بنجاح."
      : "List exported successfully.",
    printReady: ar
      ? "تم تجهيز نافذة الطباعة للقائمة فقط."
      : "Print window prepared for the list only.",
    copied: ar ? "تم النسخ بنجاح." : "Copied successfully.",

    active: ar ? "نشط" : "Active",
    inactive: ar ? "غير نشط" : "Inactive",
    blocked: ar ? "محظور" : "Blocked",
    lead: ar ? "محتمل" : "Lead",
    unknown: ar ? "غير محدد" : "Unknown",

    individual: ar ? "فرد" : "Individual",
    corporate: ar ? "شركة" : "Corporate",

    table: {
      customer: ar ? "العميل" : "Customer",
      code: ar ? "الكود" : "Code",
      customerType: ar ? "النوع" : "Type",
      city: ar ? "المدينة" : "City",
      contact: ar ? "التواصل" : "Contact",
      status: ar ? "الحالة" : "Status",
      source: ar ? "المصدر" : "Source",
      actions: ar ? "الإجراء" : "Action",
    },

    print: {
      title: ar ? "قائمة العملاء" : "Customers List",
      generatedAt: ar ? "تاريخ الطباعة" : "Printed At",
      scope: ar ? "النطاق" : "Scope",
      filteredOnly: ar ? "القائمة حسب الفلاتر الحالية فقط" : "Current filtered list only",
      totalRows: ar ? "عدد السجلات" : "Rows Count",
    },
  };
}

function pickString(
  obj: Record<string, unknown>,
  keys: string[],
  fallback = "",
) {
  for (const key of keys) {
    const value = obj[key];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      return String(value).trim();
    }
  }

  return fallback;
}

function normalizeApiList(payload: CustomersApiResponse | unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  const data = payload as CustomersApiResponse;

  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.customers)) return data.customers;
  if (Array.isArray(data.data)) return data.data;

  if (data.data && typeof data.data === "object") {
    const nested = data.data as {
      results?: unknown[];
      customers?: unknown[];
    };

    if (Array.isArray(nested.results)) return nested.results;
    if (Array.isArray(nested.customers)) return nested.customers;
  }

  return [];
}

function normalizeStatus(value: unknown): CustomerStatus {
  const status = String(value || "").toUpperCase();

  if (status === "ACTIVE") return "ACTIVE";
  if (status === "INACTIVE") return "INACTIVE";
  if (status === "BLOCKED") return "BLOCKED";
  if (status === "LEAD") return "LEAD";

  return "UNKNOWN";
}

function normalizeCustomerType(value: unknown): CustomerType {
  const type = String(value || "").toUpperCase();

  if (type === "INDIVIDUAL") return "INDIVIDUAL";
  if (type === "CORPORATE") return "CORPORATE";

  return "UNKNOWN";
}

function normalizeCustomer(item: unknown): Customer {
  const obj = (item || {}) as Record<string, unknown>;

  const firstName = pickString(obj, ["first_name", "firstName"]);
  const lastName = pickString(obj, ["last_name", "lastName"]);
  const companyName = pickString(obj, ["company_name", "companyName"]);

  const customerType = normalizeCustomerType(
    obj.customer_type ?? obj.customerType,
  );

  const fallbackName =
    customerType === "CORPORATE"
      ? companyName
      : `${firstName} ${lastName}`.trim();

  const email = pickString(obj, ["email"]);
  const phone = pickString(obj, ["phone_number", "phoneNumber", "phone"]);
  const whatsapp = pickString(obj, [
    "whatsapp_number",
    "whatsappNumber",
    "whatsapp",
  ]);

  return {
    id: (obj.id ?? obj.pk ?? "-") as number | string,
    name: pickString(
      obj,
      ["display_name", "displayName", "name", "full_name", "fullName"],
      fallbackName || "-",
    ),
    code: pickString(obj, ["customer_code", "customerCode", "code"], "-"),
    customerType,
    status: normalizeStatus(obj.status),
    source: pickString(obj, ["source"], "-"),
    email,
    phone,
    whatsapp,
    primaryContact:
      pickString(obj, ["primary_contact_number", "primaryContactNumber"]) ||
      whatsapp ||
      phone ||
      email,
    city: pickString(obj, ["city"], "-"),
    district: pickString(obj, ["district"], ""),
    nationalId: pickString(obj, ["national_id", "nationalId"], ""),
    nationality: pickString(obj, ["nationality"], ""),
    createdAt: pickString(obj, ["created_at", "createdAt"], ""),
    updatedAt: pickString(obj, ["updated_at", "updatedAt"], ""),
  };
}

function statusLabel(status: CustomerStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<CustomerStatus, string> = {
    ACTIVE: t.active,
    INACTIVE: t.inactive,
    BLOCKED: t.blocked,
    LEAD: t.lead,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function typeLabel(type: CustomerType, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<CustomerType, string> = {
    INDIVIDUAL: t.individual,
    CORPORATE: t.corporate,
    UNKNOWN: t.unknown,
  };

  return labels[type];
}

function statusBadge(status: CustomerStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

  if (status === "ACTIVE") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50">
        {label}
      </Badge>
    );
  }

  if (status === "LEAD") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50">
        {label}
      </Badge>
    );
  }

  if (status === "BLOCKED") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {label}
    </Badge>
  );
}

function safeSheetName(name: string) {
  return name.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Report";
}

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildPrintHtml({
  title,
  locale,
  rows,
  t,
}: {
  title: string;
  locale: AppLocale;
  rows: Customer[];
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString(isArabic ? "ar-SA" : "en-US");

  const tableRows = rows
    .map(
      (customer, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(customer.code)}</td>
          <td>${escapeHtml(customer.name)}</td>
          <td>${escapeHtml(typeLabel(customer.customerType, locale))}</td>
          <td>${escapeHtml(customer.city || "-")}</td>
          <td>${escapeHtml(customer.primaryContact || "-")}</td>
          <td>${escapeHtml(statusLabel(customer.status, locale))}</td>
          <td>${escapeHtml(customer.source || "-")}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 24px;
            font-family: Arial, Tahoma, sans-serif;
            color: #111827;
            background: #ffffff;
          }

          .print-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 18px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 14px;
          }

          h1 {
            margin: 0;
            font-size: 22px;
            font-weight: 800;
          }

          .meta {
            margin-top: 8px;
            color: #6b7280;
            font-size: 12px;
            line-height: 1.8;
          }

          .badge {
            display: inline-block;
            border: 1px solid #d1d5db;
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 12px;
            color: #374151;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }

          th {
            background: #f3f4f6;
            color: #111827;
            font-weight: 700;
          }

          th,
          td {
            border: 1px solid #e5e7eb;
            padding: 9px 8px;
            text-align: ${isArabic ? "right" : "left"};
            vertical-align: top;
          }

          tr:nth-child(even) td {
            background: #fafafa;
          }

          @page {
            size: A4 landscape;
            margin: 12mm;
          }

          @media print {
            body {
              padding: 0;
            }

            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>

      <body>
        <div class="print-header">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">
              <div>${escapeHtml(t.print.generatedAt)}: ${escapeHtml(now)}</div>
              <div>${escapeHtml(t.print.scope)}: ${escapeHtml(t.print.filteredOnly)}</div>
              <div>${escapeHtml(t.print.totalRows)}: ${rows.length}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.table.code)}</th>
              <th>${escapeHtml(t.table.customer)}</th>
              <th>${escapeHtml(t.table.customerType)}</th>
              <th>${escapeHtml(t.table.city)}</th>
              <th>${escapeHtml(t.table.contact)}</th>
              <th>${escapeHtml(t.table.status)}</th>
              <th>${escapeHtml(t.table.source)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              tableRows ||
              `<tr><td colspan="8">${escapeHtml(t.noResults)}</td></tr>`
            }
          </tbody>
        </table>

        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `;
}

export default function SystemCustomersListPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [pageIndex, setPageIndex] = useState(0);

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    select: true,
    customer: true,
    code: true,
    customerType: true,
    city: true,
    contact: true,
    status: true,
    source: true,
    actions: true,
  });

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const statusOptions = useMemo(
    () => [
      { value: "ALL" as StatusFilter, label: t.all },
      { value: "ACTIVE" as StatusFilter, label: t.active },
      { value: "LEAD" as StatusFilter, label: t.lead },
      { value: "BLOCKED" as StatusFilter, label: t.blocked },
      { value: "INACTIVE" as StatusFilter, label: t.inactive },
    ],
    [t],
  );

  const typeOptions = useMemo(
    () => [
      { value: "ALL" as TypeFilter, label: t.all },
      { value: "INDIVIDUAL" as TypeFilter, label: t.individual },
      { value: "CORPORATE" as TypeFilter, label: t.corporate },
    ],
    [t],
  );

  const stats = useMemo(() => {
    return {
      total: customers.length,
      active: customers.filter((item) => item.status === "ACTIVE").length,
      corporate: customers.filter((item) => item.customerType === "CORPORATE")
        .length,
      lead: customers.filter((item) => item.status === "LEAD").length,
    };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    const rows = customers.filter((customer) => {
      const matchesSearch =
        !cleanQuery ||
        [
          customer.name,
          customer.code,
          customer.email,
          customer.phone,
          customer.whatsapp,
          customer.primaryContact,
          customer.city,
          customer.source,
          customer.nationalId,
        ]
          .join(" ")
          .toLowerCase()
          .includes(cleanQuery);

      const matchesStatus =
        statusFilter === "ALL" || customer.status === statusFilter;

      const matchesType =
        typeFilter === "ALL" || customer.customerType === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });

    return rows.sort((a, b) => {
      const first = String(a[sortKey] ?? "").toLowerCase();
      const second = String(b[sortKey] ?? "").toLowerCase();

      if (first < second) return sortDirection === "asc" ? -1 : 1;
      if (first > second) return sortDirection === "asc" ? 1 : -1;

      return 0;
    });
  }, [customers, query, statusFilter, typeFilter, sortKey, sortDirection]);

  const exportRows = useMemo(() => {
    if (selectedIds.length > 0) {
      return filteredCustomers.filter((customer) =>
        selectedIds.includes(customer.id),
      );
    }

    return filteredCustomers;
  }, [filteredCustomers, selectedIds]);

  const pageCount = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));

  const pageRows = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return filteredCustomers.slice(start, start + PAGE_SIZE);
  }, [filteredCustomers, pageIndex]);

  const selectedOnPage = pageRows.filter((row) =>
    selectedIds.includes(row.id),
  ).length;

  const allPageSelected =
    pageRows.length > 0 && selectedOnPage === pageRows.length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function toggleRow(id: string | number) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function toggleAllPageRows() {
    const pageIds = pageRows.map((row) => row.id);

    if (allPageSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !pageIds.includes(id)),
      );
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...pageIds])));
  }

  async function loadCustomers(showToast = false) {
    try {
      setIsLoading(true);

      const response = await fetch("/api/customers/?page_size=200", {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as CustomersApiResponse;
      const normalized = normalizeApiList(payload).map(normalizeCustomer);

      setCustomers(normalized);

      if (showToast) {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error("Failed to load customers:", error);
      setCustomers([]);
      toast.error(t.loadError);
    } finally {
      setIsLoading(false);
    }
  }

  function exportExcel() {
    const rows = exportRows.map((customer) => ({
      [t.table.code]: customer.code,
      [t.table.customer]: customer.name,
      [t.table.customerType]: typeLabel(customer.customerType, locale),
      [t.table.city]: customer.city,
      [t.table.contact]: customer.primaryContact,
      [t.table.status]: statusLabel(customer.status, locale),
      [t.table.source]: customer.source,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 32 },
      { wch: 18 },
      { wch: 18 },
      { wch: 26 },
      { wch: 16 },
      { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(t.print.title));
    XLSX.writeFile(
      workbook,
      `primey-care-customers-list-${new Date().toISOString().slice(0, 10)}.xlsx`,
      {
        bookType: "xlsx",
        compression: true,
      },
    );

    toast.success(t.exportSuccess);
  }

  function printListOnly() {
    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      toast.error(t.loadError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        title: t.print.title,
        locale,
        rows: exportRows,
        t,
      }),
    );
    printWindow.document.close();

    toast.success(t.printReady);
  }

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readLocale();
      applyDocumentLocale(nextLocale);
      setLocale(nextLocale);
    };

    syncLocale();

    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  useEffect(() => {
    loadCustomers(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    setPageIndex(0);
    setSelectedIds([]);
  }, [query, statusFilter, typeFilter]);

  return (
    <div className="space-y-4">
      {/* Header 1:1 */}
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>

        <Button asChild>
          <Link href="/system/customers/create">
            <Plus className="h-4 w-4" />
            {t.addCustomer}
          </Link>
        </Button>
      </div>

      {/* Cards 1:1 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t.totalCustomers} value={stats.total} growth="+12.5%" tone="positive" />
        <StatCard title={t.activeCustomers} value={stats.active} growth="+8.2%" tone="positive" />
        <StatCard title={t.corporateCustomers} value={stats.corporate} growth="+4.1%" tone="positive" />
        <StatCard title={t.leadCustomers} value={stats.lead} growth="-2.4%" tone="negative" />
      </div>

      {/* List Section */}
      <div className="pt-4">
        <Card className="rounded-2xl">
          <CardHeader className="gap-4">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div>
                <CardTitle>{t.customersData}</CardTitle>
                <CardDescription>{t.customersDataDesc}</CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => loadCustomers(true)}
                  disabled={isLoading}
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
                  className="rounded-xl"
                  onClick={exportExcel}
                  disabled={isLoading || exportRows.length === 0}
                >
                  <Download className="h-4 w-4" />
                  {t.export}
                </Button>

                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={printListOnly}
                  disabled={isLoading || exportRows.length === 0}
                >
                  <Printer className="h-4 w-4" />
                  {t.printPdf}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="rounded-xl">
                      <ColumnsIcon className="h-4 w-4" />
                      {t.columns}
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align={isArabic ? "start" : "end"}>
                    {(Object.keys(visibleColumns) as Array<keyof VisibleColumns>).map(
                      (key) => (
                        <DropdownMenuCheckboxItem
                          key={key}
                          checked={visibleColumns[key]}
                          onCheckedChange={(checked) =>
                            setVisibleColumns((current) => ({
                              ...current,
                              [key]: Boolean(checked),
                            }))
                          }
                        >
                          {key === "select"
                            ? "#"
                            : key === "customer"
                              ? t.table.customer
                              : key === "code"
                                ? t.table.code
                                : key === "customerType"
                                  ? t.table.customerType
                                  : key === "city"
                                    ? t.table.city
                                    : key === "contact"
                                      ? t.table.contact
                                      : key === "status"
                                        ? t.table.status
                                        : key === "source"
                                          ? t.table.source
                                          : t.table.actions}
                        </DropdownMenuCheckboxItem>
                      ),
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative w-full lg:max-w-sm">
                <Search
                  className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                    isArabic ? "right-3" : "left-3"
                  }`}
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.search}
                  className={`rounded-xl ${isArabic ? "pr-10" : "pl-10"}`}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {statusOptions.map((item) => (
                  <Button
                    key={item.value}
                    variant={statusFilter === item.value ? "default" : "outline"}
                    className="rounded-xl"
                    onClick={() => setStatusFilter(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {typeOptions.map((item) => (
                  <Button
                    key={item.value}
                    variant={typeFilter === item.value ? "default" : "outline"}
                    className="rounded-xl"
                    onClick={() => setTypeFilter(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.select ? (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allPageSelected}
                          onCheckedChange={toggleAllPageRows}
                        />
                      </TableHead>
                    ) : null}

                    {visibleColumns.customer ? (
                      <SortableHead
                        label={t.table.customer}
                        onClick={() => toggleSort("name")}
                      />
                    ) : null}

                    {visibleColumns.code ? (
                      <SortableHead
                        label={t.table.code}
                        onClick={() => toggleSort("code")}
                      />
                    ) : null}

                    {visibleColumns.customerType ? (
                      <SortableHead
                        label={t.table.customerType}
                        onClick={() => toggleSort("customerType")}
                      />
                    ) : null}

                    {visibleColumns.city ? (
                      <SortableHead
                        label={t.table.city}
                        onClick={() => toggleSort("city")}
                      />
                    ) : null}

                    {visibleColumns.contact ? (
                      <TableHead>{t.table.contact}</TableHead>
                    ) : null}

                    {visibleColumns.status ? (
                      <SortableHead
                        label={t.table.status}
                        onClick={() => toggleSort("status")}
                      />
                    ) : null}

                    {visibleColumns.source ? (
                      <TableHead>{t.table.source}</TableHead>
                    ) : null}

                    {visibleColumns.actions ? (
                      <TableHead>{t.table.actions}</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.loading}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : pageRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center">
                        {t.noResults}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((customer) => (
                      <TableRow
                        key={customer.id}
                        data-state={
                          selectedIds.includes(customer.id) ? "selected" : undefined
                        }
                      >
                        {visibleColumns.select ? (
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(customer.id)}
                              onCheckedChange={() => toggleRow(customer.id)}
                            />
                          </TableCell>
                        ) : null}

                        {visibleColumns.customer ? (
                          <TableCell>
                            <div className="flex min-w-[240px] items-center gap-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-muted">
                                {customer.customerType === "CORPORATE" ? (
                                  <Building2 className="h-5 w-5" />
                                ) : (
                                  <UserRound className="h-5 w-5" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate font-medium">
                                  {customer.name}
                                </div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {customer.email || customer.primaryContact || customer.code}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.code ? (
                          <TableCell className="font-medium">
                            {customer.code}
                          </TableCell>
                        ) : null}

                        {visibleColumns.customerType ? (
                          <TableCell>
                            <Badge variant="secondary" className="rounded-full">
                              {typeLabel(customer.customerType, locale)}
                            </Badge>
                          </TableCell>
                        ) : null}

                        {visibleColumns.city ? (
                          <TableCell>{customer.city || "-"}</TableCell>
                        ) : null}

                        {visibleColumns.contact ? (
                          <TableCell>
                            <div className="flex min-w-[160px] items-center gap-2">
                              {customer.email ? (
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <span>
                                {customer.primaryContact ||
                                  customer.whatsapp ||
                                  customer.phone ||
                                  customer.email ||
                                  "-"}
                              </span>
                            </div>
                          </TableCell>
                        ) : null}

                        {visibleColumns.status ? (
                          <TableCell>{statusBadge(customer.status, locale)}</TableCell>
                        ) : null}

                        {visibleColumns.source ? (
                          <TableCell>
                            <Badge variant="outline" className="rounded-full">
                              {customer.source || "-"}
                            </Badge>
                          </TableCell>
                        ) : null}

                        {visibleColumns.actions ? (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>

                              <DropdownMenuContent align={isArabic ? "start" : "end"}>
                                <DropdownMenuLabel>{t.actions}</DropdownMenuLabel>
                                <DropdownMenuSeparator />

                                <DropdownMenuItem asChild>
                                  <Link href={`/system/customers/${customer.id}`}>
                                    <Eye className="h-4 w-4" />
                                    {t.viewDetails}
                                  </Link>
                                </DropdownMenuItem>

                                <DropdownMenuItem asChild>
                                  <Link href={`/system/customers/${customer.id}`}>
                                    <FileText className="h-4 w-4" />
                                    {t.statement}
                                  </Link>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => {
                                    navigator.clipboard.writeText(String(customer.code));
                                    toast.success(t.copied);
                                  }}
                                >
                                  {t.copyCode}
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => {
                                    navigator.clipboard.writeText(String(customer.id));
                                    toast.success(t.copied);
                                  }}
                                >
                                  {t.copyId}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {selectedIds.length} / {filteredCustomers.length} {t.selectedRows}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-sm text-muted-foreground">
                  {pageIndex + 1} / {pageCount}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                >
                  {t.previous}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={pageIndex >= pageCount - 1}
                  onClick={() =>
                    setPageIndex((current) => Math.min(pageCount - 1, current + 1))
                  }
                >
                  {t.next}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  growth,
  tone,
}: {
  title: string;
  value: number | string;
  growth: string;
  tone: "positive" | "negative";
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="font-display text-2xl lg:text-3xl">
          {value}
        </CardTitle>
        <div className="absolute end-6 top-6">
          <Badge variant="outline">
            <span className={tone === "positive" ? "text-green-600" : "text-red-600"}>
              {growth}
            </span>
          </Badge>
        </div>
      </CardHeader>
    </Card>
  );
}

function SortableHead({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <TableHead>
      <Button className="-ms-3" variant="ghost" onClick={onClick}>
        {label}
        <ArrowDownUp className="h-3 w-3" />
      </Button>
    </TableHead>
  );
}