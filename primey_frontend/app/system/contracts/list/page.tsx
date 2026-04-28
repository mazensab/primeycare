"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarRange,
  ColumnsIcon,
  Download,
  Eye,
  FileSignature,
  FileText,
  FilterIcon,
  Loader2,
  MoreHorizontal,
  PlusCircle,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
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
   📂 app/system/contracts/list/page.tsx
   🧾 Primey Care | Contracts List
   ------------------------------------------------------------
   ✅ قائمة العقود بنفس نمط المراكز / العملاء / المندوبين / المنتجات
   ✅ ربط حقيقي مع /api/contracts/
   ✅ بحث + فلاتر + أعمدة + تحديد + فرز + صفحات
   ✅ تصدير Excel منظم .xlsx فقط
   ✅ طباعة Web PDF للقائمة فقط
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ الأرقام دائمًا إنجليزية
   ✅ استخدام UI الداخلي فقط
   ✅ لا يوجد hardcoded localhost
============================================================ */

type AppLocale = "ar" | "en";

type ContractStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "DRAFT"
  | "PENDING"
  | "EXPIRED"
  | "TERMINATED"
  | "CANCELLED"
  | "SUSPENDED"
  | "UNKNOWN";

type ContractType =
  | "GENERAL"
  | "MEDICAL"
  | "SERVICE"
  | "PARTNERSHIP"
  | "DISCOUNT"
  | "SUPPLY"
  | "OTHER"
  | "UNKNOWN";

type StatusFilter = "ALL" | ContractStatus;
type TypeFilter = "ALL" | ContractType;

type SortKey =
  | "contractNumber"
  | "title"
  | "providerName"
  | "contractType"
  | "status"
  | "startDate"
  | "endDate"
  | "contractValue"
  | "productsCount";

type SortDirection = "asc" | "desc";

