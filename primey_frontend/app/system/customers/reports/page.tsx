"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Building2,
  ColumnsIcon,
  Download,
  FileText,
  FilterIcon,
  Loader2,
  MapPin,
  Phone,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet, API_PATHS } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
   📂 app/system/customers/reports/page.tsx
   🧠 Primey Care | Customers Reports
   ------------------------------------------------------------
   ✅ مرتبط مع lib/api.ts
   ✅ تصدير Excel للقائمة التفصيلية فقط
   ✅ طباعة / Web PDF للقائمة التفصيلية فقط
   ✅ لا يطبع بطاقات التحليل أو الأقسام الجانبية
   ✅ نفس سلوك المراكز
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

type SortKey = "name" | "code" | "customerType" | "city" | "status" | "source";
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
  code: boolean;
  name: boolean;
  customerType: boolean;
  city: boolean;
  contact: boolean;
  status: boolean;
  source: boolean;
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
    title: ar ? "تقارير العملاء" : "Customers Reports",
    subtitle: ar
      ? "تحليل شامل للعملاء حسب الحالة، النوع، المدن، المصدر، وبيانات التواصل."
      : "Comprehensive customer analysis by status, type, city, source, and contact data.",

    back: ar ? "لوحة العملاء" : "Customers Overview",
    list: ar ? "قائمة العملاء" : "Customers List",
    refresh: ar ? "تحديث" : "Refresh",
    exportExcel: ar ? "تصدير" : "Export",
    printPdf: ar ? "طباعة / Web PDF" : "Print / Web PDF",
    columns: ar ? "الأعمدة" : "Columns",

    statusOverview: ar ? "حالة العملاء" : "Customers Status",
    statusOverviewDesc: ar
      ? "تحليل سريع لحالة العملاء المسجلين."
      : "Quick status analysis for registered customers.",

    featuredCustomers: ar ? "العملاء المميزون" : "Featured Customers",
    featuredCustomersDesc: ar
      ? "عرض مختصر لأهم العملاء حسب الحالة أو أحدث السجلات."
      : "A compact view of key customers by status or latest records.",

    detailedReport: ar ? "تقرير العملاء التفصيلي" : "Detailed Customers Report",
    detailedReportDesc: ar
      ? "جدول تحليلي قابل للبحث والتصفية وتصدير Excel والطباعة."
      : "Analytical table with search, filters, Excel export, and print.",

    searchPlaceholder: ar ? "ابحث في العملاء..." : "Search customers...",

    all: ar ? "الكل" : "All",
    total: ar ? "الإجمالي" : "Total",
    active: ar ? "نشط" : "Active",
    inactive: ar ? "غير نشط" : "Inactive",
    blocked: ar ? "محظور" : "Blocked",
    lead: ar ? "محتمل" : "Lead",
    unknown: ar ? "غير محدد" : "Unknown",
    individual: ar ? "فرد" : "Individual",
    corporate: ar ? "شركة" : "Corporate",

    stats: {
      total: ar ? "إجمالي العملاء" : "Total Customers",
      active: ar ? "النشطون" : "Active",
      corporate: ar ? "الشركات" : "Corporate",
      lead: ar ? "المحتملون" : "Leads",
      stopped: ar ? "الموقوفون" : "Stopped",
      individual: ar ? "الأفراد" : "Individuals",
    },

    table: {
      code: ar ? "الرقم" : "Code",
      name: ar ? "اسم العميل" : "Customer Name",
      customerType: ar ? "النوع" : "Type",
      city: ar ? "المدينة" : "City",
      contact: ar ? "التواصل" : "Contact",
      status: ar ? "الحالة" : "Status",
      source: ar ? "المصدر" : "Source",
    },

    groups: {
      byStatus: ar ? "حسب الحالة" : "By Status",
      byType: ar ? "حسب النوع" : "By Type",
      byCity: ar ? "حسب المدينة" : "By City",
      bySource: ar ? "حسب المصدر" : "By Source",
      category: ar ? "التصنيف" : "Category",
      count: ar ? "العدد" : "Count",
      percentage: ar ? "النسبة" : "Percentage",
    },

    noResults: ar ? "لا توجد نتائج." : "No results.",
    empty: ar ? "لا توجد بيانات عملاء حتى الآن." : "No customers data yet.",
    loading: ar ? "جاري تحميل تقارير العملاء..." : "Loading customers reports...",
    selectedRows: ar ? "صفوف محددة" : "row(s) selected",
    previous: ar ? "السابق" : "Previous",
    next: ar ? "التالي" : "Next",

    loadError: ar
      ? "تعذر تحميل تقارير العملاء."
      : "Failed to load customers reports.",
    refreshSuccess: ar
      ? "تم تحديث تقارير العملاء بنجاح."
      : "Customers reports refreshed successfully.",
    exportSuccess: ar
      ? "تم تصدير القائمة التفصيلية بنجاح."
      : "Detailed list exported successfully.",
    printReady: ar
      ? "تم تجهيز الطباعة للقائمة التفصيلية فقط."
      : "Print window prepared for the detailed list only.",

    print: {
      title: ar ? "تقرير العملاء التفصيلي" : "Detailed Customers Report",
      generatedAt: ar ? "تاريخ الطباعة" : "Printed At",
      scope: ar ? "النطاق" : "Scope",
      filteredOnly: ar
        ? "القائمة التفصيلية حسب الفلاتر الحالية فقط"
        : "Current filtered detailed list only",
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

function calculatePercent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function groupBy(
  customers: Customer[],
  key: keyof Pick<Customer, "status" | "customerType" | "city" | "source">,
  locale: AppLocale,
) {
  const total = customers.length || 1;
  const map = new Map<string, number>();

  customers.forEach((customer) => {
    let label = String(customer[key] || "-");

    if (key === "status") label = statusLabel(customer.status, locale);
    if (key === "customerType") label = typeLabel(customer.customerType, locale);

    map.set(label, (map.get(label) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: `${calculatePercent(count, total)}%`,
    }))
    .sort((a, b) => b.count - a.count);
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
          * { box-sizing: border-box; }
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
          th, td {
            border: 1px solid #e5e7eb;
            padding: 9px 8px;
            text-align: ${isArabic ? "right" : "left"};
            vertical-align: top;
          }
          tr:nth-child(even) td { background: #fafafa; }
          @page {
            size: A4 landscape;
            margin: 12mm;
          }
          @media print {
            body { padding: 0; }
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
              <th>${escapeHtml(t.table.name)}</th>
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

export default function SystemCustomersReportsPage() {
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
    code: true,
    name: true,
    customerType: true,
    city: true,
    contact: true,
    status: true,
    source: true,
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

  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((item) => item.status === "ACTIVE").length;
    const lead = customers.filter((item) => item.status === "LEAD").length;
    const inactive = customers.filter(
      (item) => item.status === "INACTIVE",
    ).length;
    const blocked = customers.filter((item) => item.status === "BLOCKED").length;
    const corporate = customers.filter(
      (item) => item.customerType === "CORPORATE",
    ).length;
    const individual = customers.filter(
      (item) => item.customerType === "INDIVIDUAL",
    ).length;

    return {
      total,
      active,
      lead,
      inactive,
      blocked,
      stopped: inactive + blocked,
      corporate,
      individual,
    };
  }, [customers]);

  const featuredCustomers = useMemo(() => {
    const activeCustomers = customers.filter((item) => item.status === "ACTIVE");
    if (activeCustomers.length > 0) return activeCustomers.slice(0, 6);
    return customers.slice(0, 6);
  }, [customers]);

  const byStatus = useMemo(
    () => groupBy(filteredCustomers, "status", locale),
    [filteredCustomers, locale],
  );

  const byType = useMemo(
    () => groupBy(filteredCustomers, "customerType", locale),
    [filteredCustomers, locale],
  );

  const byCity = useMemo(
    () => groupBy(filteredCustomers, "city", locale),
    [filteredCustomers, locale],
  );

  const bySource = useMemo(
    () => groupBy(filteredCustomers, "source", locale),
    [filteredCustomers, locale],
  );

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

  async function loadCustomers(showSuccessToast = false) {
    setIsLoading(true);

    const response = await apiGet<CustomersApiResponse>(API_PATHS.customers.list, {
      page_size: 200,
    });

    if (!response.ok) {
      setCustomers([]);
      setIsLoading(false);
      toast.error(response.message || t.loadError);
      return;
    }

    const normalized = normalizeApiList(response.data).map(normalizeCustomer);
    setCustomers(normalized);
    setIsLoading(false);

    if (showSuccessToast) {
      toast.success(t.refreshSuccess);
    }
  }

  function exportExcel() {
    const rows = exportRows.map((customer) => ({
      [t.table.code]: customer.code,
      [t.table.name]: customer.name,
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
      `primey-care-customers-report-list-${new Date().toISOString().slice(0, 10)}.xlsx`,
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
    <div className="space-y-4" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button asChild variant="outline" className="h-10 rounded-xl">
            <Link href="/system/customers">
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-10 rounded-xl">
            <Link href="/system/customers/list">
              <UsersRound className="h-4 w-4" />
              <span>{t.list}</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadCustomers(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={exportExcel}
            disabled={isLoading || exportRows.length === 0}
          >
            <Download className="h-4 w-4" />
            <span>{t.exportExcel}</span>
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={printListOnly}
            disabled={isLoading || exportRows.length === 0}
          >
            <Printer className="h-4 w-4" />
            <span>{t.printPdf}</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportStatCard title={t.stats.total} value={stats.total} percent={100} icon={UsersRound} />
        <ReportStatCard title={t.stats.active} value={stats.active} percent={calculatePercent(stats.active, stats.total)} icon={BadgeCheck} />
        <ReportStatCard title={t.stats.corporate} value={stats.corporate} percent={calculatePercent(stats.corporate, stats.total)} icon={Building2} />
        <ReportStatCard title={t.stats.lead} value={stats.lead} percent={calculatePercent(stats.lead, stats.total)} icon={FileText} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-1">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-bold">
                {t.featuredCustomers}
              </CardTitle>
              <CardDescription className="mt-1 text-sm">
                {t.featuredCustomersDesc}
              </CardDescription>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <BarChart3 className="h-5 w-5" />
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t.loading}</span>
              </div>
            ) : featuredCustomers.length === 0 ? (
              <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                {t.empty}
              </div>
            ) : (
              featuredCustomers.map((customer) => (
                <Link
                  key={customer.id}
                  href={`/system/customers/${customer.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3 transition hover:bg-muted/50">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                        {customer.customerType === "CORPORATE" ? (
                          <Building2 className="h-5 w-5" />
                        ) : (
                          <UserRound className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {customer.name}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {customer.code}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-end">
                      <p className="text-xs font-medium text-emerald-600">
                        {typeLabel(customer.customerType, locale)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {customer.city || customer.source || "-"}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-2">
          <CardHeader className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base font-bold">
                {t.statusOverview}
              </CardTitle>
              <CardDescription className="mt-1 text-sm">
                {t.statusOverviewDesc}
              </CardDescription>
            </div>

            <Button
              variant="outline"
              className="h-9 rounded-xl"
              onClick={exportExcel}
              disabled={isLoading || exportRows.length === 0}
            >
              <Download className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <MiniMetric title={t.total} value={stats.total} percent={100} icon={UsersRound} />
              <MiniMetric title={t.active} value={stats.active} percent={calculatePercent(stats.active, stats.total)} icon={BadgeCheck} />
              <MiniMetric title={t.lead} value={stats.lead} percent={calculatePercent(stats.lead, stats.total)} icon={FileText} />
              <MiniMetric title={t.blocked} value={stats.stopped} percent={calculatePercent(stats.stopped, stats.total)} icon={ShieldCheck} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <GroupTable title={t.groups.byStatus} rows={byStatus} locale={locale} />
              <GroupTable title={t.groups.byType} rows={byType} locale={locale} />
              <GroupTable title={t.groups.byCity} rows={byCity.slice(0, 6)} locale={locale} />
              <GroupTable title={t.groups.bySource} rows={bySource.slice(0, 6)} locale={locale} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-base font-bold">
              {t.detailedReport}
            </CardTitle>
            <CardDescription>{t.detailedReportDesc}</CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={exportExcel}
              disabled={isLoading || exportRows.length === 0}
            >
              <Download className="h-4 w-4" />
              {t.exportExcel}
            </Button>

            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printListOnly}
              disabled={isLoading || exportRows.length === 0}
            >
              <Printer className="h-4 w-4" />
              {t.printPdf}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 rounded-xl">
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
                        : key === "code"
                          ? t.table.code
                          : key === "name"
                            ? t.table.name
                            : key === "customerType"
                              ? t.table.customerType
                              : key === "city"
                                ? t.table.city
                                : key === "contact"
                                  ? t.table.contact
                                  : key === "status"
                                    ? t.table.status
                                    : t.table.source}
                    </DropdownMenuCheckboxItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
            <div className="relative">
              <Search
                className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                  isArabic ? "right-3" : "left-3"
                }`}
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.searchPlaceholder}
                className={`h-10 rounded-xl ${isArabic ? "pr-10" : "pl-10"}`}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {statusOptions.map((item) => (
                <Button
                  key={item.value}
                  variant={statusFilter === item.value ? "default" : "outline"}
                  className="h-10 rounded-xl"
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
                  className="h-10 rounded-xl"
                  onClick={() => setTypeFilter(item.value)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

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

                  {visibleColumns.code ? (
                    <SortableHead
                      label={t.table.code}
                      onClick={() => toggleSort("code")}
                    />
                  ) : null}

                  {visibleColumns.name ? (
                    <SortableHead
                      label={t.table.name}
                      onClick={() => toggleSort("name")}
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
                    <SortableHead
                      label={t.table.source}
                      onClick={() => toggleSort("source")}
                    />
                  ) : null}
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.loading}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
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

                      {visibleColumns.code ? (
                        <TableCell className="font-medium">
                          {customer.code}
                        </TableCell>
                      ) : null}

                      {visibleColumns.name ? (
                        <TableCell>
                          <div className="min-w-[220px]">
                            <div className="font-medium">{customer.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {customer.email || customer.primaryContact || "-"}
                            </div>
                          </div>
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
                        <TableCell>
                          <div className="flex min-w-[120px] items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{customer.city || customer.district || "-"}</span>
                          </div>
                        </TableCell>
                      ) : null}

                      {visibleColumns.contact ? (
                        <TableCell>
                          <div className="flex min-w-[150px] items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
  );
}

function ReportStatCard({
  title,
  value,
  percent,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  percent: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{title}</p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-medium text-emerald-600">{percent}%</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({
  title,
  value,
  percent,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  percent: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-2xl font-bold">{value}</p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <span className="text-xs font-medium text-emerald-600">{percent}%</span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function GroupTable({
  title,
  rows,
  locale,
}: {
  title: string;
  rows: Array<{ category: string; count: number; percentage: string }>;
  locale: AppLocale;
}) {
  const t = dictionary(locale);

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="border-b bg-muted/40 px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.groups.category}</TableHead>
            <TableHead>{t.groups.count}</TableHead>
            <TableHead>{t.groups.percentage}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="h-20 text-center">
                {t.noResults}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.category}>
                <TableCell className="font-medium">{row.category}</TableCell>
                <TableCell>{row.count}</TableCell>
                <TableCell>{row.percentage}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
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
      <Button variant="ghost" className="-ms-3" onClick={onClick}>
        {label}
        <FilterIcon className="h-3 w-3" />
      </Button>
    </TableHead>
  );
}