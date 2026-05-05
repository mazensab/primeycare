"use client";

/* ============================================================
   📂 app/system/customers/page.tsx
   🧠 Primey Care | System Customers Dashboard
   ------------------------------------------------------------
   ✅ المسار: /system/customers
   ✅ الإصدار: v1.1.0 - UX Refinement

   ✅ العمل:
      لوحة مختصرة لإدارة العملاء داخل مساحة النظام.

   ✅ API:
      GET customers list through lib/api.ts

   ✅ ملاحظات UX المعتمدة:
      - لا يتم إظهار المسارات التقنية أو أسماء API داخل الواجهة.
      - لا يتم عرض روابط تقارير داخل الوحدة لأن التقارير مركزية.
      - لا يتم عرض أزرار وهمية أو غير فعالة.
      - Error State مستقل عن Empty State.
      - Skeleton Loading بدل مؤشرات تحميل نصية.
      - Empty State ذكي عند البحث أو الفلاتر.
      - روابط التفاصيل آمنة وتتحقق من id.
      - الصفحة ممتدة على عرض المساحة.
      - دعم عربي / إنجليزي عبر primey-locale.
      - استخدام sonner للتنبيهات.
      - الأرقام تبقى بالإنجليزية.
============================================================ */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Eye,
  FileText,
  ListChecks,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
  Users,
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

