"use client";

/* ============================================================
   📂 app/system/customers/[id]/page.tsx
   🧠 Primey Care | Customer Detail Page
   ------------------------------------------------------------
   ✅ المسار: /system/customers/[id]
   ✅ الإصدار: v1.1.0 - UX Refinement

   ✅ العمل:
      عرض تفاصيل العميل، بيانات التواصل، العنوان، الملخص المالي،
      الروابط التشغيلية، وكشف الحساب.

   ✅ API:
      GET /api/customers/{id}/
      GET /api/customers/{id}/statement/

   ✅ ملاحظات UX المعتمدة:
      - لا يتم إظهار المسارات التقنية أو أسماء API داخل الواجهة.
      - لا يتم عرض Badge مثل Live Data / بيانات حقيقية.
      - لا يتم عرض زر تعديل معطل.
      - لا يتم عرض زر حذف نهائي داخل صفحة التفاصيل.
      - Error State مستقل عن Not Found.
      - Skeleton Loading كامل.
      - كشف الحساب له Error State مستقل.
      - الصفحة ممتدة على عرض المساحة.
      - نسخ سريع للكود والجوال والواتساب والبريد والهوية.
      - الملخص المالي يستخدم رمز العملة /currency/sar.svg بدون كتابة SAR داخل الرقم.
      - Web PDF Print منسق لكشف الحساب.
      - روابط تشغيلية محمية بمعرف صالح.
      - دعم عربي / إنجليزي عبر primey-locale.
      - استخدام sonner للتنبيهات.
      - الأرقام تبقى بالإنجليزية.
============================================================ */

import type { ComponentType, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Copy,
  CreditCard,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Printer,
  RefreshCcw,
  ShieldCheck,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet, API_PATHS } from "@/lib/api";
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

