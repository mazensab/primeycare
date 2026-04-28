"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ColumnsIcon,
  CreditCard,
  Download,
  Eye,
  FileText,
  FilterIcon,
  Loader2,
  Plus,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldCheck,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

/* =====================================================
   TYPES
===================================================== */

type AppLocale = "ar" | "en";

type SortDirection = "asc" | "desc";

type SortKey =
  | "reference"
  | "status"
  | "payment_method"
  | "payment_date"
  | "customer_id"
  | "invoice_id"
  | "amount";

type PaymentStatus =
  | "ALL"
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "PARTIALLY_PAID"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

type PaymentMethod =
  | "ALL"
  | "CASH"
  | "BANK_TRANSFER"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "WALLET"
  | "APPLE_PAY"
  | "STC_PAY"
  | "TAMARA"
  | "TABBY"
  | "OTHER";

type ApiPayment = {
  id: number;
  reference?: string | null;
  status?: string | null;
  payment_method?: string | null;
  invoice_id?: number | null;
  customer_id?: number | null;
  amount?: string | number | null;
  payment_date?: string | null;
};

type PaymentsApiResponse = {
  ok?: boolean;
  count?: number;
  results?: ApiPayment[];
  message?: string;
};

type ConfirmPaymentResponse = {
  ok?: boolean;
  message?: string;
  payment?: {
    id?: number;
    status_before?: string;
    status_after?: string;
  };
};

type ColumnKey =
  | "select"
  | "reference"
  | "customer"
  | "invoice"
  | "method"
  | "status"
  | "paymentDate"
  | "amount"
  | "actions";

type ColumnConfig = {
  key: ColumnKey;
  labelAr: string;
  labelEn: string;
  visible: boolean;
};

type StatusMeta = {
  labelAr: string;
  labelEn: string;
  className: string;
};

type MethodMeta = {
  labelAr: string;
  labelEn: string;
};

/* =====================================================
   CONSTANTS
===================================================== */

const SAR_ICON_PATH = "/currency/sar.svg";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const STATUS_META: Record<string, StatusMeta> = {
  PENDING: {
    labelAr: "قيد الانتظار",
    labelEn: "Pending",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
  },
  PROCESSING: {
    labelAr: "قيد المعالجة",
    labelEn: "Processing",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
  },
  PAID: {
    labelAr: "مدفوع",
    labelEn: "Paid",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  PARTIALLY_PAID: {
    labelAr: "مدفوع جزئيًا",
    labelEn: "Partially Paid",
    className:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/40 dark:text-cyan-300",
  },
  FAILED: {
    labelAr: "فشل",
    labelEn: "Failed",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
  },
  CANCELLED: {
    labelAr: "ملغي",
    labelEn: "Cancelled",
    className:
      "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300",
  },
  REFUNDED: {
    labelAr: "مسترد",
    labelEn: "Refunded",
    className:
      "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300",
  },
  PARTIALLY_REFUNDED: {
    labelAr: "مسترد جزئيًا",
    labelEn: "Partially Refunded",
    className:
      "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900/60 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
  },
};

const METHOD_META: Record<string, MethodMeta> = {
  CASH: { labelAr: "نقدي", labelEn: "Cash" },
  BANK_TRANSFER: { labelAr: "تحويل بنكي", labelEn: "Bank Transfer" },
  CREDIT_CARD: { labelAr: "بطاقة ائتمانية", labelEn: "Credit Card" },
  DEBIT_CARD: { labelAr: "مدى / خصم", labelEn: "Debit Card" },
  WALLET: { labelAr: "محفظة", labelEn: "Wallet" },
  APPLE_PAY: { labelAr: "Apple Pay", labelEn: "Apple Pay" },
  STC_PAY: { labelAr: "STC Pay", labelEn: "STC Pay" },
  TAMARA: { labelAr: "تمارا", labelEn: "Tamara" },
  TABBY: { labelAr: "تابي", labelEn: "Tabby" },
  OTHER: { labelAr: "أخرى", labelEn: "Other" },
};

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: "select", labelAr: "تحديد", labelEn: "Select", visible: true },
  { key: "reference", labelAr: "الدفعة", labelEn: "Payment", visible: true },
  { key: "customer", labelAr: "العميل", labelEn: "Customer", visible: true },
  { key: "invoice", labelAr: "الفاتورة", labelEn: "Invoice", visible: true },
  { key: "method", labelAr: "الطريقة", labelEn: "Method", visible: true },
  { key: "status", labelAr: "الحالة", labelEn: "Status", visible: true },
  { key: "paymentDate", labelAr: "تاريخ الدفع", labelEn: "Payment Date", visible: true },
  { key: "amount", labelAr: "المبلغ", labelEn: "Amount", visible: true },
  { key: "actions", labelAr: "الإجراءات", labelEn: "Actions", visible: true },
];

