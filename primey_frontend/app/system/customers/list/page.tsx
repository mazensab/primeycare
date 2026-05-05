"use client";

/* ============================================================
   📂 app/system/customers/list/page.tsx
   🧠 Primey Care | Customers List
   ------------------------------------------------------------
   ✅ المسار: /system/customers/list
   ✅ الإصدار: v1.1.0 - UX Refinement

   ✅ العمل:
      قائمة كاملة للعملاء مع البحث والفلاتر والفرز وإدارة الأعمدة
      والتصدير والطباعة.

   ✅ API:
      GET customers list through lib/api.ts

   ✅ ملاحظات UX المعتمدة:
      - لا يتم إظهار المسارات التقنية أو أسماء API داخل الواجهة.
      - البحث في صف مستقل.
      - الفلاتر وإدارة الأعمدة في صف مستقل تحت البحث.
      - التصدير Excel بصيغة .xls HTML Workbook وليس CSV أو XLSX.
      - Web PDF Print للقائمة.
      - Error State مستقل عن Empty State.
      - Skeleton Loading.
      - Empty State ذكي حسب البحث والفلاتر.
      - روابط التفاصيل آمنة وتتحقق من id.
      - عدم عرض أزرار وهمية مثل كشف الحساب إذا لم توجد صفحة مخصصة.
      - الصفحة ممتدة على عرض المساحة.
      - دعم عربي / إنجليزي عبر primey-locale.
      - استخدام sonner للتنبيهات.
      - الأرقام تبقى بالإنجليزية.
============================================================ */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  Building2,
  ColumnsIcon,
  Download,
  Eye,
  FileText,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet, API_PATHS } from "@/lib/api";
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
  DropdownMenuCheckboxItem,
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

/* ============================================================
   Types
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
  items?: unknown[];
  data?:
    | unknown[]
    | {
        results?: unknown[];
        customers?: unknown[];
        items?: unknown[];
      };
  count?: number;
};

type VisibleColumns = {
  customer: boolean;
  code: boolean;
  customerType: boolean;
  city: boolean;
  contact: boolean;
  status: boolean;
  source: boolean;
  actions: boolean;
};

type ExcelSheetOptions = {
  filename: string;
  worksheetName: string;
  title: string;
  locale: AppLocale;
  summaryRows: Array<[string, string | number]>;
  filterRows: Array<[string, string | number]>;
  headers: string[];
  rows: Array<Array<string | number>>;
};

const PAGE_SIZE = 10;

/* ============================================================
   Locale Helpers
============================================================ */

function readLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const savedLocale = window.localStorage.getItem("primey-locale");

    if (savedLocale === "en") return "en";
    if (savedLocale === "ar") return "ar";

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