type CustomerDetail = {
  id: number | string;
  code: string;
  name: string;
  customerType: CustomerType;
  status: CustomerStatus;
  source: string;

  firstName: string;
  lastName: string;
  companyName: string;
  gender: string;
  dateOfBirth: string;

  email: string;
  phone: string;
  whatsapp: string;
  alternativePhone: string;
  primaryContact: string;

  nationalId: string;
  passportNumber: string;
  nationality: string;

  country: string;
  city: string;
  district: string;
  streetAddress: string;
  postalCode: string;
  nationalAddressText: string;

  notes: string;
  tags: string;

  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type CustomerDetailResponse = {
  ok?: boolean;
  message?: string;
  customer?: unknown;
  data?: unknown;
};

type StatementResponse = {
  ok?: boolean;
  message?: string;
  customer?: unknown;
  statement?: {
    summary?: StatementSummary;
    lines?: StatementLine[];
  };
  data?: {
    statement?: {
      summary?: StatementSummary;
      lines?: StatementLine[];
    };
    summary?: StatementSummary;
    lines?: StatementLine[];
  };
  summary?: StatementSummary;
  lines?: StatementLine[];
};

type StatementSummary = {
  customer_id?: number;
  customer_code?: string;
  customer_name?: string;
  customer_status?: string;
  primary_contact?: string;
  total_orders_count?: number;
  total_orders_amount?: string;
  total_invoices_count?: number;
  total_invoices_amount?: string;
  total_paid_amount?: string;
  total_due_amount?: string;
  currency?: string;
};

type StatementLine = {
  line_type: string;
  line_date: string | null;
  reference: string;
  related_order_id?: number | null;
  related_invoice_id?: number | null;
  related_payment_id?: number | null;
  description: string;
  debit_amount: string;
  credit_amount: string;
  balance_after: string;
  currency: string;
  status: string;
  metadata?: Record<string, unknown>;
};

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

function formatMoneyValue(value: string | number | undefined): string {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount)) return "0.00";

  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    pageTitle: ar ? "تفاصيل العميل" : "Customer Details",
    pageSubtitle: ar
      ? "عرض ملف العميل وبيانات التواصل والعنوان والملخص المالي وكشف الحساب."
      : "View customer profile, contact data, address, financial summary, and statement.",

    back: ar ? "قائمة العملاء" : "Customers List",
    refresh: ar ? "تحديث" : "Refresh",
    retry: ar ? "إعادة المحاولة" : "Retry",
    print: ar ? "طباعة PDF" : "Print PDF",

    customerProfile: ar ? "ملف العميل" : "Customer Profile",
    profileSubtitle: ar
      ? "البيانات الأساسية والتعريفية للعميل."
      : "Basic and identity information for the customer.",

    financialSummary: ar ? "الملخص المالي" : "Financial Summary",

    statementTitle: ar ? "كشف حساب العميل" : "Customer Statement",
    statementSubtitle: ar
      ? "الحركات المالية المرتبطة بالعميل حسب الفواتير والمدفوعات."
      : "Financial movements linked to the customer through invoices and payments.",

    contactInfo: ar ? "بيانات التواصل" : "Contact Information",
    addressInfo: ar ? "العنوان" : "Address",
    legalInfo: ar ? "البيانات النظامية" : "Legal Information",
    notesInfo: ar ? "ملاحظات وتصنيفات" : "Notes & Tags",
    operationalLinks: ar ? "روابط تشغيلية" : "Operational Links",
    operationalLinksDesc: ar
      ? "اختصارات لمتابعة الطلبات والفواتير والمدفوعات المرتبطة بهذا العميل."
      : "Shortcuts to track orders, invoices, and payments related to this customer.",

    customerCode: ar ? "كود العميل" : "Customer Code",
    customerType: ar ? "نوع العميل" : "Customer Type",
    status: ar ? "الحالة" : "Status",
    source: ar ? "المصدر" : "Source",
    gender: ar ? "الجنس" : "Gender",
    dateOfBirth: ar ? "تاريخ الميلاد" : "Date of Birth",
    createdAt: ar ? "تاريخ الإنشاء" : "Created At",
    updatedAt: ar ? "آخر تحديث" : "Updated At",

    email: ar ? "البريد الإلكتروني" : "Email",
    phone: ar ? "الجوال" : "Phone",
    whatsapp: ar ? "الواتساب" : "WhatsApp",
    alternativePhone: ar ? "رقم بديل" : "Alternative Phone",

    nationalId: ar ? "الهوية / الإقامة" : "National ID / Iqama",
    passportNumber: ar ? "رقم الجواز" : "Passport Number",
    nationality: ar ? "الجنسية" : "Nationality",

    country: ar ? "الدولة" : "Country",
    city: ar ? "المدينة" : "City",
    district: ar ? "الحي" : "District",
    streetAddress: ar ? "العنوان" : "Street Address",
    postalCode: ar ? "الرمز البريدي" : "Postal Code",
    nationalAddress: ar ? "العنوان الوطني" : "National Address",

    notes: ar ? "ملاحظات" : "Notes",
    tags: ar ? "وسوم" : "Tags",
    noNotes: ar ? "لا توجد ملاحظات." : "No notes available.",

    totalOrders: ar ? "عدد الطلبات" : "Orders",
    invoicesAmount: ar ? "إجمالي الفواتير" : "Invoices Amount",
    paidAmount: ar ? "إجمالي المدفوع" : "Paid Amount",
    dueAmount: ar ? "المتبقي" : "Due Amount",

    invoices: ar ? "الفواتير" : "Invoices",
    payments: ar ? "المدفوعات" : "Payments",
    orders: ar ? "الطلبات" : "Orders",

    table: {
      date: ar ? "التاريخ" : "Date",
      reference: ar ? "المرجع" : "Reference",
      type: ar ? "النوع" : "Type",
      description: ar ? "الوصف" : "Description",
      debit: ar ? "مدين" : "Debit",
      credit: ar ? "دائن" : "Credit",
      balance: ar ? "الرصيد" : "Balance",
      status: ar ? "الحالة" : "Status",
    },

    active: ar ? "نشط" : "Active",
    inactive: ar ? "غير نشط" : "Inactive",
    blocked: ar ? "محظور" : "Blocked",
    lead: ar ? "عميل محتمل" : "Lead",
    unknown: ar ? "غير محدد" : "Unknown",

    individual: ar ? "فرد" : "Individual",
    corporate: ar ? "شركة" : "Corporate",

    invoice: ar ? "فاتورة" : "Invoice",
    payment: ar ? "دفعة" : "Payment",
    order: ar ? "طلب" : "Order",

    loadError: ar ? "تعذر تحميل بيانات العميل." : "Unable to load customer data.",
    loadErrorHint: ar
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    notFound: ar ? "لم يتم العثور على بيانات العميل" : "Customer was not found",
    notFoundHint: ar
      ? "قد يكون السجل غير موجود أو لم يعد متاحًا."
      : "The record may not exist or may no longer be available.",
    statementError: ar
      ? "تعذر تحميل كشف حساب العميل."
      : "Unable to load customer statement.",
    emptyStatement: ar
      ? "لا توجد حركات في كشف الحساب."
      : "No statement lines available.",
    copied: ar ? "تم النسخ بنجاح." : "Copied successfully.",
    unavailable: ar ? "غير متوفر" : "Unavailable",
    refreshed: ar ? "تم تحديث بيانات العميل." : "Customer data refreshed.",
    statementPrintReady: ar
      ? "تم تجهيز نافذة طباعة كشف الحساب."
      : "Statement print window prepared.",
    printError: ar
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

    printGeneratedAt: ar ? "تاريخ الطباعة" : "Printed At",
    printCustomer: ar ? "العميل" : "Customer",
    printRows: ar ? "عدد الحركات" : "Rows Count",
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