/* =====================================================
   LOCALE HELPERS
===================================================== */

function getInitialLocale(): AppLocale {
  if (typeof window === "undefined") return "ar";

  const stored = window.localStorage.getItem("primey-locale");
  if (stored === "ar" || stored === "en") return stored;

  const htmlLang = document.documentElement.lang;
  if (htmlLang === "en") return "en";

  return "ar";
}

function applyLocaleToDocument(locale: AppLocale) {
  if (typeof document === "undefined") return;

  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  document.body.dir = locale === "ar" ? "rtl" : "ltr";
}

/* =====================================================
   FORMAT HELPERS
===================================================== */

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;

  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string | null | undefined, locale: AppLocale): string {
  if (!value) return locale === "ar" ? "غير محدد" : "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return locale === "ar" ? "غير محدد" : "Not set";

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getStatusLabel(status: string | null | undefined, locale: AppLocale): string {
  const key = String(status || "PENDING").toUpperCase();
  const meta = STATUS_META[key];

  if (!meta) return status || (locale === "ar" ? "غير محدد" : "Unknown");

  return locale === "ar" ? meta.labelAr : meta.labelEn;
}

function getStatusClassName(status: string | null | undefined): string {
  const key = String(status || "PENDING").toUpperCase();
  return STATUS_META[key]?.className || STATUS_META.PENDING.className;
}

function getMethodLabel(method: string | null | undefined, locale: AppLocale): string {
  const key = String(method || "OTHER").toUpperCase();
  const meta = METHOD_META[key];

  if (!meta) return method || (locale === "ar" ? "غير محدد" : "Unknown");

  return locale === "ar" ? meta.labelAr : meta.labelEn;
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || "";

  return "";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =====================================================
   API HELPERS
===================================================== */

async function fetchPayments(): Promise<ApiPayment[]> {
  const response = await fetch("/api/payments/?limit=200", {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as PaymentsApiResponse | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || "Failed to load payments.");
  }

  return Array.isArray(data.results) ? data.results : [];
}

async function confirmPayment(paymentId: number): Promise<ConfirmPaymentResponse> {
  const csrfToken = getCookie("csrftoken");

  const response = await fetch(`/api/payments/${paymentId}/confirm/`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    body: JSON.stringify({
      auto_create_treasury_movement: true,
      auto_post_accounting: true,
    }),
  });

  const data = (await response.json().catch(() => null)) as ConfirmPaymentResponse | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || "Failed to confirm payment.");
  }

  return data;
}

/* =====================================================
   PAGE
===================================================== */