function formatNumber(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatDateForExport(value: string) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    title: ar ? "قائمة العملاء" : "Customers List",
    subtitle: ar
      ? "إدارة العملاء مع البحث والفلاتر والأعمدة والفرز."
      : "Manage customers with search, filters, columns, and sorting.",

    back: ar ? "لوحة العملاء" : "Customers Overview",
    addCustomer: ar ? "إضافة عميل" : "Add Customer",
    refresh: ar ? "تحديث" : "Refresh",
    exportExcel: ar ? "تصدير Excel" : "Export Excel",
    printPdf: ar ? "طباعة PDF" : "Print PDF",
    columns: ar ? "الأعمدة" : "Columns",
    retry: ar ? "إعادة المحاولة" : "Retry",
    clearFilters: ar ? "مسح الفلاتر" : "Clear Filters",

    search: ar ? "ابحث باسم العميل أو الكود أو الجوال أو المدينة..." : "Search by customer name, code, mobile, or city...",
    all: ar ? "الكل" : "All",

    totalCustomers: ar ? "إجمالي العملاء" : "Total Customers",
    activeCustomers: ar ? "العملاء النشطون" : "Active Customers",
    corporateCustomers: ar ? "عملاء الشركات" : "Corporate Customers",
    leadCustomers: ar ? "العملاء المحتملون" : "Lead Customers",

    customersData: ar ? "بيانات العملاء" : "Customers Data",
    customersDataDesc: ar
      ? "استعرض العملاء، رتّب البيانات، وخصص الأعمدة حسب احتياجك."
      : "Browse customers, sort data, and customize columns as needed.",

    selectedRows: ar ? "صفوف محددة" : "row(s) selected",
    previous: ar ? "السابق" : "Previous",
    next: ar ? "التالي" : "Next",
    page: ar ? "صفحة" : "Page",
    from: ar ? "من" : "of",
    showing: ar ? "المعروض" : "Showing",

    emptyTitle: ar ? "لا يوجد عملاء بعد" : "No customers yet",
    emptyText: ar
      ? "عند إضافة عملاء جدد ستظهر بياناتهم هنا مباشرة."
      : "New customers will appear here once they are added.",
    noResultsTitle: ar ? "لا توجد نتائج مطابقة" : "No matching results",
    noResultsText: ar
      ? "جرّب تغيير كلمات البحث أو فلتر الحالة أو فلتر النوع."
      : "Try changing the search keywords, status filter, or type filter.",

    actions: ar ? "الإجراءات" : "Actions",
    viewDetails: ar ? "عرض التفاصيل" : "View details",
    copyCode: ar ? "نسخ كود العميل" : "Copy customer code",
    copyId: ar ? "نسخ المعرف" : "Copy ID",

    loadError: ar ? "تعذر تحميل قائمة العملاء." : "Unable to load customers list.",
    loadErrorHint: ar
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: ar
      ? "تم تحديث قائمة العملاء بنجاح."
      : "Customers list refreshed successfully.",
    exportSuccess: ar
      ? "تم تجهيز ملف Excel بنجاح."
      : "Excel file prepared successfully.",
    exportEmpty: ar
      ? "لا توجد بيانات قابلة للتصدير."
      : "No data available to export.",
    printReady: ar
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: ar
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",
    copied: ar ? "تم النسخ بنجاح." : "Copied successfully.",

    active: ar ? "نشط" : "Active",
    inactive: ar ? "غير نشط" : "Inactive",
    blocked: ar ? "محظور" : "Blocked",
    lead: ar ? "محتمل" : "Lead",
    unknown: ar ? "غير محدد" : "Unknown",

    individual: ar ? "فرد" : "Individual",
    corporate: ar ? "شركة" : "Corporate",

    generatedAt: ar ? "تاريخ التصدير" : "Generated At",
    reportScope: ar ? "نطاق التقرير" : "Report Scope",
    currentFilteredData: ar
      ? "حسب الفلاتر الحالية"
      : "Current filtered data",
    selectedScope: ar ? "الصفوف المحددة" : "Selected rows",
    filterSearch: ar ? "البحث" : "Search",
    filterStatus: ar ? "فلتر الحالة" : "Status Filter",
    filterType: ar ? "فلتر النوع" : "Type Filter",

    table: {
      id: ar ? "المعرف" : "ID",
      customer: ar ? "العميل" : "Customer",
      code: ar ? "الكود" : "Code",
      customerType: ar ? "النوع" : "Type",
      city: ar ? "المدينة" : "City",
      district: ar ? "الحي" : "District",
      contact: ar ? "التواصل" : "Contact",
      email: ar ? "البريد الإلكتروني" : "Email",
      phone: ar ? "الهاتف" : "Phone",
      whatsapp: ar ? "واتساب" : "WhatsApp",
      status: ar ? "الحالة" : "Status",
      source: ar ? "المصدر" : "Source",
      nationalId: ar ? "رقم الهوية" : "National ID",
      nationality: ar ? "الجنسية" : "Nationality",
      createdAt: ar ? "تاريخ الإنشاء" : "Created At",
      updatedAt: ar ? "آخر تحديث" : "Updated At",
      actions: ar ? "الإجراء" : "Action",
    },

    print: {
      title: ar ? "قائمة العملاء" : "Customers List",
      generatedAt: ar ? "تاريخ الطباعة" : "Printed At",
      scope: ar ? "النطاق" : "Scope",
      filteredOnly: ar
        ? "القائمة حسب الفلاتر الحالية"
        : "Current filtered list",
      selectedOnly: ar ? "الصفوف المحددة فقط" : "Selected rows only",
      totalRows: ar ? "عدد السجلات" : "Rows Count",
    },
  };
}

/* ============================================================
   API Normalizers
============================================================ */

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
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;

  if (data.data && typeof data.data === "object") {
    const nested = data.data;

    if (Array.isArray(nested.results)) return nested.results;
    if (Array.isArray(nested.customers)) return nested.customers;
    if (Array.isArray(nested.items)) return nested.items;
  }

  return [];
}