function normalizeCustomer(payload: CustomerDetailResponse | unknown): CustomerDetail {
  const source = (payload || {}) as Record<string, unknown>;
  const obj =
    (source.customer as Record<string, unknown> | undefined) ||
    (source.data as Record<string, unknown> | undefined) ||
    source;

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
  const alternativePhone = pickString(obj, [
    "alternative_phone_number",
    "alternativePhoneNumber",
  ]);

  return {
    id: (obj.id ?? obj.pk ?? "") as number | string,
    code: pickString(obj, ["customer_code", "customerCode", "code"], "-"),
    name: pickString(
      obj,
      ["display_name", "displayName", "name", "full_name", "fullName"],
      fallbackName || "-",
    ),
    customerType,
    status: normalizeStatus(obj.status),
    source: pickString(obj, ["source"], "-"),

    firstName,
    lastName,
    companyName,
    gender: pickString(obj, ["gender"], "-"),
    dateOfBirth: pickString(obj, ["date_of_birth", "dateOfBirth"], ""),

    email,
    phone,
    whatsapp,
    alternativePhone,
    primaryContact:
      pickString(obj, ["primary_contact_number", "primaryContactNumber"]) ||
      whatsapp ||
      phone ||
      alternativePhone ||
      email,

    nationalId: pickString(obj, ["national_id", "nationalId"], "-"),
    passportNumber: pickString(obj, ["passport_number", "passportNumber"], "-"),
    nationality: pickString(obj, ["nationality"], "-"),

    country: pickString(obj, ["country"], "-"),
    city: pickString(obj, ["city"], "-"),
    district: pickString(obj, ["district"], "-"),
    streetAddress: pickString(obj, ["street_address", "streetAddress"], "-"),
    postalCode: pickString(obj, ["postal_code", "postalCode"], "-"),
    nationalAddressText: pickString(
      obj,
      ["national_address_text", "nationalAddressText"],
      "-",
    ),

    notes: pickString(obj, ["notes"], "-"),
    tags: pickString(obj, ["tags"], "-"),

    createdAt: pickString(obj, ["created_at", "createdAt"], ""),
    updatedAt: pickString(obj, ["updated_at", "updatedAt"], ""),
    raw: obj,
  };
}