export default function SystemPaymentsListPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus>("ALL");
  const [methodFilter, setMethodFilter] = useState<PaymentMethod>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);

  const [sortKey, setSortKey] = useState<SortKey>("payment_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const isAr = locale === "ar";

  const t = useMemo(
    () => ({
      badge: isAr ? "قائمة المدفوعات" : "Payments List",
      title: isAr ? "قائمة المدفوعات" : "Payments List",
      subtitle: isAr
        ? "استعراض المدفوعات، البحث، الفلترة، التأكيد، التصدير والطباعة بنفس الهوية الرسمية للنظام."
        : "Browse payments with search, filters, confirmation, export, and print using the official system identity.",
      back: isAr ? "لوحة المدفوعات" : "Payments Dashboard",
      create: isAr ? "تسجيل دفعة" : "Create Payment",
      reports: isAr ? "التقارير" : "Reports",
      refresh: isAr ? "تحديث" : "Refresh",
      searchPlaceholder: isAr
        ? "ابحث برقم الدفعة أو العميل أو الفاتورة أو طريقة الدفع..."
        : "Search by payment, customer, invoice, or method...",
      filters: isAr ? "الفلاتر" : "Filters",
      status: isAr ? "الحالة" : "Status",
      method: isAr ? "طريقة الدفع" : "Payment Method",
      allStatuses: isAr ? "كل الحالات" : "All Statuses",
      allMethods: isAr ? "كل الطرق" : "All Methods",
      from: isAr ? "من تاريخ" : "From",
      to: isAr ? "إلى تاريخ" : "To",
      clear: isAr ? "مسح الفلاتر" : "Clear Filters",
      columns: isAr ? "الأعمدة" : "Columns",
      exportExcel: isAr ? "تصدير Excel" : "Export Excel",
      print: isAr ? "طباعة Web PDF" : "Print Web PDF",
      selected: isAr ? "محدد" : "Selected",
      payments: isAr ? "دفعة" : "Payments",
      payment: isAr ? "الدفعة" : "Payment",
      customer: isAr ? "العميل" : "Customer",
      invoice: isAr ? "الفاتورة" : "Invoice",
      paymentDate: isAr ? "تاريخ الدفع" : "Payment Date",
      amount: isAr ? "المبلغ" : "Amount",
      actions: isAr ? "الإجراءات" : "Actions",
      details: isAr ? "عرض" : "View",
      confirm: isAr ? "تأكيد" : "Confirm",
      confirming: isAr ? "جاري التأكيد..." : "Confirming...",
      empty: isAr ? "لا توجد مدفوعات مطابقة للفلاتر الحالية." : "No payments match current filters.",
      loading: isAr ? "جاري تحميل المدفوعات..." : "Loading payments...",
      totalPayments: isAr ? "إجمالي المدفوعات" : "Total Payments",
      paidPayments: isAr ? "مدفوعة" : "Paid",
      pendingPayments: isAr ? "قيد الانتظار" : "Pending",
      failedPayments: isAr ? "فاشلة" : "Failed",
      collectedAmount: isAr ? "إجمالي التحصيل" : "Collected Amount",
      pendingAmount: isAr ? "مبالغ معلقة" : "Pending Amount",
      page: isAr ? "صفحة" : "Page",
      of: isAr ? "من" : "of",
      rowsPerPage: isAr ? "عدد الصفوف" : "Rows",
      notAvailable: isAr ? "غير متاح" : "N/A",
      sar: isAr ? "ريال" : "SAR",
      exportSuccess: isAr ? "تم تصدير ملف Excel بنجاح" : "Excel file exported successfully",
      printTitle: isAr ? "قائمة المدفوعات" : "Payments List",
      refreshSuccess: isAr ? "تم تحديث قائمة المدفوعات بنجاح" : "Payments list refreshed successfully",
      loadError: isAr ? "تعذر تحميل قائمة المدفوعات" : "Failed to load payments list",
      confirmSuccess: isAr ? "تم تأكيد الدفعة بنجاح" : "Payment confirmed successfully",
      confirmError: isAr ? "تعذر تأكيد الدفعة" : "Failed to confirm payment",
    }),
    [isAr]
  );

  const visibleColumns = useMemo(
    () => columns.filter((column) => column.visible),
    [columns]
  );

  const hasColumn = (key: ColumnKey) =>
    visibleColumns.some((column) => column.key === key);

  const loadPayments = async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      const data = await fetchPayments();
      setPayments(data);

      if (mode === "refresh") {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error(error);
      toast.error(t.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const currentLocale = getInitialLocale();
    setLocale(currentLocale);
    applyLocaleToDocument(currentLocale);

    const syncLocale = () => {
      const nextLocale = getInitialLocale();
      setLocale(nextLocale);
      applyLocaleToDocument(nextLocale);
    };

    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    const timeout = window.setTimeout(syncLocale, 50);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    loadPayments("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const totalPayments = payments.length;

    const paidPayments = payments.filter((payment) => {
      const status = String(payment.status || "").toUpperCase();
      return status === "PAID" || status === "PARTIALLY_PAID";
    }).length;

    const pendingPayments = payments.filter((payment) => {
      const status = String(payment.status || "").toUpperCase();
      return status === "PENDING" || status === "PROCESSING";
    }).length;

    const failedPayments = payments.filter(
      (payment) => String(payment.status || "").toUpperCase() === "FAILED"
    ).length;

    const collectedAmount = payments.reduce((sum, payment) => {
      const status = String(payment.status || "").toUpperCase();
      if (status === "PAID" || status === "PARTIALLY_PAID") {
        return sum + toNumber(payment.amount);
      }
      return sum;
    }, 0);

    const pendingAmount = payments.reduce((sum, payment) => {
      const status = String(payment.status || "").toUpperCase();
      if (status === "PENDING" || status === "PROCESSING") {
        return sum + toNumber(payment.amount);
      }
      return sum;
    }, 0);

    return {
      totalPayments,
      paidPayments,
      pendingPayments,
      failedPayments,
      collectedAmount,
      pendingAmount,
    };
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return payments.filter((payment) => {
      const status = String(payment.status || "PENDING").toUpperCase();
      const method = String(payment.payment_method || "OTHER").toUpperCase();

      if (statusFilter !== "ALL" && status !== statusFilter) return false;
      if (methodFilter !== "ALL" && method !== methodFilter) return false;

      if (dateFrom || dateTo) {
        const paymentDate = payment.payment_date ? new Date(payment.payment_date) : null;

        if (!paymentDate || Number.isNaN(paymentDate.getTime())) return false;

        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          if (paymentDate < fromDate) return false;
        }

        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (paymentDate > toDate) return false;
        }
      }

      if (!keyword) return true;

      const haystack = [
        payment.id,
        payment.reference,
        payment.status,
        getStatusLabel(payment.status, "ar"),
        getStatusLabel(payment.status, "en"),
        payment.payment_method,
        getMethodLabel(payment.payment_method, "ar"),
        getMethodLabel(payment.payment_method, "en"),
        payment.customer_id,
        payment.invoice_id,
        payment.amount,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [dateFrom, dateTo, methodFilter, payments, search, statusFilter]);

  const sortedPayments = useMemo(() => {
    const data = [...filteredPayments];

    data.sort((a, b) => {
      let left: string | number = "";
      let right: string | number = "";

      if (sortKey === "reference") {
        left = a.reference || `PAY-${a.id}`;
        right = b.reference || `PAY-${b.id}`;
      }

      if (sortKey === "status") {
        left = a.status || "";
        right = b.status || "";
      }

      if (sortKey === "payment_method") {
        left = a.payment_method || "";
        right = b.payment_method || "";
      }

      if (sortKey === "payment_date") {
        left = a.payment_date ? new Date(a.payment_date).getTime() : 0;
        right = b.payment_date ? new Date(b.payment_date).getTime() : 0;
      }

      if (sortKey === "customer_id") {
        left = a.customer_id || 0;
        right = b.customer_id || 0;
      }

      if (sortKey === "invoice_id") {
        left = a.invoice_id || 0;
        right = b.invoice_id || 0;
      }

      if (sortKey === "amount") {
        left = toNumber(a.amount);
        right = toNumber(b.amount);
      }

      if (typeof left === "number" && typeof right === "number") {
        return sortDirection === "asc" ? left - right : right - left;
      }

      return sortDirection === "asc"
        ? String(left).localeCompare(String(right))
        : String(right).localeCompare(String(left));
    });

    return data;
  }, [filteredPayments, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedPayments.length / pageSize));

  const paginatedPayments = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * pageSize;
    return sortedPayments.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedPayments, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, methodFilter, dateFrom, dateTo, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pageSelected = useMemo(() => {
    if (paginatedPayments.length === 0) return false;
    return paginatedPayments.every((payment) => selectedIds.includes(payment.id));
  }, [paginatedPayments, selectedIds]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  const toggleColumn = (key: ColumnKey) => {
    if (key === "actions") return;

    setColumns((current) =>
      current.map((column) =>
        column.key === key ? { ...column, visible: !column.visible } : column
      )
    );
  };

  const togglePaymentSelection = (paymentId: number) => {
    setSelectedIds((current) =>
      current.includes(paymentId)
        ? current.filter((id) => id !== paymentId)
        : [...current, paymentId]
    );
  };

  const togglePageSelection = () => {
    const pageIds = paginatedPayments.map((payment) => payment.id);

    if (pageSelected) {
      setSelectedIds((current) => current.filter((id) => !pageIds.includes(id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...pageIds])));
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setMethodFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setSelectedIds([]);
  };

  const handleConfirmPayment = async (paymentId: number) => {
    try {
      setConfirmingId(paymentId);

      const result = await confirmPayment(paymentId);

      toast.success(result.message || t.confirmSuccess);

      await loadPayments("refresh");
    } catch (error) {
      console.error(error);
      toast.error(t.confirmError);
    } finally {
      setConfirmingId(null);
    }
  };

  const exportRows = useMemo(() => {
    const selectedSet = new Set(selectedIds);

    return selectedIds.length > 0
      ? sortedPayments.filter((payment) => selectedSet.has(payment.id))
      : sortedPayments;
  }, [selectedIds, sortedPayments]);

  const buildExportTableRows = (rows: ApiPayment[]) => {
    return rows
      .map((payment) => {
        const reference = payment.reference || `PAY-${payment.id}`;
        const customer = payment.customer_id ? `#${payment.customer_id}` : t.notAvailable;
        const invoice = payment.invoice_id ? `#${payment.invoice_id}` : t.notAvailable;
        const method = getMethodLabel(payment.payment_method, locale);
        const status = getStatusLabel(payment.status, locale);
        const date = formatDate(payment.payment_date, locale);
        const amount = formatMoney(toNumber(payment.amount));

        return `
          <tr>
            <td>${escapeHtml(reference)}</td>
            <td>${escapeHtml(customer)}</td>
            <td>${escapeHtml(invoice)}</td>
            <td>${escapeHtml(method)}</td>
            <td>${escapeHtml(status)}</td>
            <td>${escapeHtml(date)}</td>
            <td>${escapeHtml(amount)}</td>
          </tr>
        `;
      })
      .join("");
  };

  const exportExcel = () => {
    if (exportRows.length === 0) {
      toast.error(isAr ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }

    const title = t.printTitle;
    const generatedAt = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());

    const html = `
      <html dir="${isAr ? "rtl" : "ltr"}" lang="${locale}">
        <head>
          <meta charset="UTF-8" />
          <style>
            body {
              font-family: Arial, sans-serif;
              direction: ${isAr ? "rtl" : "ltr"};
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            th {
              background: #f1f5f9;
              color: #0f172a;
              font-weight: 700;
              border: 1px solid #cbd5e1;
              padding: 10px;
              text-align: ${isAr ? "right" : "left"};
            }
            td {
              border: 1px solid #cbd5e1;
              padding: 10px;
              text-align: ${isAr ? "right" : "left"};
            }
            .title {
              font-size: 20px;
              font-weight: 700;
              margin-bottom: 6px;
            }
            .meta {
              color: #475569;
              margin-bottom: 18px;
            }
          </style>
        </head>
        <body>
          <div class="title">${escapeHtml(title)}</div>
          <div class="meta">${escapeHtml(generatedAt)}</div>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.payment)}</th>
                <th>${escapeHtml(t.customer)}</th>
                <th>${escapeHtml(t.invoice)}</th>
                <th>${escapeHtml(t.method)}</th>
                <th>${escapeHtml(t.status)}</th>
                <th>${escapeHtml(t.paymentDate)}</th>
                <th>${escapeHtml(t.amount)}</th>
              </tr>
            </thead>
            <tbody>
              ${buildExportTableRows(exportRows)}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob(["\ufeff", html], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `primey-care-payments-${dateStamp}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t.exportSuccess);
  };

  const printTable = () => {
    if (exportRows.length === 0) {
      toast.error(isAr ? "لا توجد بيانات للطباعة" : "No data to print");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      toast.error(isAr ? "تعذر فتح نافذة الطباعة" : "Unable to open print window");
      return;
    }

    const generatedAt = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());

    const printTotal = exportRows.reduce(
      (sum, payment) => sum + toNumber(payment.amount),
      0
    );

    const html = `
      <!doctype html>
      <html lang="${locale}" dir="${isAr ? "rtl" : "ltr"}">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(t.printTitle)}</title>
          <style>
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 32px;
              font-family: Arial, sans-serif;
              direction: ${isAr ? "rtl" : "ltr"};
              color: #0f172a;
              background: #ffffff;
            }
            .header {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              align-items: flex-start;
              margin-bottom: 24px;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 16px;
            }
            .title {
              font-size: 24px;
              font-weight: 800;
              margin: 0 0 8px;
            }
            .subtitle {
              margin: 0;
              color: #475569;
              font-size: 13px;
            }
            .summary {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 12px;
              margin-bottom: 24px;
            }
            .card {
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              padding: 12px;
              background: #f8fafc;
            }
            .card-label {
              color: #64748b;
              font-size: 12px;
              margin-bottom: 6px;
            }
            .card-value {
              font-size: 18px;
              font-weight: 800;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            th {
              background: #f1f5f9;
              border: 1px solid #cbd5e1;
              padding: 10px;
              text-align: ${isAr ? "right" : "left"};
              white-space: nowrap;
            }
            td {
              border: 1px solid #cbd5e1;
              padding: 10px;
              text-align: ${isAr ? "right" : "left"};
              vertical-align: top;
            }
            tr:nth-child(even) td {
              background: #f8fafc;
            }
            @media print {
              body {
                padding: 18px;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">${escapeHtml(t.printTitle)}</h1>
              <p class="subtitle">${escapeHtml(generatedAt)}</p>
            </div>
            <button class="no-print" onclick="window.print()">${escapeHtml(t.print)}</button>
          </div>

          <div class="summary">
            <div class="card">
              <div class="card-label">${escapeHtml(t.totalPayments)}</div>
              <div class="card-value">${escapeHtml(formatNumber(exportRows.length))}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.amount)}</div>
              <div class="card-value">${escapeHtml(formatMoney(printTotal))}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.selected)}</div>
              <div class="card-value">${escapeHtml(formatNumber(selectedIds.length))}</div>
            </div>
            <div class="card">
              <div class="card-label">${escapeHtml(t.status)}</div>
              <div class="card-value">${escapeHtml(
                statusFilter === "ALL" ? t.allStatuses : getStatusLabel(statusFilter, locale)
              )}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t.payment)}</th>
                <th>${escapeHtml(t.customer)}</th>
                <th>${escapeHtml(t.invoice)}</th>
                <th>${escapeHtml(t.method)}</th>
                <th>${escapeHtml(t.status)}</th>
                <th>${escapeHtml(t.paymentDate)}</th>
                <th>${escapeHtml(t.amount)}</th>
              </tr>
            </thead>
            <tbody>
              ${buildExportTableRows(exportRows)}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  const statCards = [
    {
      title: t.totalPayments,
      value: formatNumber(stats.totalPayments),
      icon: ReceiptText,
      description: isAr ? "كل المدفوعات المسجلة" : "All registered payments",
    },
    {
      title: t.paidPayments,
      value: formatNumber(stats.paidPayments),
      icon: CheckCircle2,
      description: isAr ? "مدفوعات مؤكدة" : "Confirmed payments",
    },
    {
      title: t.pendingPayments,
      value: formatNumber(stats.pendingPayments),
      icon: ShieldCheck,
      description: isAr ? "مدفوعات تحتاج متابعة" : "Payments needing follow-up",
    },
    {
      title: t.collectedAmount,
      value: formatMoney(stats.collectedAmount),
      icon: Wallet,
      description: t.sar,
      money: true,
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* =====================================================
            HERO
        ===================================================== */}
        <section className="relative overflow-hidden rounded-[2rem] border bg-gradient-to-br from-background via-background to-muted/40 p-6 shadow-sm">
          <div className="pointer-events-none absolute -top-24 end-12 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 start-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <Badge
                variant="outline"
                className="w-fit rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary"
              >
                <CreditCard className="me-2 h-3.5 w-3.5" />
                {t.badge}
              </Badge>

              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                  {t.title}
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
                  {t.subtitle}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="/system/payments">
                  {isAr ? (
                    <ArrowLeft className="me-2 h-4 w-4" />
                  ) : (
                    <ArrowLeft className="me-2 h-4 w-4 rotate-180" />
                  )}
                  {t.back}
                </Link>
              </Button>

              <Button asChild className="rounded-2xl">
                <Link href="/system/payments/create">
                  <Plus className="me-2 h-4 w-4" />
                  {t.create}
                </Link>
              </Button>

              <Button asChild variant="secondary" className="rounded-2xl">
                <Link href="/system/payments/reports">
                  <BarChart3 className="me-2 h-4 w-4" />
                  {t.reports}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* =====================================================
            STATS
        ===================================================== */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card key={card.title} className="rounded-[1.5rem]">
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <div className="flex items-center gap-2">
                      {card.money ? (
                        <Image src={SAR_ICON_PATH} alt="SAR" width={18} height={18} />
                      ) : null}
                      <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{card.description}</p>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        {/* =====================================================
            FILTERS
        ===================================================== */}
        <Card className="rounded-[1.5rem]">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FilterIcon className="h-5 w-5 text-primary" />
                  {t.filters}
                </CardTitle>
                <CardDescription>
                  {formatNumber(filteredPayments.length)} {t.payments}
                  {selectedIds.length > 0
                    ? ` • ${formatNumber(selectedIds.length)} ${t.selected}`
                    : ""}
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => loadPayments("refresh")}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="me-2 h-4 w-4" />
                  )}
                  {t.refresh}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" className="rounded-2xl">
                      <ColumnsIcon className="me-2 h-4 w-4" />
                      {t.columns}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isAr ? "start" : "end"} className="w-56">
                    {columns.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.key}
                        checked={column.visible}
                        disabled={column.key === "actions"}
                        onCheckedChange={() => toggleColumn(column.key)}
                      >
                        {isAr ? column.labelAr : column.labelEn}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={exportExcel}
                >
                  <Download className="me-2 h-4 w-4" />
                  {t.exportExcel}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={printTable}
                >
                  <Printer className="me-2 h-4 w-4" />
                  {t.print}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="rounded-2xl ps-9"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as PaymentStatus)}
                className="h-10 rounded-2xl border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="ALL">{t.allStatuses}</option>
                {Object.keys(STATUS_META).map((status) => (
                  <option key={status} value={status}>
                    {getStatusLabel(status, locale)}
                  </option>
                ))}
              </select>

              <select
                value={methodFilter}
                onChange={(event) => setMethodFilter(event.target.value as PaymentMethod)}
                className="h-10 rounded-2xl border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="ALL">{t.allMethods}</option>
                {Object.keys(METHOD_META).map((method) => (
                  <option key={method} value={method}>
                    {getMethodLabel(method, locale)}
                  </option>
                ))}
              </select>

              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="rounded-2xl"
                aria-label={t.from}
              />

              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="rounded-2xl"
                aria-label={t.to}
              />

              <Button
                type="button"
                variant="ghost"
                className="rounded-2xl"
                onClick={clearFilters}
              >
                <XCircle className="me-2 h-4 w-4" />
                {t.clear}
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* =====================================================
            TABLE
        ===================================================== */}
        <Card className="rounded-[1.5rem]">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex min-h-96 flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">{t.loading}</p>
              </div>
            ) : sortedPayments.length === 0 ? (
              <div className="flex min-h-96 flex-col items-center justify-center gap-3 p-8 text-center">
                <CreditCard className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t.empty}</p>
              </div>
            ) : (
              <>
                <div id="payments-table-section" className="overflow-hidden rounded-[1.5rem]">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                        <tr>
                          {hasColumn("select") ? (
                            <th className="w-12 px-4 py-3 text-start font-medium">
                              <Checkbox
                                checked={pageSelected}
                                onCheckedChange={togglePageSelection}
                                aria-label="Select page"
                              />
                            </th>
                          ) : null}

                          {hasColumn("reference") ? (
                            <SortableTh
                              label={t.payment}
                              sortKey="reference"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onSort={toggleSort}
                            />
                          ) : null}

                          {hasColumn("customer") ? (
                            <SortableTh
                              label={t.customer}
                              sortKey="customer_id"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onSort={toggleSort}
                            />
                          ) : null}

                          {hasColumn("invoice") ? (
                            <SortableTh
                              label={t.invoice}
                              sortKey="invoice_id"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onSort={toggleSort}
                            />
                          ) : null}

                          {hasColumn("method") ? (
                            <SortableTh
                              label={t.method}
                              sortKey="payment_method"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onSort={toggleSort}
                            />
                          ) : null}

                          {hasColumn("status") ? (
                            <SortableTh
                              label={t.status}
                              sortKey="status"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onSort={toggleSort}
                            />
                          ) : null}

                          {hasColumn("paymentDate") ? (
                            <SortableTh
                              label={t.paymentDate}
                              sortKey="payment_date"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onSort={toggleSort}
                            />
                          ) : null}

                          {hasColumn("amount") ? (
                            <SortableTh
                              label={t.amount}
                              sortKey="amount"
                              activeKey={sortKey}
                              direction={sortDirection}
                              onSort={toggleSort}
                            />
                          ) : null}

                          {hasColumn("actions") ? (
                            <th className="px-4 py-3 text-end font-medium">{t.actions}</th>
                          ) : null}
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {paginatedPayments.map((payment) => {
                          const isSelected = selectedIds.includes(payment.id);
                          const status = String(payment.status || "PENDING").toUpperCase();
                          const canConfirm = ["PENDING", "PROCESSING"].includes(status);
                          const isConfirming = confirmingId === payment.id;

                          return (
                            <tr
                              key={payment.id}
                              className={`transition hover:bg-muted/30 ${
                                isSelected ? "bg-primary/5" : "bg-card"
                              }`}
                            >
                              {hasColumn("select") ? (
                                <td className="px-4 py-3">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => togglePaymentSelection(payment.id)}
                                    aria-label={`Select payment ${payment.id}`}
                                  />
                                </td>
                              ) : null}

                              {hasColumn("reference") ? (
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                      <CreditCard className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <p className="font-semibold">
                                        {payment.reference || `PAY-${payment.id}`}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        ID: {payment.id}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                              ) : null}

                              {hasColumn("customer") ? (
                                <td className="px-4 py-3">
                                  {payment.customer_id ? (
                                    <Badge variant="secondary" className="rounded-full">
                                      #{payment.customer_id}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">{t.notAvailable}</span>
                                  )}
                                </td>
                              ) : null}

                              {hasColumn("invoice") ? (
                                <td className="px-4 py-3">
                                  {payment.invoice_id ? (
                                    <Badge variant="outline" className="rounded-full">
                                      #{payment.invoice_id}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">{t.notAvailable}</span>
                                  )}
                                </td>
                              ) : null}

                              {hasColumn("method") ? (
                                <td className="px-4 py-3">
                                  <Badge variant="secondary" className="rounded-full">
                                    {getMethodLabel(payment.payment_method, locale)}
                                  </Badge>
                                </td>
                              ) : null}

                              {hasColumn("status") ? (
                                <td className="px-4 py-3">
                                  <Badge
                                    variant="outline"
                                    className={`rounded-full ${getStatusClassName(status)}`}
                                  >
                                    {getStatusLabel(status, locale)}
                                  </Badge>
                                </td>
                              ) : null}

                              {hasColumn("paymentDate") ? (
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <CalendarDays className="h-4 w-4" />
                                    {formatDate(payment.payment_date, locale)}
                                  </div>
                                </td>
                              ) : null}

                              {hasColumn("amount") ? (
                                <td className="px-4 py-3">
                                  <MoneyValue value={toNumber(payment.amount)} strong />
                                </td>
                              ) : null}

                              {hasColumn("actions") ? (
                                <td className="px-4 py-3">
                                  <div className="flex justify-end gap-2">
                                    {canConfirm ? (
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="rounded-xl"
                                        disabled={isConfirming}
                                        onClick={() => handleConfirmPayment(payment.id)}
                                      >
                                        {isConfirming ? (
                                          <Loader2 className="me-2 h-4 w-4 animate-spin" />
                                        ) : (
                                          <BadgeCheck className="me-2 h-4 w-4" />
                                        )}
                                        {isConfirming ? t.confirming : t.confirm}
                                      </Button>
                                    ) : null}

                                    <Button
                                      asChild
                                      variant="ghost"
                                      size="sm"
                                      className="rounded-xl"
                                    >
                                      <Link href={`/system/payments/${payment.id}`}>
                                        <Eye className="me-2 h-4 w-4" />
                                        {t.details}
                                      </Link>
                                    </Button>
                                  </div>
                                </td>
                              ) : null}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* =====================================================
                    PAGINATION
                ===================================================== */}
                <div className="flex flex-col gap-3 border-t p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>
                      {t.page} {formatNumber(currentPage)} {t.of}{" "}
                      {formatNumber(totalPages)}
                    </span>
                    <span>•</span>
                    <span>
                      {formatNumber(sortedPayments.length)} {t.payments}
                    </span>
                    {selectedIds.length > 0 ? (
                      <>
                        <span>•</span>
                        <span>
                          {formatNumber(selectedIds.length)} {t.selected}
                        </span>
                      </>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={pageSize}
                      onChange={(event) => setPageSize(Number(event.target.value))}
                      className="h-9 rounded-xl border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {t.rowsPerPage}: {size}
                        </option>
                      ))}
                    </select>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage <= 1}
                    >
                      {isAr ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronLeft className="h-4 w-4" />
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() =>
                        setCurrentPage((page) => Math.min(totalPages, page + 1))
                      }
                      disabled={currentPage >= totalPages}
                    >
                      {isAr ? (
                        <ChevronLeft className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

/* =====================================================
   SMALL COMPONENTS
===================================================== */

function SortableTh({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;

  return (
    <th className="px-4 py-3 text-start font-medium">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-2 rounded-lg text-start transition hover:text-foreground"
      >
        <span>{label}</span>
        <ArrowUpDown
          className={`h-3.5 w-3.5 ${
            active ? "text-primary" : "text-muted-foreground"
          } ${active && direction === "desc" ? "rotate-180" : ""}`}
        />
      </button>
    </th>
  );
}

function MoneyValue({
  value,
  strong = false,
}: {
  value: number;
  strong?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${strong ? "font-bold" : "font-medium"}`}>
      <Image src={SAR_ICON_PATH} alt="SAR" width={14} height={14} />
      <span>{formatMoney(value)}</span>
    </div>
  );
}