function normalizeStatus(value: unknown): CustomerStatus {
  const status = String(value || "").toUpperCase();

  if (status === "ACTIVE") return "ACTIVE";
  if (status === "INACTIVE") return "INACTIVE";
  if (status === "BLOCKED") return "BLOCKED";
  if (status === "LEAD") return "LEAD";

  if (value === true) return "ACTIVE";
  if (value === false) return "INACTIVE";

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
    id: (obj.id ?? obj.pk ?? "") as number | string,
    name: pickString(
      obj,
      ["display_name", "displayName", "name", "full_name", "fullName"],
      fallbackName || "-",
    ),
    code: pickString(obj, ["customer_code", "customerCode", "code"], "-"),
    customerType,
    status: normalizeStatus(obj.status ?? obj.is_active),
    source: pickString(obj, ["source"], "-"),
    email,
    phone,
    whatsapp,
    primaryContact:
      pickString(obj, ["primary_contact_number", "primaryContactNumber"]) ||
      whatsapp ||
      phone ||
      email,
    city: pickString(obj, ["city"], ""),
    district: pickString(obj, ["district"], ""),
    nationalId: pickString(obj, ["national_id", "nationalId"], ""),
    nationality: pickString(obj, ["nationality"], ""),
    createdAt: pickString(obj, ["created_at", "createdAt"], ""),
    updatedAt: pickString(obj, ["updated_at", "updatedAt"], ""),
  };
}

/* ============================================================
   UI Helpers
============================================================ */

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
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "LEAD") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "BLOCKED") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
        {label}
      </Badge>
    );
  }

  if (status === "INACTIVE") {
    return (
      <Badge variant="outline" className="rounded-full px-3 py-1">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="rounded-full px-3 py-1">
      {label}
    </Badge>
  );
}