function extractStatement(payload: StatementResponse) {
  return {
    summary:
      payload.statement?.summary ||
      payload.data?.statement?.summary ||
      payload.data?.summary ||
      payload.summary ||
      null,
    lines:
      payload.statement?.lines ||
      payload.data?.statement?.lines ||
      payload.data?.lines ||
      payload.lines ||
      [],
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

function statementTypeLabel(type: string, locale: AppLocale) {
  const t = dictionary(locale);
  const normalized = String(type || "").toUpperCase();

  if (normalized === "INVOICE") return t.invoice;
  if (normalized === "PAYMENT") return t.payment;
  if (normalized === "ORDER") return t.order;

  return type || "-";
}

function isValidCustomerId(id: CustomerDetail["id"]) {
  const value = String(id || "").trim();
  return value.length > 0 && value !== "-" && value !== "undefined";
}

function isUsableValue(value?: string) {
  const clean = String(value || "").trim();
  return clean.length > 0 && clean !== "-";
}

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function DetailsSkeleton() {
  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-3">
          <SkeletonLine className="h-8 w-64" />
          <SkeletonLine className="h-4 w-[520px] max-w-full" />
        </div>

        <div className="flex gap-2">
          <SkeletonLine className="h-10 w-28 rounded-xl" />
          <SkeletonLine className="h-10 w-24 rounded-xl" />
          <SkeletonLine className="h-10 w-24 rounded-xl" />
        </div>
      </div>

      <div className="grid w-full gap-4 xl:grid-cols-[380px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="space-y-4 p-4">
            <SkeletonLine className="h-56 w-full rounded-2xl" />
            <SkeletonLine className="mx-auto h-5 w-44" />
            <SkeletonLine className="mx-auto h-4 w-28" />
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonLine key={index} className="h-14 w-full rounded-xl" />
            ))}
          </CardContent>
        </Card>

        <main className="min-w-0 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonLine key={index} className="h-24 rounded-2xl" />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SkeletonLine className="h-72 rounded-2xl" />
            <SkeletonLine className="h-72 rounded-2xl" />
            <SkeletonLine className="h-72 rounded-2xl" />
            <SkeletonLine className="h-72 rounded-2xl" />
          </div>

          <SkeletonLine className="h-96 rounded-2xl" />
        </main>
      </div>
    </div>
  );
}