type Contract = {
  id: number | string;
  contractNumber: string;
  title: string;
  providerName: string;
  providerId: number | string | null;
  contractType: ContractType;
  status: ContractStatus;
  startDate: string;
  endDate: string;
  contractValue: number;
  commissionRate: number;
  currency: string;
  productsCount: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type ContractsApiResponse = {
  ok?: boolean;
  message?: string;
  results?: unknown[];
  data?: unknown[] | { results?: unknown[] };
  items?: unknown[];
  contracts?: unknown[];
  pagination?: {
    count?: number;
    total?: number;
    page?: number;
    page_size?: number;
    total_pages?: number;
  };
};

type VisibleColumns = {
  contractNumber: boolean;
  title: boolean;
  providerName: boolean;
  contractType: boolean;
  status: boolean;
  startDate: boolean;
  endDate: boolean;
  contractValue: boolean;
  productsCount: boolean;
  actions: boolean;
};

/* ============================================================
   🌐 Locale Helpers
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

/* ============================================================
   🔢 Formatters
============================================================ */

function formatEnglishNumber(value: number | string | null | undefined) {
  const numericValue = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

function formatEnglishMoney(value: number | string | null | undefined) {
  const numericValue = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

function formatPercent(value: number | string | null | undefined) {
  const numericValue = Number(value || 0);

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0)}%`;
}

function formatDate(value: string, locale: AppLocale) {
  if (!value) return locale === "ar" ? "غير محدد" : "Not set";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsedDate);
}

function toComparableDate(value: string) {
  if (!value) return 0;

  const parsedDate = new Date(value).getTime();
  return Number.isNaN(parsedDate) ? 0 : parsedDate;
}

/* ============================================================
   🔁 API Normalizers
============================================================ */

function normalizeApiList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const data = payload as ContractsApiResponse;

    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.contracts)) return data.contracts;

    if (Array.isArray(data.data)) return data.data;

    if (
      data.data &&
      typeof data.data === "object" &&
      Array.isArray((data.data as { results?: unknown[] }).results)
    ) {
      return (data.data as { results: unknown[] }).results;
    }
  }

  return [];
}

function normalizeStatus(value: unknown): ContractStatus {
  const status = String(value || "").toUpperCase();

  if (status === "ACTIVE") return "ACTIVE";
  if (status === "INACTIVE") return "INACTIVE";
  if (status === "DRAFT") return "DRAFT";
  if (status === "PENDING") return "PENDING";
  if (status === "EXPIRED") return "EXPIRED";
  if (status === "TERMINATED") return "TERMINATED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "SUSPENDED") return "SUSPENDED";

  if (value === true) return "ACTIVE";
  if (value === false) return "INACTIVE";

  return "UNKNOWN";
}

function normalizeContractType(value: unknown): ContractType {
  const contractType = String(value || "").toUpperCase();

  if (contractType === "GENERAL") return "GENERAL";
  if (contractType === "MEDICAL") return "MEDICAL";
  if (contractType === "SERVICE") return "SERVICE";
  if (contractType === "PARTNERSHIP") return "PARTNERSHIP";
  if (contractType === "DISCOUNT") return "DISCOUNT";
  if (contractType === "SUPPLY") return "SUPPLY";
  if (contractType === "OTHER") return "OTHER";

  return "UNKNOWN";
}

function readNestedName(value: unknown): string {
  if (!value || typeof value !== "object") return "";

  const obj = value as Record<string, unknown>;

  return String(
    obj.name ??
      obj.display_name ??
      obj.provider_name ??
      obj.center_name ??
      obj.title ??
      ""
  );
}

function normalizeContract(item: unknown): Contract {
  const obj = (item || {}) as Record<string, unknown>;
  const providerObj = obj.provider as Record<string, unknown> | undefined;

  const contractProducts = Array.isArray(obj.contract_products)
    ? obj.contract_products
    : Array.isArray(obj.products)
      ? obj.products
      : Array.isArray(obj.items)
        ? obj.items
        : [];

  return {
    id: (obj.id ?? "-") as number | string,
    contractNumber: String(
      obj.contract_number ??
        obj.contractNumber ??
        obj.number ??
        obj.code ??
        `CONT-${obj.id ?? "-"}`
    ),
    title: String(
      obj.title ??
        obj.name ??
        obj.contract_title ??
        obj.contract_name ??
        obj.contractTitle ??
        "-"
    ),
    providerName: String(
      obj.provider_name ??
        obj.center_name ??
        obj.providerName ??
        readNestedName(obj.provider) ??
        "-"
    ),
    providerId:
      (obj.provider_id as number | string | undefined) ??
      (providerObj?.id as number | string | undefined) ??
      null,
    contractType: normalizeContractType(
      obj.contract_type ?? obj.contractType ?? obj.type
    ),
    status: normalizeStatus(obj.status ?? obj.is_active),
    startDate: String(obj.start_date ?? obj.startDate ?? ""),
    endDate: String(obj.end_date ?? obj.endDate ?? ""),
    contractValue: Number(
      obj.contract_value ??
        obj.contractValue ??
        obj.total_value ??
        obj.value ??
        obj.amount ??
        0
    ),
    commissionRate: Number(
      obj.commission_rate ?? obj.commissionRate ?? obj.rate ?? 0
    ),
    currency: String(obj.currency ?? "SAR"),
    productsCount: Number(
      obj.products_count ??
        obj.contract_products_count ??
        obj.items_count ??
        contractProducts.length ??
        0
    ),
    notes: String(obj.notes ?? obj.description ?? ""),
    createdAt: String(obj.created_at ?? obj.createdAt ?? ""),
    updatedAt: String(obj.updated_at ?? obj.updatedAt ?? ""),
    raw: obj,
  };
}

/* ============================================================
   📚 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "قائمة العقود" : "Contracts List",
    pageSubtitle: isArabic
      ? "إدارة جميع عقود مقدمي الخدمة مع البحث والفلاتر والتصدير والطباعة."
      : "Manage all provider contracts with search, filters, export, and print.",

    back: isArabic ? "رجوع" : "Back",
    createContract: isArabic ? "إنشاء عقد" : "Create Contract",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة Web PDF" : "Print Web PDF",
    columns: isArabic ? "الأعمدة" : "Columns",
    filters: isArabic ? "الفلاتر" : "Filters",

    totalContracts: isArabic ? "إجمالي العقود" : "Total Contracts",
    activeContracts: isArabic ? "العقود النشطة" : "Active Contracts",
    expiringContracts: isArabic ? "قريبة الانتهاء" : "Expiring Soon",
    totalValue: isArabic ? "إجمالي القيمة" : "Total Value",

    searchPlaceholder: isArabic
      ? "ابحث برقم العقد أو الاسم أو مقدم الخدمة..."
      : "Search by contract number, title, or provider...",

    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    allTypes: isArabic ? "كل الأنواع" : "All Types",
    fromDate: isArabic ? "من تاريخ" : "From Date",
    toDate: isArabic ? "إلى تاريخ" : "To Date",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    selected: isArabic ? "محدد" : "Selected",
    results: isArabic ? "نتيجة" : "Results",
    page: isArabic ? "صفحة" : "Page",
    of: isArabic ? "من" : "of",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",

    contractNumber: isArabic ? "رقم العقد" : "Contract No.",
    title: isArabic ? "العقد" : "Contract",
    providerName: isArabic ? "مقدم الخدمة" : "Provider",
    contractType: isArabic ? "النوع" : "Type",
    status: isArabic ? "الحالة" : "Status",
    startDate: isArabic ? "تاريخ البداية" : "Start Date",
    endDate: isArabic ? "تاريخ النهاية" : "End Date",
    contractValue: isArabic ? "القيمة" : "Value",
    productsCount: isArabic ? "الخدمات/المنتجات" : "Products/Services",
    commissionRate: isArabic ? "العمولة" : "Commission",
    actions: isArabic ? "الإجراءات" : "Actions",
    view: isArabic ? "عرض التفاصيل" : "View Details",

    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    draft: isArabic ? "مسودة" : "Draft",
    pending: isArabic ? "معلق" : "Pending",
    expired: isArabic ? "منتهي" : "Expired",
    terminated: isArabic ? "منهى" : "Terminated",
    cancelled: isArabic ? "ملغي" : "Cancelled",
    suspended: isArabic ? "موقوف" : "Suspended",
    unknown: isArabic ? "غير معروف" : "Unknown",

    general: isArabic ? "عام" : "General",
    medical: isArabic ? "طبي" : "Medical",
    service: isArabic ? "خدمة" : "Service",
    partnership: isArabic ? "شراكة" : "Partnership",
    discount: isArabic ? "خصومات" : "Discount",
    supply: isArabic ? "توريد" : "Supply",
    other: isArabic ? "أخرى" : "Other",

    loading: isArabic ? "جاري تحميل العقود..." : "Loading contracts...",
    noContracts: isArabic
      ? "لا توجد عقود مطابقة للفلاتر الحالية."
      : "No contracts match the current filters.",
    loadError: isArabic
      ? "تعذر تحميل بيانات العقود."
      : "Failed to load contracts data.",
    updatedNow: isArabic ? "تم تحديث بيانات العقود" : "Contracts data refreshed",
    excelDone: isArabic
      ? "تم تصدير ملف Excel بنجاح"
      : "Excel file exported successfully",
    excelError: isArabic
      ? "تعذر تصدير ملف Excel"
      : "Failed to export Excel file",
    printError: isArabic
      ? "تعذر تجهيز الطباعة"
      : "Failed to prepare print view",
  };
}

function statusLabel(status: ContractStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<ContractStatus, string> = {
    ACTIVE: t.active,
    INACTIVE: t.inactive,
    DRAFT: t.draft,
    PENDING: t.pending,
    EXPIRED: t.expired,
    TERMINATED: t.terminated,
    CANCELLED: t.cancelled,
    SUSPENDED: t.suspended,
    UNKNOWN: t.unknown,
  };

  return labels[status] || t.unknown;
}

function typeLabel(type: ContractType, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<ContractType, string> = {
    GENERAL: t.general,
    MEDICAL: t.medical,
    SERVICE: t.service,
    PARTNERSHIP: t.partnership,
    DISCOUNT: t.discount,
    SUPPLY: t.supply,
    OTHER: t.other,
    UNKNOWN: t.unknown,
  };

  return labels[type] || t.unknown;
}

function statusBadgeClass(status: ContractStatus) {
  if (status === "ACTIVE") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "DRAFT" || status === "PENDING") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  if (status === "EXPIRED" || status === "TERMINATED" || status === "CANCELLED") {
    return "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }

  if (status === "SUSPENDED" || status === "INACTIVE") {
    return "border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  }

  return "border-muted bg-muted/40 text-muted-foreground";
}

/* ============================================================
   🧾 Small Components
============================================================ */

function SarAmount({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
      <Image
        src="/currency/sar.svg"
        alt="SAR"
        width={14}
        height={14}
        className="opacity-80"
      />
      {formatEnglishMoney(amount)}
    </span>
  );
}

/* ============================================================
   🧾 Page
============================================================ */

export default function SystemContractsListPage() {
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("createdAt" as SortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    contractNumber: true,
    title: true,
    providerName: true,
    contractType: true,
    status: true,
    startDate: true,
    endDate: true,
    contractValue: true,
    productsCount: true,
    actions: true,
  });

  const isArabic = locale === "ar";
  const t = dictionary(locale);

  useEffect(() => {
    const currentLocale = readLocale();
    setLocale(currentLocale);
    applyDocumentLocale(currentLocale);

    const syncLocale = () => {
      const nextLocale = readLocale();
      setLocale(nextLocale);
      applyDocumentLocale(nextLocale);
    };

    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  async function loadContracts(options?: { silent?: boolean }) {
    try {
      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const response = await fetch("/api/contracts/?page_size=500", {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load contracts.");
      }

      const items = normalizeApiList(payload).map(normalizeContract);

      setContracts(items);
      setSelectedIds(new Set());

      if (options?.silent) {
        toast.success(t.updatedNow);
      }
    } catch (error) {
      console.error("Load contracts error:", error);
      toast.error(t.loadError);
      setContracts([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadContracts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredContracts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return contracts.filter((contract) => {
      const matchesSearch =
        !query ||
        contract.contractNumber.toLowerCase().includes(query) ||
        contract.title.toLowerCase().includes(query) ||
        contract.providerName.toLowerCase().includes(query) ||
        contract.notes.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" || contract.status === statusFilter;

      const matchesType =
        typeFilter === "ALL" || contract.contractType === typeFilter;

      const start = toComparableDate(contract.startDate);
      const end = toComparableDate(contract.endDate);
      const from = dateFrom ? toComparableDate(dateFrom) : 0;
      const to = dateTo ? toComparableDate(dateTo) : 0;

      const matchesDateFrom = !dateFrom || start >= from || end >= from;
      const matchesDateTo = !dateTo || start <= to || end <= to;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [contracts, searchTerm, statusFilter, typeFilter, dateFrom, dateTo]);

  const sortedContracts = useMemo(() => {
    const list = [...filteredContracts];

    list.sort((a, b) => {
      let firstValue: string | number = "";
      let secondValue: string | number = "";

      if (sortKey === "contractValue" || sortKey === "productsCount") {
        firstValue = Number(a[sortKey] || 0);
        secondValue = Number(b[sortKey] || 0);
      } else if (sortKey === "startDate" || sortKey === "endDate") {
        firstValue = toComparableDate(a[sortKey]);
        secondValue = toComparableDate(b[sortKey]);
      } else {
        firstValue = String(a[sortKey] || "").toLowerCase();
        secondValue = String(b[sortKey] || "").toLowerCase();
      }

      if (firstValue < secondValue) return sortDirection === "asc" ? -1 : 1;
      if (firstValue > secondValue) return sortDirection === "asc" ? 1 : -1;

      return 0;
    });

    return list;
  }, [filteredContracts, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedContracts.length / pageSize));

  const paginatedContracts = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * pageSize;

    return sortedContracts.slice(startIndex, startIndex + pageSize);
  }, [sortedContracts, page, totalPages, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, typeFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const total = contracts.length;
    const active = contracts.filter((item) => item.status === "ACTIVE").length;

    const expiring = contracts.filter((item) => {
      if (!item.endDate) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const endDate = new Date(item.endDate);
      endDate.setHours(0, 0, 0, 0);

      if (Number.isNaN(endDate.getTime())) return false;

      const days = Math.ceil(
        (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      return days >= 0 && days <= 30;
    }).length;

    const totalValue = contracts.reduce(
      (sum, item) => sum + Number(item.contractValue || 0),
      0
    );

    return {
      total,
      active,
      expiring,
      totalValue,
    };
  }, [contracts]);

  const pageIds = useMemo(
    () => paginatedContracts.map((item) => String(item.id)),
    [paginatedContracts]
  );

  const isCurrentPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function toggleSelectAllCurrentPage() {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (isCurrentPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }

      return next;
    });
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setSelectedIds(new Set());
  }

  function buildExcelRows(source: Contract[]) {
    return source.map((contract) => ({
      [t.contractNumber]: contract.contractNumber,
      [t.title]: contract.title,
      [t.providerName]: contract.providerName,
      [t.contractType]: typeLabel(contract.contractType, locale),
      [t.status]: statusLabel(contract.status, locale),
      [t.startDate]: formatDate(contract.startDate, locale),
      [t.endDate]: formatDate(contract.endDate, locale),
      [t.contractValue]: formatEnglishMoney(contract.contractValue),
      [t.productsCount]: formatEnglishNumber(contract.productsCount),
      [t.commissionRate]: formatPercent(contract.commissionRate),
    }));
  }

  function handleExportExcel() {
    try {
      const exportRows = buildExcelRows(sortedContracts);

      const summaryRows = [
        [t.pageTitle],
        [t.totalContracts, formatEnglishNumber(stats.total)],
        [t.activeContracts, formatEnglishNumber(stats.active)],
        [t.expiringContracts, formatEnglishNumber(stats.expiring)],
        [t.totalValue, formatEnglishMoney(stats.totalValue), "SAR"],
        [],
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.sheet_add_json(worksheet, exportRows, {
        origin: "A7",
        skipHeader: false,
      });

      worksheet["!cols"] = [
        { wch: 18 },
        { wch: 28 },
        { wch: 26 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
      ];

      worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        isArabic ? "قائمة العقود" : "Contracts List"
      );

      XLSX.writeFile(workbook, "primey-care-contracts-list.xlsx");
      toast.success(t.excelDone);
    } catch (error) {
      console.error("Export contracts excel error:", error);
      toast.error(t.excelError);
    }
  }

  function handlePrint() {
    try {
      const printContent = printAreaRef.current?.innerHTML;

      if (!printContent) {
        toast.error(t.printError);
        return;
      }

      const printWindow = window.open("", "_blank", "width=1200,height=800");

      if (!printWindow) {
        toast.error(t.printError);
        return;
      }

      printWindow.document.write(`
        <!doctype html>
        <html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">
          <head>
            <meta charset="utf-8" />
            <title>${t.pageTitle}</title>
            <style>
              * {
                box-sizing: border-box;
              }

              body {
                font-family: Arial, sans-serif;
                padding: 24px;
                color: #111827;
                background: #ffffff;
              }

              .print-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 24px;
                padding-bottom: 16px;
                border-bottom: 1px solid #e5e7eb;
              }

              .print-title {
                margin: 0;
                font-size: 22px;
                font-weight: 800;
              }

              .print-subtitle {
                margin: 6px 0 0;
                color: #6b7280;
                font-size: 13px;
              }

              .print-summary {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
                margin-bottom: 20px;
              }

              .print-card {
                border: 1px solid #e5e7eb;
                border-radius: 14px;
                padding: 12px;
              }

              .print-card-label {
                color: #6b7280;
                font-size: 12px;
                margin-bottom: 6px;
              }

              .print-card-value {
                font-size: 18px;
                font-weight: 800;
              }

              table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
              }

              th, td {
                border: 1px solid #e5e7eb;
                padding: 10px;
                text-align: ${isArabic ? "right" : "left"};
                vertical-align: top;
              }

              th {
                background: #f9fafb;
                font-weight: 800;
              }

              .badge {
                display: inline-block;
                border: 1px solid #e5e7eb;
                border-radius: 999px;
                padding: 3px 8px;
                font-size: 11px;
                font-weight: 700;
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
                <h1 class="print-title">${t.pageTitle}</h1>
                <p class="print-subtitle">${t.pageSubtitle}</p>
              </div>
              <div>${new Date().toLocaleDateString("en-GB")}</div>
            </div>

            <div class="print-summary">
              <div class="print-card">
                <div class="print-card-label">${t.totalContracts}</div>
                <div class="print-card-value">${formatEnglishNumber(stats.total)}</div>
              </div>
              <div class="print-card">
                <div class="print-card-label">${t.activeContracts}</div>
                <div class="print-card-value">${formatEnglishNumber(stats.active)}</div>
              </div>
              <div class="print-card">
                <div class="print-card-label">${t.expiringContracts}</div>
                <div class="print-card-value">${formatEnglishNumber(stats.expiring)}</div>
              </div>
              <div class="print-card">
                <div class="print-card-label">${t.totalValue}</div>
                <div class="print-card-value">${formatEnglishMoney(stats.totalValue)} SAR</div>
              </div>
            </div>

            ${printContent}
          </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (error) {
      console.error("Print contracts error:", error);
      toast.error(t.printError);
    }
  }

  const columnLabels: Record<keyof VisibleColumns, string> = {
    contractNumber: t.contractNumber,
    title: t.title,
    providerName: t.providerName,
    contractType: t.contractType,
    status: t.status,
    startDate: t.startDate,
    endDate: t.endDate,
    contractValue: t.contractValue,
    productsCount: t.productsCount,
    actions: t.actions,
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/80 p-6 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-sky-500/10" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/system/contracts">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full bg-white/70 dark:bg-white/5"
                  >
                    <ArrowLeft className="me-2 h-4 w-4" />
                    {t.back}
                  </Button>
                </Link>

                <Badge className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                  <FileSignature className="me-1 h-3.5 w-3.5" />
                  {isArabic ? "وحدة العقود" : "Contracts Module"}
                </Badge>

                <Badge
                  variant="outline"
                  className="rounded-full bg-white/60 dark:bg-white/5"
                >
                  <ShieldCheck className="me-1 h-3.5 w-3.5" />
                  {isArabic ? "بيانات حقيقية" : "Live Data"}
                </Badge>
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {t.pageTitle}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                  {t.pageSubtitle}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="rounded-2xl bg-white/70 dark:bg-white/5"
                onClick={() => loadContracts({ silent: true })}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="me-2 h-4 w-4" />
                )}
                {t.refresh}
              </Button>

              <Button
                variant="outline"
                className="rounded-2xl bg-white/70 dark:bg-white/5"
                onClick={handleExportExcel}
              >
                <Download className="me-2 h-4 w-4" />
                {t.exportExcel}
              </Button>

              <Button
                variant="outline"
                className="rounded-2xl bg-white/70 dark:bg-white/5"
                onClick={handlePrint}
              >
                <Printer className="me-2 h-4 w-4" />
                {t.print}
              </Button>

              <Link href="/system/contracts/create">
                <Button className="rounded-2xl shadow-lg">
                  <PlusCircle className="me-2 h-4 w-4" />
                  {t.createContract}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t.totalContracts}</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">
                    {formatEnglishNumber(stats.total)}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t.activeContracts}</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">
                    {formatEnglishNumber(stats.active)}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                  <BadgeCheck className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t.expiringContracts}</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">
                    {formatEnglishNumber(stats.expiring)}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
                  <CalendarRange className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t.totalValue}</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    <SarAmount amount={stats.totalValue} />
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FilterIcon className="h-5 w-5 text-primary" />
                  {t.filters}
                </CardTitle>
                <CardDescription>
                  {formatEnglishNumber(sortedContracts.length)} {t.results}
                  {selectedIds.size > 0
                    ? ` • ${formatEnglishNumber(selectedIds.size)} ${t.selected}`
                    : ""}
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="rounded-2xl">
                      <ColumnsIcon className="me-2 h-4 w-4" />
                      {t.columns}
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align={isArabic ? "start" : "end"}>
                    <DropdownMenuLabel>{t.columns}</DropdownMenuLabel>
                    <DropdownMenuSeparator />

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
                          {columnLabels[key]}
                        </DropdownMenuCheckboxItem>
                      )
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={clearFilters}
                >
                  {t.clearFilters}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr]">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="rounded-2xl bg-white/80 ps-9 dark:bg-white/5"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="h-10 rounded-2xl border border-input bg-white/80 px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring dark:bg-white/5"
              >
                <option value="ALL">{t.allStatuses}</option>
                <option value="ACTIVE">{t.active}</option>
                <option value="DRAFT">{t.draft}</option>
                <option value="PENDING">{t.pending}</option>
                <option value="EXPIRED">{t.expired}</option>
                <option value="INACTIVE">{t.inactive}</option>
                <option value="TERMINATED">{t.terminated}</option>
                <option value="CANCELLED">{t.cancelled}</option>
                <option value="SUSPENDED">{t.suspended}</option>
              </select>

              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
                className="h-10 rounded-2xl border border-input bg-white/80 px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring dark:bg-white/5"
              >
                <option value="ALL">{t.allTypes}</option>
                <option value="GENERAL">{t.general}</option>
                <option value="MEDICAL">{t.medical}</option>
                <option value="SERVICE">{t.service}</option>
                <option value="PARTNERSHIP">{t.partnership}</option>
                <option value="DISCOUNT">{t.discount}</option>
                <option value="SUPPLY">{t.supply}</option>
                <option value="OTHER">{t.other}</option>
              </select>

              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="rounded-2xl bg-white/80 dark:bg-white/5"
                aria-label={t.fromDate}
              />

              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="rounded-2xl bg-white/80 dark:bg-white/5"
                aria-label={t.toDate}
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>{t.pageTitle}</CardTitle>
                <CardDescription>
                  {formatEnglishNumber(sortedContracts.length)} {t.results}
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Link href="/system/contracts/reports">
                  <Button variant="outline" className="rounded-2xl">
                    {isArabic ? "تقارير العقود" : "Contracts Reports"}
                  </Button>
                </Link>

                <Link href="/system/contracts/create">
                  <Button className="rounded-2xl">
                    <PlusCircle className="me-2 h-4 w-4" />
                    {t.createContract}
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div
              ref={printAreaRef}
              className="overflow-hidden rounded-2xl border border-white/20 bg-white/70 dark:border-white/10 dark:bg-white/5"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isCurrentPageSelected}
                        onCheckedChange={toggleSelectAllCurrentPage}
                        aria-label="Select all contracts"
                      />
                    </TableHead>

                    {visibleColumns.contractNumber && (
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleSort("contractNumber")}
                        >
                          {t.contractNumber}
                          <ArrowDownUp className="h-3.5 w-3.5" />
                        </button>
                      </TableHead>
                    )}

                    {visibleColumns.title && (
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleSort("title")}
                        >
                          {t.title}
                          <ArrowDownUp className="h-3.5 w-3.5" />
                        </button>
                      </TableHead>
                    )}

                    {visibleColumns.providerName && (
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleSort("providerName")}
                        >
                          {t.providerName}
                          <ArrowDownUp className="h-3.5 w-3.5" />
                        </button>
                      </TableHead>
                    )}

                    {visibleColumns.contractType && (
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleSort("contractType")}
                        >
                          {t.contractType}
                          <ArrowDownUp className="h-3.5 w-3.5" />
                        </button>
                      </TableHead>
                    )}

                    {visibleColumns.status && (
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleSort("status")}
                        >
                          {t.status}
                          <ArrowDownUp className="h-3.5 w-3.5" />
                        </button>
                      </TableHead>
                    )}

                    {visibleColumns.startDate && (
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleSort("startDate")}
                        >
                          {t.startDate}
                          <ArrowDownUp className="h-3.5 w-3.5" />
                        </button>
                      </TableHead>
                    )}

                    {visibleColumns.endDate && (
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleSort("endDate")}
                        >
                          {t.endDate}
                          <ArrowDownUp className="h-3.5 w-3.5" />
                        </button>
                      </TableHead>
                    )}

                    {visibleColumns.contractValue && (
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleSort("contractValue")}
                        >
                          {t.contractValue}
                          <ArrowDownUp className="h-3.5 w-3.5" />
                        </button>
                      </TableHead>
                    )}

                    {visibleColumns.productsCount && (
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleSort("productsCount")}
                        >
                          {t.productsCount}
                          <ArrowDownUp className="h-3.5 w-3.5" />
                        </button>
                      </TableHead>
                    )}

                    {visibleColumns.actions && (
                      <TableHead className="text-center">{t.actions}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={11}>
                        <div className="flex min-h-52 items-center justify-center text-muted-foreground">
                          <Loader2 className="me-2 h-5 w-5 animate-spin" />
                          {t.loading}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedContracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11}>
                        <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                          <FileSignature className="h-10 w-10 opacity-60" />
                          <p>{t.noContracts}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedContracts.map((contract) => {
                      const id = String(contract.id);
                      const isSelected = selectedIds.has(id);

                      return (
                        <TableRow key={id} data-state={isSelected ? "selected" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectOne(id)}
                              aria-label={`Select contract ${contract.contractNumber}`}
                            />
                          </TableCell>

                          {visibleColumns.contractNumber && (
                            <TableCell>
                              <div className="font-semibold tabular-nums">
                                {contract.contractNumber}
                              </div>
                            </TableCell>
                          )}

                          {visibleColumns.title && (
                            <TableCell>
                              <div className="flex min-w-52 items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                  <FileSignature className="h-4 w-4" />
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate font-semibold">
                                    {contract.title}
                                  </p>
                                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                                    {contract.notes || contract.contractNumber}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                          )}

                          {visibleColumns.providerName && (
                            <TableCell>
                              <div className="flex min-w-44 items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="truncate">{contract.providerName}</span>
                              </div>
                            </TableCell>
                          )}

                          {visibleColumns.contractType && (
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="rounded-full bg-white/70 dark:bg-white/5"
                              >
                                {typeLabel(contract.contractType, locale)}
                              </Badge>
                            </TableCell>
                          )}

                          {visibleColumns.status && (
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`rounded-full ${statusBadgeClass(
                                  contract.status
                                )}`}
                              >
                                {statusLabel(contract.status, locale)}
                              </Badge>
                            </TableCell>
                          )}

                          {visibleColumns.startDate && (
                            <TableCell>
                              <div className="flex min-w-32 items-center gap-2 text-sm">
                                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                                {formatDate(contract.startDate, locale)}
                              </div>
                            </TableCell>
                          )}

                          {visibleColumns.endDate && (
                            <TableCell>
                              <div className="flex min-w-32 items-center gap-2 text-sm">
                                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                                {formatDate(contract.endDate, locale)}
                              </div>
                            </TableCell>
                          )}

                          {visibleColumns.contractValue && (
                            <TableCell>
                              <SarAmount amount={contract.contractValue} />
                            </TableCell>
                          )}

                          {visibleColumns.productsCount && (
                            <TableCell>
                              <span className="font-semibold tabular-nums">
                                {formatEnglishNumber(contract.productsCount)}
                              </span>
                            </TableCell>
                          )}

                          {visibleColumns.actions && (
                            <TableCell>
                              <div className="flex items-center justify-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9 rounded-xl"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>

                                  <DropdownMenuContent
                                    align={isArabic ? "start" : "end"}
                                  >
                                    <DropdownMenuLabel>{t.actions}</DropdownMenuLabel>
                                    <DropdownMenuSeparator />

                                    <Link href={`/system/contracts/${contract.id}`}>
                                      <DropdownMenuItem>
                                        <Eye className="me-2 h-4 w-4" />
                                        {t.view}
                                      </DropdownMenuItem>
                                    </Link>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {formatEnglishNumber(sortedContracts.length)} {t.results}
                {selectedIds.size > 0
                  ? ` • ${formatEnglishNumber(selectedIds.size)} ${t.selected}`
                  : ""}
              </div>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <p className="text-sm text-muted-foreground">
                  {t.page} {formatEnglishNumber(Math.min(page, totalPages))} {t.of}{" "}
                  {formatEnglishNumber(totalPages)}
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    {t.previous}
                  </Button>

                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    disabled={page >= totalPages}
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
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
    </div>
  );
}