function calculatePercent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function isValidCustomerId(id: Customer["id"]) {
  const value = String(id || "").trim();

  return value.length > 0 && value !== "-" && value !== "undefined";
}

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function downloadExcel(options: ExcelSheetOptions) {
  const dir = options.locale === "ar" ? "rtl" : "ltr";
  const align = options.locale === "ar" ? "right" : "left";
  const colspan = Math.max(options.headers.length, 2);

  const summaryHtml = options.summaryRows
    .map(
      ([label, value]) => `
        <tr>
          <td class="summary-label">${escapeHtml(label)}</td>
          <td class="summary-value">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const filterHtml = options.filterRows
    .map(
      ([label, value]) => `
        <tr>
          <td class="summary-label">${escapeHtml(label)}</td>
          <td class="summary-value">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const headerHtml = options.headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("");

  const rowsHtml = options.rows
    .map(
      (row) => `
        <tr>
          ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}
        </tr>`,
    )
    .join("");

  const workbook = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${escapeHtml(options.worksheetName)}</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayRightToLeft>${options.locale === "ar" ? "True" : "False"}</x:DisplayRightToLeft>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body {
            direction: ${dir};
            font-family: Arial, sans-serif;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          th,
          td {
            border: 1px solid #d9e2ef;
            padding: 8px;
            text-align: ${align};
            vertical-align: top;
            mso-number-format: "\\@";
          }
          th {
            background: #d8ecfb;
            color: #000000;
            font-weight: 700;
          }
          .title {
            font-size: 20px;
            font-weight: 700;
            text-align: center;
            background: #ffffff;
          }
          .section {
            font-weight: 700;
            background: #eef6ff;
          }
          .summary-label {
            font-weight: 700;
            background: #f8fafc;
            width: 240px;
          }
          .summary-value {
            font-weight: 700;
          }
        </style>
      </head>
      <body dir="${dir}">
        <table>
          <tr>
            <td class="title" colspan="${colspan}">
              ${escapeHtml(options.title)}
            </td>
          </tr>
          <tr><td colspan="${colspan}"></td></tr>
          <tr><td class="section" colspan="${colspan}">${options.locale === "ar" ? "ملخص القائمة" : "List Summary"}</td></tr>
          ${summaryHtml}
          <tr><td colspan="${colspan}"></td></tr>
          <tr><td class="section" colspan="${colspan}">${options.locale === "ar" ? "الفلاتر المستخدمة" : "Applied Filters"}</td></tr>
          ${filterHtml}
          <tr><td colspan="${colspan}"></td></tr>
          <tr>${headerHtml}</tr>
          ${rowsHtml}
        </table>
      </body>
    </html>`;

  const blob = new Blob([workbook], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = options.filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

function buildPrintHtml({
  title,
  locale,
  rows,
  t,
  selectedOnly,
}: {
  title: string;
  locale: AppLocale;
  rows: Customer[];
  t: ReturnType<typeof dictionary>;
  selectedOnly: boolean;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const tableRows = rows
    .map(
      (customer, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(customer.code || "-")}</td>
          <td>${escapeHtml(customer.name || "-")}</td>
          <td>${escapeHtml(typeLabel(customer.customerType, locale))}</td>
          <td>${escapeHtml(customer.city || customer.district || "-")}</td>
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
            direction: ${isArabic ? "rtl" : "ltr"};
            text-align: ${isArabic ? "right" : "left"};
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
          }
        </style>
      </head>

      <body>
        <div class="print-header">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">
              <div>${escapeHtml(t.print.generatedAt)}: ${escapeHtml(now)}</div>
              <div>${escapeHtml(t.print.scope)}: ${escapeHtml(selectedOnly ? t.print.selectedOnly : t.print.filteredOnly)}</div>
              <div>${escapeHtml(t.print.totalRows)}: ${formatNumber(rows.length)}</div>
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
              `<tr><td colspan="8" style="text-align:center">${escapeHtml(t.emptyTitle)}</td></tr>`
            }
          </tbody>
        </table>

        <script>
          window.addEventListener("load", () => {
            window.focus();
            window.print();
          });
        </script>
      </body>
    </html>
  `;
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function StatCardSkeleton() {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <SkeletonLine className="h-7 w-16" />
            <SkeletonLine className="h-4 w-28" />
          </div>
          <SkeletonLine className="h-10 w-10 rounded-xl" />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <SkeletonLine className="h-3 w-8" />
          <SkeletonLine className="h-2 flex-1" />
        </div>
      </CardContent>
    </Card>
  );
}

function TableRowsSkeleton({ columnsCount }: { columnsCount: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columnsCount }).map((__, columnIndex) => (
            <TableCell key={columnIndex}>
              <SkeletonLine
                className={
                  columnIndex === 1
                    ? "h-9 w-52 rounded-lg"
                    : "h-4 w-24 rounded-lg"
                }
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/* ============================================================
   Page
============================================================ */

export default function SystemCustomersListPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedIds, setSelectedIds] = useState<Array<string | number>>([]);
  const [pageIndex, setPageIndex] = useState(0);

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
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

  const columnLabels = useMemo(
    () =>
      ({
        customer: t.table.customer,
        code: t.table.code,
        customerType: t.table.customerType,
        city: t.table.city,
        contact: t.table.contact,
        status: t.table.status,
        source: t.table.source,
        actions: t.actions,
      }) satisfies Record<keyof VisibleColumns, string>,
    [t],
  );

  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((item) => item.status === "ACTIVE").length;
    const corporate = customers.filter(
      (item) => item.customerType === "CORPORATE",
    ).length;
    const lead = customers.filter((item) => item.status === "LEAD").length;

    return {
      total,
      active,
      corporate,
      lead,
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
          customer.district,
          customer.source,
          customer.nationalId,
          customer.nationality,
          customer.status,
          customer.customerType,
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

  const hasSearchOrFilter =
    query.trim().length > 0 || statusFilter !== "ALL" || typeFilter !== "ALL";

  const visibleTableColumnsCount =
    1 + Object.values(visibleColumns).filter(Boolean).length;

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

  function clearFilters() {
    setQuery("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
  }

  async function loadCustomers(showSuccessToast = false) {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await apiGet<CustomersApiResponse>(
        API_PATHS.customers.list,
        {
          page_size: 200,
        },
      );

      if (!response.ok) {
        throw new Error(response.message || t.loadError);
      }

      const normalized = normalizeApiList(response.data).map(normalizeCustomer);

      setCustomers(normalized);

      if (showSuccessToast) {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error("Failed to load customers list:", error);
      setCustomers([]);
      setErrorMessage(t.loadError);
      toast.error(t.loadError);
    } finally {
      setIsLoading(false);
    }
  }

  function exportExcel() {
    if (exportRows.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const generatedAt = new Date();

    const statusFilterLabel =
      statusOptions.find((item) => item.value === statusFilter)?.label || t.all;

    const typeFilterLabel =
      typeOptions.find((item) => item.value === typeFilter)?.label || t.all;

    downloadExcel({
      filename: `primey-care-customers-list-${generatedAt
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "قائمة العملاء" : "Customers List",
      title: t.title,
      locale,
      summaryRows: [
        [t.generatedAt, generatedAt.toLocaleString("en-US")],
        [
          t.reportScope,
          selectedIds.length > 0 ? t.selectedScope : t.currentFilteredData,
        ],
        [
          t.showing,
          `${formatNumber(exportRows.length)} / ${formatNumber(customers.length)}`,
        ],
        [t.totalCustomers, stats.total],
        [t.activeCustomers, stats.active],
        [t.corporateCustomers, stats.corporate],
        [t.leadCustomers, stats.lead],
      ],
      filterRows: [
        [t.filterSearch, query || t.all],
        [t.filterStatus, statusFilterLabel],
        [t.filterType, typeFilterLabel],
      ],
      headers: [
        t.table.id,
        t.table.code,
        t.table.customer,
        t.table.customerType,
        t.table.city,
        t.table.district,
        t.table.contact,
        t.table.email,
        t.table.phone,
        t.table.whatsapp,
        t.table.status,
        t.table.source,
        t.table.nationalId,
        t.table.nationality,
        t.table.createdAt,
        t.table.updatedAt,
      ],
      rows: exportRows.map((customer) => [
        String(customer.id || "-"),
        customer.code || "-",
        customer.name || "-",
        typeLabel(customer.customerType, locale),
        customer.city || "-",
        customer.district || "-",
        customer.primaryContact || "-",
        customer.email || "-",
        customer.phone || "-",
        customer.whatsapp || "-",
        statusLabel(customer.status, locale),
        customer.source || "-",
        customer.nationalId || "-",
        customer.nationality || "-",
        formatDateForExport(customer.createdAt),
        formatDateForExport(customer.updatedAt),
      ]),
    });

    toast.success(t.exportSuccess);
  }

  function printListOnly() {
    if (exportRows.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        title: t.print.title,
        locale,
        rows: exportRows,
        t,
        selectedOnly: selectedIds.length > 0,
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

    const syncAfterPaint = () => {
      syncLocale();

      window.setTimeout(() => {
        syncLocale();
      }, 0);
    };

    syncAfterPaint();

    window.addEventListener("primey-locale-changed", syncAfterPaint);
    window.addEventListener("storage", syncAfterPaint);

    return () => {
      window.removeEventListener("primey-locale-changed", syncAfterPaint);
      window.removeEventListener("storage", syncAfterPaint);
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
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.title}
          </h1>

          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/system/customers">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

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

          <Link href="/system/customers/create">
            <Button className="h-10 w-full rounded-xl sm:w-auto">
              <PlusCircle className="h-4 w-4" />
              <span>{t.addCustomer}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Error State */}
      {!isLoading && errorMessage ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <XCircle className="h-5 w-5" />
              </div>

              <div>
                <p className="font-semibold text-destructive">
                  {errorMessage}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.loadErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadCustomers(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <StatCardSkeleton key={index} />
            ))
          : [
              {
                title: t.totalCustomers,
                value: stats.total,
                percent: stats.total > 0 ? 100 : 0,
                icon: Users,
              },
              {
                title: t.activeCustomers,
                value: stats.active,
                percent: calculatePercent(stats.active, stats.total),
                icon: BadgeCheck,
              },
              {
                title: t.corporateCustomers,
                value: stats.corporate,
                percent: calculatePercent(stats.corporate, stats.total),
                icon: Building2,
              },
              {
                title: t.leadCustomers,
                value: stats.lead,
                percent: calculatePercent(stats.lead, stats.total),
                icon: FileText,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <Card
                  key={item.title}
                  className="rounded-2xl border bg-card shadow-sm"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-2xl font-bold">
                          {formatNumber(item.value)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.title}
                        </p>
                      </div>

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {formatNumber(item.percent)}%
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Table */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">
            {t.customersData}
          </CardTitle>
          <CardDescription>{t.customersDataDesc}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="w-full space-y-4">
            {/* Search Row */}
            <div className="relative w-full">
              <Search
                className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                  isArabic ? "right-3" : "left-3"
                }`}
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.search}
                className={`h-11 rounded-xl ${isArabic ? "pr-10" : "pl-10"}`}
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {statusOptions.map((item) => (
                    <Button
                      key={item.value}
                      variant={
                        statusFilter === item.value ? "default" : "outline"
                      }
                      className="h-10 shrink-0 rounded-xl"
                      onClick={() => setStatusFilter(item.value)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {typeOptions.map((item) => (
                    <Button
                      key={item.value}
                      variant={typeFilter === item.value ? "default" : "outline"}
                      className="h-10 shrink-0 rounded-xl"
                      onClick={() => setTypeFilter(item.value)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {hasSearchOrFilter ? (
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl"
                    onClick={clearFilters}
                  >
                    {t.clearFilters}
                  </Button>
                ) : null}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 rounded-xl">
                      <ColumnsIcon className="h-4 w-4" />
                      <span>{t.columns}</span>
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align={isArabic ? "start" : "end"}>
                    {Object.entries(visibleColumns).map(([key, value]) => (
                      <DropdownMenuCheckboxItem
                        key={key}
                        checked={value}
                        onCheckedChange={(checked) =>
                          setVisibleColumns((current) => ({
                            ...current,
                            [key]: Boolean(checked),
                          }))
                        }
                      >
                        {columnLabels[key as keyof VisibleColumns]}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allPageSelected}
                          onCheckedChange={toggleAllPageRows}
                          aria-label="Select all"
                        />
                      </TableHead>

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
                      <TableRowsSkeleton
                        columnsCount={visibleTableColumnsCount}
                      />
                    ) : pageRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={visibleTableColumnsCount}
                          className="h-36 text-center"
                        >
                          <div className="mx-auto max-w-md space-y-2">
                            <p className="font-semibold">
                              {hasSearchOrFilter
                                ? t.noResultsTitle
                                : t.emptyTitle}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {hasSearchOrFilter ? t.noResultsText : t.emptyText}
                            </p>

                            {hasSearchOrFilter ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 rounded-xl"
                                onClick={clearFilters}
                              >
                                {t.clearFilters}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageRows.map((customer) => (
                        <TableRow
                          key={`${customer.id}-${customer.code}-${customer.name}`}
                          data-state={
                            selectedIds.includes(customer.id)
                              ? "selected"
                              : undefined
                          }
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(customer.id)}
                              onCheckedChange={() => toggleRow(customer.id)}
                              aria-label="Select row"
                            />
                          </TableCell>

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
                                    {customer.email ||
                                      customer.primaryContact ||
                                      customer.code}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          ) : null}

                          {visibleColumns.code ? (
                            <TableCell className="font-medium">
                              {customer.code || `#${customer.id}`}
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
                                <span>
                                  {customer.city || customer.district || "-"}
                                </span>
                              </div>
                            </TableCell>
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
                            <TableCell>
                              {statusBadge(customer.status, locale)}
                            </TableCell>
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
                                    <span className="sr-only">{t.actions}</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent
                                  align={isArabic ? "start" : "end"}
                                >
                                  <DropdownMenuLabel>
                                    {t.actions}
                                  </DropdownMenuLabel>
                                  <DropdownMenuSeparator />

                                  {isValidCustomerId(customer.id) ? (
                                    <DropdownMenuItem asChild>
                                      <Link
                                        href={`/system/customers/${customer.id}`}
                                      >
                                        <Eye className="h-4 w-4" />
                                        {t.viewDetails}
                                      </Link>
                                    </DropdownMenuItem>
                                  ) : null}

                                  <DropdownMenuItem
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        String(customer.code || "-"),
                                      );
                                      toast.success(t.copied);
                                    }}
                                  >
                                    {t.copyCode}
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        String(customer.id || "-"),
                                      );
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
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="flex-1 text-sm text-muted-foreground">
                {formatNumber(selectedIds.length)} /{" "}
                {formatNumber(filteredCustomers.length)} {t.selectedRows}
              </div>

              <div className="text-sm text-muted-foreground">
                {t.page} {formatNumber(pageIndex + 1)} {t.from}{" "}
                {formatNumber(pageCount)}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={pageIndex === 0}
                  onClick={() =>
                    setPageIndex((current) => Math.max(0, current - 1))
                  }
                >
                  {t.previous}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={pageIndex >= pageCount - 1}
                  onClick={() =>
                    setPageIndex((current) =>
                      Math.min(pageCount - 1, current + 1),
                    )
                  }
                >
                  {t.next}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================================================
   Small Components
============================================================ */

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