type Customer = {
  id: number | string;
  name: string;
  code: string;
  customerType: CustomerType;
  status: CustomerStatus;
  source: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  whatsapp: string;
  primaryContact: string;
  city: string;
  district: string;
  address: string;
  nationality: string;
  nationalId: string;
  tags: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type CustomersApiResponse = {
  ok?: boolean;
  message?: string;
  results?: unknown[];
  data?:
    | unknown[]
    | {
        results?: unknown[];
        customers?: unknown[];
        items?: unknown[];
      };
  items?: unknown[];
  customers?: unknown[];
  count?: number;
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

/* ============================================================
   API Normalizers
============================================================ */

function normalizeApiList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  const data = payload as CustomersApiResponse;

  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.customers)) return data.customers;

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
  const customerType = String(value || "").toUpperCase();

  if (customerType === "INDIVIDUAL") return "INDIVIDUAL";
  if (customerType === "CORPORATE") return "CORPORATE";

  return "UNKNOWN";
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

  const whatsapp = pickString(obj, [
    "whatsapp_number",
    "whatsappNumber",
    "whatsapp",
  ]);
  const phone = pickString(obj, ["phone_number", "phoneNumber", "phone"]);
  const email = pickString(obj, ["email"]);

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
    firstName,
    lastName,
    companyName,
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
    address: pickString(
      obj,
      ["street_address", "streetAddress", "national_address_text"],
      "",
    ),
    nationality: pickString(obj, ["nationality"], ""),
    nationalId: pickString(obj, ["national_id", "nationalId"], ""),
    tags: pickString(obj, ["tags"], ""),
    notes: pickString(obj, ["notes"], ""),
    createdAt: pickString(obj, ["created_at", "createdAt"], ""),
    updatedAt: pickString(obj, ["updated_at", "updatedAt"], ""),
    raw: obj,
  };
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "إدارة العملاء" : "Customers Management",
    pageSubtitle: isArabic
      ? "متابعة العملاء، حالة الحساب، نوع العميل، المدن، وبيانات التواصل."
      : "Monitor customers, account status, customer type, cities, and contact details.",

    addCustomer: isArabic ? "إنشاء عميل" : "Create Customer",
    customersList: isArabic ? "قائمة العملاء" : "Customers List",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",

    featuredCustomers: isArabic ? "العملاء النشطون" : "Active Customers",
    featuredSubtitle: isArabic
      ? "عرض مختصر لأهم العملاء حسب النشاط أو أحدث السجلات."
      : "A compact view of customers based on activity or latest records.",

    trackStatus: isArabic ? "حالة العملاء" : "Track Customer Status",
    trackSubtitle: isArabic
      ? "تحليل سريع لحالة العملاء ونوع الحساب."
      : "Quick analysis of customer status and account type.",

    filterPlaceholder: isArabic ? "ابحث في العملاء..." : "Filter customers...",

    all: isArabic ? "الكل" : "All",
    total: isArabic ? "الإجمالي" : "Total",
    active: isArabic ? "نشط" : "Active",
    lead: isArabic ? "محتمل" : "Lead",
    blocked: isArabic ? "محظور" : "Blocked",
    inactive: isArabic ? "غير نشط" : "Inactive",
    unknown: isArabic ? "غير محدد" : "Unknown",

    loaded: isArabic ? "محمّلة" : "Loaded",
    operational: isArabic ? "تشغيلي" : "Operational",
    potential: isArabic ? "فرص محتملة" : "Potential",
    stopped: isArabic ? "متوقف" : "Stopped",

    showing: isArabic ? "عرض" : "Showing",
    from: isArabic ? "من" : "of",
    latestRecords: isArabic ? "آخر السجلات" : "Latest records",
    viewFullList: isArabic ? "عرض القائمة الكاملة" : "View Full List",

    table: {
      id: isArabic ? "الرقم" : "ID",
      name: isArabic ? "اسم العميل" : "Customer Name",
      type: isArabic ? "النوع" : "Type",
      city: isArabic ? "المدينة" : "City",
      contact: isArabic ? "التواصل" : "Contact",
      status: isArabic ? "الحالة" : "Status",
      action: isArabic ? "الإجراء" : "Action",
    },

    emptyTitle: isArabic ? "لا يوجد عملاء بعد" : "No customers yet",
    emptyText: isArabic
      ? "عند إضافة عملاء جدد ستظهر بياناتهم هنا مباشرة."
      : "New customers will appear here once they are added.",
    noResultsTitle: isArabic
      ? "لا توجد نتائج مطابقة"
      : "No matching results",
    noResultsText: isArabic
      ? "جرّب تغيير كلمات البحث أو فلتر الحالة لعرض نتائج أكثر."
      : "Try changing the search keywords or status filter to show more results.",

    apiError: isArabic
      ? "تعذر تحميل بيانات العملاء."
      : "Unable to load customers data.",
    apiErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث بيانات العملاء بنجاح"
      : "Customers data refreshed successfully",

    quickAccessTitle: isArabic
      ? "إجراءات وحدة العملاء"
      : "Customers Module Actions",
    quickAccessSubtitle: isArabic
      ? "اختصارات منظمة للوصول إلى أهم صفحات وحدة العملاء."
      : "Organized shortcuts to the key customer module pages.",

    open: isArabic ? "فتح" : "Open",
    manage: isArabic ? "إدارة" : "Manage",

    actionListTitle: isArabic ? "قائمة العملاء" : "Customers List",
    actionListDesc: isArabic
      ? "استعراض جميع العملاء، البحث، التصفية، وإدارة السجلات."
      : "Browse all customers, search, filter, and manage records.",

    actionCreateTitle: isArabic ? "إنشاء عميل" : "Create Customer",
    actionCreateDesc: isArabic
      ? "إضافة عميل فرد أو شركة وربطه لاحقًا بالطلبات والفواتير."
      : "Add a new individual or corporate customer and connect it later with orders and invoices.",

    typeLabels: {
      INDIVIDUAL: isArabic ? "فرد" : "Individual",
      CORPORATE: isArabic ? "شركة" : "Corporate",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<CustomerType, string>,
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

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function isValidCustomerId(id: Customer["id"]) {
  const value = String(id || "").trim();

  return value.length > 0 && value !== "-" && value !== "undefined";
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function FeaturedCustomersSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <SkeletonLine className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="space-y-2">
              <SkeletonLine className="h-3 w-28" />
              <SkeletonLine className="h-3 w-20" />
            </div>
          </div>

          <div className="space-y-2">
            <SkeletonLine className="h-3 w-16" />
            <SkeletonLine className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusCardsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-xl border bg-background/70 p-3">
          <div className="flex items-center gap-2">
            <SkeletonLine className="h-4 w-4" />
            <SkeletonLine className="h-7 w-14" />
          </div>
          <div className="space-y-2">
            <SkeletonLine className="h-3 w-20" />
            <SkeletonLine className="h-2 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableRowsSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <SkeletonLine className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <SkeletonLine className="h-8 w-8 rounded-lg" />
              <div className="space-y-2">
                <SkeletonLine className="h-3 w-32" />
                <SkeletonLine className="h-3 w-24" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <SkeletonLine className="h-6 w-20" />
          </TableCell>
          <TableCell>
            <SkeletonLine className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <SkeletonLine className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <SkeletonLine className="h-6 w-16" />
          </TableCell>
          <TableCell>
            <SkeletonLine className="h-8 w-10 rounded-lg" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

/* ============================================================
   Page
============================================================ */

export default function SystemCustomersPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const filteredCustomers = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : customer.status === statusFilter;

      const matchesQuery = !cleanQuery
        ? true
        : [
            customer.name,
            customer.code,
            customer.city,
            customer.district,
            customer.phone,
            customer.whatsapp,
            customer.email,
            customer.customerType,
            customer.status,
            customer.source,
            customer.primaryContact,
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesStatus && matchesQuery;
    });
  }, [customers, query, statusFilter]);

  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((item) => item.status === "ACTIVE").length;
    const lead = customers.filter((item) => item.status === "LEAD").length;
    const blocked = customers.filter((item) => item.status === "BLOCKED").length;
    const inactive = customers.filter(
      (item) => item.status === "INACTIVE",
    ).length;

    return {
      total,
      active,
      lead,
      blocked,
      inactive,
      stopped: blocked + inactive,
    };
  }, [customers]);

  const featuredCustomers = useMemo(() => {
    const activeCustomers = customers.filter((item) => item.status === "ACTIVE");

    if (activeCustomers.length > 0) {
      return activeCustomers.slice(0, 6);
    }

    return customers.slice(0, 6);
  }, [customers]);

  const tableRows = useMemo(
    () => filteredCustomers.slice(0, 8),
    [filteredCustomers],
  );

  const statusCards = useMemo(
    () => [
      {
        title: t.total,
        value: stats.total,
        helper: t.loaded,
        helperValue: stats.total > 0 ? "100%" : "0%",
        icon: Users,
        percent: stats.total > 0 ? 100 : 0,
        filter: "ALL" as StatusFilter,
      },
      {
        title: t.active,
        value: stats.active,
        helper: t.operational,
        helperValue: `${percent(stats.active, stats.total)}%`,
        icon: BadgeCheck,
        percent: percent(stats.active, stats.total),
        filter: "ACTIVE" as StatusFilter,
      },
      {
        title: t.lead,
        value: stats.lead,
        helper: t.potential,
        helperValue: `${percent(stats.lead, stats.total)}%`,
        icon: FileText,
        percent: percent(stats.lead, stats.total),
        filter: "LEAD" as StatusFilter,
      },
      {
        title: t.blocked,
        value: stats.stopped,
        helper: t.stopped,
        helperValue: `${percent(stats.stopped, stats.total)}%`,
        icon: ShieldCheck,
        percent: percent(stats.stopped, stats.total),
        filter: "BLOCKED" as StatusFilter,
      },
    ],
    [stats, t],
  );

  const statusFilters = useMemo(
    () =>
      [
        {
          value: "ALL" as StatusFilter,
          label: t.all,
          count: customers.length,
        },
        {
          value: "ACTIVE" as StatusFilter,
          label: t.active,
          count: stats.active,
        },
        {
          value: "LEAD" as StatusFilter,
          label: t.lead,
          count: stats.lead,
        },
        {
          value: "BLOCKED" as StatusFilter,
          label: t.blocked,
          count: stats.blocked,
        },
        {
          value: "INACTIVE" as StatusFilter,
          label: t.inactive,
          count: stats.inactive,
        },
      ] satisfies Array<{
        value: StatusFilter;
        label: string;
        count: number;
      }>,
    [customers.length, stats, t],
  );

  const moduleActions = useMemo(
    () => [
      {
        title: t.actionListTitle,
        description: t.actionListDesc,
        href: "/system/customers/list",
        icon: Users,
        badge: `${customers.length}`,
        cta: t.manage,
      },
      {
        title: t.actionCreateTitle,
        description: t.actionCreateDesc,
        href: "/system/customers/create",
        icon: Plus,
        badge: isArabic ? "جديد" : "New",
        cta: t.open,
      },
    ],
    [customers.length, isArabic, t],
  );

  const hasSearchOrFilter =
    query.trim().length > 0 || statusFilter !== "ALL";

  async function loadCustomers(showSuccessToast = false) {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await apiGet<CustomersApiResponse>(
        API_PATHS.customers.list,
        {
          page_size: 100,
        },
      );

      if (!response.ok) {
        throw new Error(response.message || t.apiError);
      }

      const normalized = normalizeApiList(response.data).map(normalizeCustomer);

      setCustomers(normalized);

      if (showSuccessToast) {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error("Failed to load customers:", error);
      setCustomers([]);
      setErrorMessage(t.apiError);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function renderFeaturedCustomer(customer: Customer) {
    const content = (
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3 transition hover:bg-muted/50">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
            {customer.customerType === "CORPORATE" ? (
              <Building2 className="h-5 w-5" />
            ) : (
              <Users className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold">{customer.name}</p>

              {customer.status === "ACTIVE" ? (
                <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-500" />
              ) : null}
            </div>

            <p className="mt-1 truncate text-xs text-muted-foreground">
              {customer.code}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-end">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {t.typeLabels[customer.customerType]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {customer.city || customer.source || "-"}
          </p>
        </div>
      </div>
    );

    if (!isValidCustomerId(customer.id)) {
      return (
        <div key={`${customer.code}-${customer.name}`} className="block">
          {content}
        </div>
      );
    }

    return (
      <Link
        key={customer.id}
        href={`/system/customers/${customer.id}`}
        className="block"
      >
        {content}
      </Link>
    );
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

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.pageTitle}
          </h1>
          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
            {t.pageSubtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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

          <Link href="/system/customers/create">
            <Button className="h-10 w-full rounded-xl sm:w-auto">
              <Plus className="h-4 w-4" />
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
                  {t.apiErrorHint}
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

      {/* Main Layout */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Featured Customers */}
        <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-1">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-bold">
                {t.featuredCustomers}
              </CardTitle>
              <CardDescription className="mt-1 text-sm">
                {t.featuredSubtitle}
              </CardDescription>
            </div>

            <Link href="/system/customers/list">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
              >
                <ListChecks className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>

          <CardContent className="space-y-3">
            {isLoading ? (
              <FeaturedCustomersSkeleton />
            ) : featuredCustomers.length === 0 ? (
              <div className="rounded-xl border border-dashed p-5 text-center">
                <p className="font-semibold">{t.emptyTitle}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t.emptyText}
                </p>
              </div>
            ) : (
              featuredCustomers.map((customer) =>
                renderFeaturedCustomer(customer),
              )
            )}
          </CardContent>
        </Card>

        {/* Status + Table */}
        <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-2">
          <CardHeader className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base font-bold">
                {t.trackStatus}
              </CardTitle>
              <CardDescription className="mt-1 text-sm">
                {t.trackSubtitle}
              </CardDescription>
            </div>

            <Link href="/system/customers/list">
              <Button variant="outline" className="h-9 rounded-xl">
                <ListChecks className="h-4 w-4" />
                <span>{t.viewFullList}</span>
              </Button>
            </Link>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Status Cards */}
            {isLoading ? (
              <StatusCardsSkeleton />
            ) : (
              <div className="grid gap-3 md:grid-cols-4">
                {statusCards.map((card) => {
                  const Icon = card.icon;

                  return (
                    <button
                      key={card.title}
                      type="button"
                      className="space-y-2 rounded-xl border bg-background/70 p-3 text-start transition hover:bg-muted/40"
                      onClick={() => setStatusFilter(card.filter)}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <p className="text-2xl font-bold">
                          {formatNumber(card.value)}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-muted-foreground">
                            {card.title}
                          </p>
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            {card.helperValue}
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${card.percent}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Search + Filters */}
            <div className="grid gap-3">
              <div className="relative">
                <Search
                  className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                    isArabic ? "right-3" : "left-3"
                  }`}
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.filterPlaceholder}
                  className={`h-10 rounded-xl ${
                    isArabic ? "pr-10" : "pl-10"
                  }`}
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {statusFilters.map((item) => {
                  const isSelected = statusFilter === item.value;

                  return (
                    <Button
                      key={item.value}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className="shrink-0 rounded-xl"
                      onClick={() => setStatusFilter(item.value)}
                    >
                      <span>{item.label}</span>
                      <Badge
                        variant={isSelected ? "secondary" : "outline"}
                        className="ms-1 rounded-full"
                      >
                        {formatNumber(item.count)}
                      </Badge>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.table.id}</TableHead>
                      <TableHead>{t.table.name}</TableHead>
                      <TableHead>{t.table.type}</TableHead>
                      <TableHead>{t.table.city}</TableHead>
                      <TableHead>{t.table.contact}</TableHead>
                      <TableHead>{t.table.status}</TableHead>
                      <TableHead>{t.table.action}</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {isLoading ? (
                      <TableRowsSkeleton />
                    ) : tableRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <div className="py-12 text-center">
                            <p className="font-semibold">
                              {hasSearchOrFilter
                                ? t.noResultsTitle
                                : t.emptyTitle}
                            </p>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {hasSearchOrFilter ? t.noResultsText : t.emptyText}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      tableRows.map((customer) => (
                        <TableRow key={`${customer.id}-${customer.code}`}>
                          <TableCell className="font-medium">
                            {customer.code || `#${customer.id}`}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                                {customer.customerType === "CORPORATE" ? (
                                  <Building2 className="h-4 w-4" />
                                ) : (
                                  <Users className="h-4 w-4" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {customer.name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {customer.email ||
                                    customer.primaryContact ||
                                    "-"}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="secondary" className="rounded-full">
                              {t.typeLabels[customer.customerType]}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>
                                {customer.city || customer.district || "-"}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
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

                          <TableCell>
                            {statusBadge(customer.status, locale)}
                          </TableCell>

                          <TableCell>
                            {isValidCustomerId(customer.id) ? (
                              <Link href={`/system/customers/${customer.id}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-lg"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg"
                                disabled
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                {t.showing} {formatNumber(tableRows.length)} {t.from}{" "}
                {formatNumber(filteredCustomers.length)} · {t.latestRecords}
              </p>

              <Link href="/system/customers/list">
                <Button variant="outline" size="sm" className="rounded-xl">
                  <ListChecks className="h-4 w-4" />
                  {t.viewFullList}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Cards */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">
            {t.quickAccessTitle}
          </CardTitle>
          <CardDescription>{t.quickAccessSubtitle}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {moduleActions.map((item) => {
              const Icon = item.icon;

              return (
                <Link key={item.href} href={item.href} className="block">
                  <Card className="h-full rounded-2xl border bg-background shadow-none transition hover:bg-muted/40 hover:shadow-sm">
                    <CardContent className="flex h-full items-start justify-between gap-4 p-4">
                      <div className="min-w-0 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                            <Icon className="h-5 w-5" />
                          </div>

                          <Badge variant="secondary" className="rounded-full">
                            {item.badge}
                          </Badge>
                        </div>

                        <div>
                          <p className="font-semibold">{item.title}</p>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {item.description}
                          </p>
                        </div>

                        <Button variant="outline" size="sm" className="rounded-xl">
                          {item.cta}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}