function buildStatementPrintHtml({
  locale,
  customer,
  lines,
  t,
}: {
  locale: AppLocale;
  customer: CustomerDetail;
  lines: StatementLine[];
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const direction = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";
  const generatedAt = new Date().toLocaleString("en-US");

  const rowsHtml = lines
    .map(
      (line) => `
        <tr>
          <td>${escapeHtml(formatDate(line.line_date))}</td>
          <td>${escapeHtml(line.reference || "-")}</td>
          <td>${escapeHtml(statementTypeLabel(line.line_type, locale))}</td>
          <td>${escapeHtml(line.description || "-")}</td>
          <td>${escapeHtml(formatMoneyValue(line.debit_amount))}</td>
          <td>${escapeHtml(formatMoneyValue(line.credit_amount))}</td>
          <td>${escapeHtml(formatMoneyValue(line.balance_after))}</td>
          <td>${escapeHtml(line.status || "-")}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html lang="${locale}" dir="${direction}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(t.statementTitle)}</title>
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
            direction: ${direction};
            text-align: ${align};
          }

          .header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }

          h1 {
            margin: 0 0 8px;
            font-size: 22px;
          }

          .meta {
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

          th,
          td {
            border: 1px solid #e5e7eb;
            padding: 9px;
            vertical-align: top;
            text-align: ${align};
          }

          th {
            background: #f9fafb;
            font-weight: 700;
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
        <div class="header">
          <div>
            <h1>${escapeHtml(t.statementTitle)}</h1>
            <div class="meta">
              <div>${escapeHtml(t.printCustomer)}: ${escapeHtml(customer.name)} - ${escapeHtml(customer.code)}</div>
              <div>${escapeHtml(t.printGeneratedAt)}: ${escapeHtml(generatedAt)}</div>
              <div>${escapeHtml(t.printRows)}: ${formatNumber(lines.length)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t.table.date)}</th>
              <th>${escapeHtml(t.table.reference)}</th>
              <th>${escapeHtml(t.table.type)}</th>
              <th>${escapeHtml(t.table.description)}</th>
              <th>${escapeHtml(t.table.debit)}</th>
              <th>${escapeHtml(t.table.credit)}</th>
              <th>${escapeHtml(t.table.balance)}</th>
              <th>${escapeHtml(t.table.status)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              rowsHtml ||
              `<tr><td colspan="8" style="text-align:center">${escapeHtml(
                t.emptyStatement,
              )}</td></tr>`
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

/* ============================================================
   Page
============================================================ */

export default function SystemCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const customerId = String(params?.id || "").trim();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [statementError, setStatementError] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const financialCards = useMemo(
    () => [
      {
        title: t.totalOrders,
        value: summary?.total_orders_count || 0,
        icon: FileText,
        isMoney: false,
      },
      {
        title: t.invoicesAmount,
        value: summary?.total_invoices_amount || "0",
        icon: Wallet,
        isMoney: true,
      },
      {
        title: t.paidAmount,
        value: summary?.total_paid_amount || "0",
        icon: BadgeCheck,
        isMoney: true,
      },
      {
        title: t.dueAmount,
        value: summary?.total_due_amount || "0",
        icon: CreditCard,
        isMoney: true,
      },
    ],
    [summary, t],
  );

  const canOpenOperationalLinks = Boolean(customer && isValidCustomerId(customer.id));

  async function loadCustomer(showSuccessToast = false) {
    if (!customerId) {
      setCustomer(null);
      setErrorMessage(t.loadError);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      setStatementError("");

      const detailResponse = await apiGet<CustomerDetailResponse>(
        API_PATHS.customers.detail(customerId),
      );

      if (!detailResponse.ok) {
        setCustomer(null);
        setSummary(null);
        setLines([]);
        setErrorMessage(detailResponse.message || t.loadError);
        return;
      }

      const normalizedCustomer = normalizeCustomer(detailResponse.data);

      if (!isValidCustomerId(normalizedCustomer.id)) {
        setCustomer(null);
        setSummary(null);
        setLines([]);
        setErrorMessage("");
        return;
      }

      setCustomer(normalizedCustomer);

      const statementResponse = await apiGet<StatementResponse>(
        `/api/customers/${customerId}/statement/`,
      );

      if (statementResponse.ok) {
        const statement = extractStatement(statementResponse.data);
        setSummary(statement.summary);
        setLines(statement.lines);
      } else {
        setSummary(null);
        setLines([]);
        setStatementError(statementResponse.message || t.statementError);
      }

      if (showSuccessToast) {
        toast.success(t.refreshed);
      }
    } catch (error) {
      console.error("Load customer details error:", error);
      setCustomer(null);
      setSummary(null);
      setLines([]);
      setErrorMessage(t.loadError);
      toast.error(t.loadError);
    } finally {
      setIsLoading(false);
    }
  }

  async function copyToClipboard(value: string) {
    const cleanValue = String(value || "").trim();

    if (!isUsableValue(cleanValue)) {
      toast.error(t.unavailable);
      return;
    }

    try {
      await navigator.clipboard.writeText(cleanValue);
      toast.success(t.copied);
    } catch (error) {
      console.error("Copy error:", error);
      toast.error(t.unavailable);
    }
  }

  function printStatement() {
    if (!customer) return;

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildStatementPrintHtml({
        locale,
        customer,
        lines,
        t,
      }),
    );
    printWindow.document.close();

    toast.success(t.statementPrintReady);
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
    loadCustomer(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, locale]);

  if (isLoading) {
    return <DetailsSkeleton />;
  }

  if (errorMessage) {
    return (
      <div className="w-full space-y-4" dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
              {t.pageTitle}
            </h1>
            <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
              {t.pageSubtitle}
            </p>
          </div>

          <Link href="/system/customers/list">
            <Button variant="outline" className="h-10 rounded-xl">
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </Button>
          </Link>
        </div>

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
              onClick={() => loadCustomer(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="w-full space-y-4" dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
              {t.pageTitle}
            </h1>
            <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
              {t.pageSubtitle}
            </p>
          </div>

          <Link href="/system/customers/list">
            <Button variant="outline" className="h-10 rounded-xl">
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </Button>
          </Link>
        </div>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <UserRound className="h-7 w-7 text-muted-foreground" />
            </div>

            <div>
              <p className="font-semibold">{t.notFound}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.notFoundHint}
              </p>
            </div>

            <Link href="/system/customers/list">
              <Button className="mt-2 rounded-xl">
                <ArrowLeft className="h-4 w-4" />
                {t.back}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4" dir={isArabic ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {statusBadge(customer.status, locale)}
            <Badge variant="secondary" className="rounded-full">
              {typeLabel(customer.customerType, locale)}
            </Badge>
          </div>

          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {customer.name}
          </h1>

          <div className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground lg:flex-row lg:flex-wrap lg:gap-4">
            <div>
              <span className="font-semibold text-foreground">
                {t.customerCode}:
              </span>{" "}
              {customer.code}
            </div>

            <div>
              <span className="font-semibold text-foreground">
                {t.phone}:
              </span>{" "}
              {customer.primaryContact || "-"}
            </div>

            <div>
              <span className="font-semibold text-foreground">
                {t.createdAt}:
              </span>{" "}
              {formatDate(customer.createdAt)}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/system/customers/list">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadCustomer(true)}
          >
            <RefreshCcw className="h-4 w-4" />
            {t.refresh}
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={printStatement}
          >
            <Printer className="h-4 w-4" />
            {t.print}
          </Button>
        </div>
      </div>

      <div className="grid w-full gap-4 xl:grid-cols-[380px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* Profile */}
        <aside className="min-w-0 space-y-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-4 p-4">
              <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border bg-muted">
                <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-background shadow-sm">
                  {customer.customerType === "CORPORATE" ? (
                    <Building2 className="h-14 w-14 text-muted-foreground" />
                  ) : (
                    <UserRound className="h-14 w-14 text-muted-foreground" />
                  )}
                </div>
              </div>

              <div className="space-y-2 text-center">
                <h2 className="text-lg font-bold">{customer.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {customer.code}
                </p>

                <div className="flex flex-wrap justify-center gap-2">
                  <Badge variant="secondary" className="rounded-full">
                    {typeLabel(customer.customerType, locale)}
                  </Badge>
                  {statusBadge(customer.status, locale)}
                </div>
              </div>

              <div className="grid gap-2">
                <QuickInfo
                  icon={ShieldCheck}
                  label={t.customerCode}
                  value={customer.code || "-"}
                  onCopy={() => copyToClipboard(customer.code)}
                />

                <QuickInfo
                  icon={Phone}
                  label={t.phone}
                  value={customer.phone || customer.primaryContact || "-"}
                  onCopy={() =>
                    copyToClipboard(customer.phone || customer.primaryContact)
                  }
                />

                <QuickInfo
                  icon={Phone}
                  label={t.whatsapp}
                  value={customer.whatsapp || "-"}
                  onCopy={() => copyToClipboard(customer.whatsapp)}
                />

                <QuickInfo
                  icon={Mail}
                  label={t.email}
                  value={customer.email || "-"}
                  onCopy={() => copyToClipboard(customer.email)}
                />

                <QuickInfo
                  icon={ShieldCheck}
                  label={t.nationalId}
                  value={customer.nationalId || "-"}
                  onCopy={() => copyToClipboard(customer.nationalId)}
                />

                <QuickInfo
                  icon={MapPin}
                  label={t.city}
                  value={customer.city || customer.district || "-"}
                />
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Content */}
        <main className="min-w-0 space-y-4">
          {/* Financial Summary */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {financialCards.map((item) => {
              const Icon = item.icon;

              return (
                <Card key={item.title} className="rounded-2xl border shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">
                          {item.title}
                        </p>

                        <div className="mt-2 flex items-center gap-2">
                          <p className="truncate text-xl font-bold">
                            {item.isMoney
                              ? formatMoneyValue(item.value)
                              : formatNumber(item.value)}
                          </p>

                          {item.isMoney ? (
                            <Image
                              src="/currency/sar.svg"
                              alt=""
                              width={16}
                              height={16}
                            />
                          ) : null}
                        </div>
                      </div>

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <InfoCard
              title={t.contactInfo}
              icon={Phone}
              items={[
                {
                  label: t.email,
                  value: customer.email || "-",
                  icon: Mail,
                  copyValue: customer.email,
                  onCopy: copyToClipboard,
                },
                {
                  label: t.phone,
                  value: customer.phone || "-",
                  icon: Phone,
                  copyValue: customer.phone,
                  onCopy: copyToClipboard,
                },
                {
                  label: t.whatsapp,
                  value: customer.whatsapp || "-",
                  icon: Phone,
                  copyValue: customer.whatsapp,
                  onCopy: copyToClipboard,
                },
                {
                  label: t.alternativePhone,
                  value: customer.alternativePhone || "-",
                  icon: Phone,
                  copyValue: customer.alternativePhone,
                  onCopy: copyToClipboard,
                },
              ]}
            />

            <InfoCard
              title={t.addressInfo}
              icon={MapPin}
              items={[
                { label: t.country, value: customer.country || "-", icon: MapPin },
                { label: t.city, value: customer.city || "-", icon: MapPin },
                {
                  label: t.district,
                  value: customer.district || "-",
                  icon: MapPin,
                },
                {
                  label: t.streetAddress,
                  value: customer.streetAddress || "-",
                  icon: MapPin,
                },
                {
                  label: t.postalCode,
                  value: customer.postalCode || "-",
                  icon: MapPin,
                },
              ]}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <InfoCard
              title={t.legalInfo}
              icon={ShieldCheck}
              items={[
                {
                  label: t.nationalId,
                  value: customer.nationalId || "-",
                  icon: ShieldCheck,
                  copyValue: customer.nationalId,
                  onCopy: copyToClipboard,
                },
                {
                  label: t.passportNumber,
                  value: customer.passportNumber || "-",
                  icon: ShieldCheck,
                  copyValue: customer.passportNumber,
                  onCopy: copyToClipboard,
                },
                {
                  label: t.nationality,
                  value: customer.nationality || "-",
                  icon: ShieldCheck,
                },
                {
                  label: t.gender,
                  value: customer.gender || "-",
                  icon: UserRound,
                },
                {
                  label: t.dateOfBirth,
                  value: customer.dateOfBirth || "-",
                  icon: CalendarDays,
                },
              ]}
            />

            <InfoCard
              title={t.notesInfo}
              icon={Activity}
              items={[
                { label: t.tags, value: customer.tags || "-", icon: BadgeCheck },
                {
                  label: t.notes,
                  value: customer.notes || t.noNotes,
                  icon: FileText,
                },
                {
                  label: t.nationalAddress,
                  value: customer.nationalAddressText || "-",
                  icon: MapPin,
                },
              ]}
            />
          </div>

          {/* Operational Links */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {t.operationalLinks}
              </CardTitle>
              <CardDescription>{t.operationalLinksDesc}</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {canOpenOperationalLinks ? (
                  <>
                    <QuickLink
                      title={t.invoices}
                      href={`/system/invoices/list?customer=${customer.id}`}
                      icon={FileText}
                    />
                    <QuickLink
                      title={t.payments}
                      href={`/system/payments/list?customer=${customer.id}`}
                      icon={Wallet}
                    />
                    <QuickLink
                      title={t.orders}
                      href={`/system/orders/list?customer=${customer.id}`}
                      icon={CheckCircle2}
                    />
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground md:col-span-3">
                    {t.unavailable}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Statement */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base font-bold">
                  {t.statementTitle}
                </CardTitle>
                <CardDescription>{t.statementSubtitle}</CardDescription>
              </div>

              <Button
                variant="outline"
                className="rounded-xl"
                onClick={printStatement}
              >
                <Printer className="h-4 w-4" />
                {t.print}
              </Button>
            </CardHeader>

            <CardContent className="space-y-4">
              {statementError ? (
                <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                    <XCircle className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="font-semibold text-destructive">
                      {statementError}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t.loadErrorHint}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="overflow-hidden rounded-xl border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.table.date}</TableHead>
                        <TableHead>{t.table.reference}</TableHead>
                        <TableHead>{t.table.type}</TableHead>
                        <TableHead>{t.table.description}</TableHead>
                        <TableHead>{t.table.debit}</TableHead>
                        <TableHead>{t.table.credit}</TableHead>
                        <TableHead>{t.table.balance}</TableHead>
                        <TableHead>{t.table.status}</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {lines.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-32 text-center">
                            <div className="mx-auto max-w-md space-y-2">
                              <p className="font-semibold">
                                {t.emptyStatement}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {statementError ? t.loadErrorHint : t.statementSubtitle}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        lines.map((line, index) => (
                          <TableRow key={`${line.reference}-${index}`}>
                            <TableCell>{formatDate(line.line_date)}</TableCell>

                            <TableCell className="font-medium">
                              {line.reference || "-"}
                            </TableCell>

                            <TableCell>
                              <Badge variant="secondary" className="rounded-full">
                                {statementTypeLabel(line.line_type, locale)}
                              </Badge>
                            </TableCell>

                            <TableCell>{line.description || "-"}</TableCell>

                            <TableCell>
                              <MoneyAmount value={line.debit_amount} />
                            </TableCell>

                            <TableCell>
                              <MoneyAmount value={line.credit_amount} />
                            </TableCell>

                            <TableCell className="font-semibold">
                              <MoneyAmount value={line.balance_after} />
                            </TableCell>

                            <TableCell>
                              <Badge variant="outline" className="rounded-full">
                                {line.status || "-"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

/* ============================================================
   Small Components
============================================================ */

function MoneyAmount({ value }: { value: string | number | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span>{formatMoneyValue(value)}</span>
      <Image src="/currency/sar.svg" alt="" width={14} height={14} />
    </span>
  );
}

function QuickInfo({
  icon: Icon,
  label,
  value,
  onCopy,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border bg-background p-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-sm font-semibold">{value}</p>
        </div>
      </div>

      {onCopy ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-lg"
          onClick={onCopy}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

function InfoCard({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  items: Array<{
    label: string;
    value: ReactNode;
    icon: ComponentType<{ className?: string }>;
    copyValue?: string;
    onCopy?: (value: string) => void;
  }>;
}) {
  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {items.map((item) => {
          const ItemIcon = item.icon;

          return (
            <div
              key={item.label}
              className="flex items-start justify-between gap-3 rounded-xl border bg-background p-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <ItemIcon className="h-4 w-4" />
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 break-words text-sm font-medium">
                    {item.value || "-"}
                  </p>
                </div>
              </div>

              {item.copyValue && item.onCopy ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-lg"
                  onClick={() => item.onCopy?.(item.copyValue || "")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function QuickLink({
  title,
  href,
  icon: Icon,
}: {
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href} className="block">
      <Card className="h-full rounded-2xl border bg-background shadow-none transition hover:bg-muted/40">
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <p className="font-semibold">{title}</p>

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}