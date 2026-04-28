"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Eye,
  FileSpreadsheet,
  FilterIcon,
  Layers3,
  Loader2,
  Package,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
  Stethoscope,
  Tag,
  X,
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
   📂 app/system/products/list/page.tsx
   🧠 Primey Care | System Products & Programs List
   ------------------------------------------------------------
   ✅ ربط حقيقي مع /api/products/
   ✅ متوافق مع Backend المرحلة 5
   ✅ Cards / Programs / Services / Memberships
   ✅ Pricing / Orders / Contracts readiness
   ✅ Service Items count
   ✅ Search + Filters + Sort + Columns + Selection + Pagination
   ✅ Excel export للقائمة فقط
   ✅ Web PDF Print للقائمة فقط
   ✅ Arabic / English via primey-locale
   ✅ English numbers always
   ✅ SAR icon from /currency/sar.svg
============================================================ */

type AppLocale = "ar" | "en";

type ProductStatus =
  | "draft"
  | "active"
  | "inactive"
  | "archived"
  | "UNKNOWN";

type ProductType =
  | "membership"
  | "card"
  | "program"
  | "service"
  | "other"
  | "UNKNOWN";

type BillingType = "one_time" | "recurring" | "UNKNOWN";

type FulfillmentType =
  | "digital"
  | "physical"
  | "both"
  | "service_based"
  | "none"
  | "UNKNOWN";

type SortKey =
  | "name"
  | "code"
  | "product_type"
  | "status"
  | "price"
  | "created_at"
  | "updated_at";

type SortDirection = "asc" | "desc";

type ProductCategory = {
  id: number | string;
  code?: string | null;
  name?: string | null;
  category_type?: string | null;
  status?: string | null;
};

type ProductServiceItem = {
  id: number | string;
  name?: string | null;
  included_quantity?: number | null;
  unit_price?: string | number | null;
  discount_rate?: string | number | null;
  requires_provider?: boolean | null;
  is_optional?: boolean | null;
  is_active?: boolean | null;
};

type Product = {
  id: number | string;
  code?: string | null;
  name?: string | null;
  slug?: string | null;
  product_type?: ProductType | string | null;
  category_id?: number | string | null;
  category?: ProductCategory | null;
  status?: ProductStatus | string | null;
  billing_type?: BillingType | string | null;
  fulfillment_type?: FulfillmentType | string | null;
  short_description?: string | null;
  description?: string | null;
  tags?: string | null;
  currency_code?: string | null;
  price?: string | number | null;
  sale_price?: string | number | null;
  effective_price?: string | number | null;
  tax_amount?: string | number | null;
  total_price_with_tax?: string | number | null;
  has_discount?: boolean | null;
  is_taxable?: boolean | null;
  tax_rate?: string | number | null;
  duration_value?: number | null;
  duration_unit?: string | null;
  is_public?: boolean | null;
  is_featured?: boolean | null;
  requires_approval?: boolean | null;
  allow_online_purchase?: boolean | null;
  allow_agent_sale?: boolean | null;
  allow_provider_sale?: boolean | null;
  can_be_ordered?: boolean | null;
  can_be_used_in_contracts?: boolean | null;
  requires_provider?: boolean | null;
  max_discount_rate?: string | number | null;
  default_agent_commission_rate?: string | number | null;
  service_items?: ProductServiceItem[];
  created_at?: string | null;
  updated_at?: string | null;
};

type ProductsApiResponse = {
  ok?: boolean;
  message?: string;
  results?: Product[];
  data?: Product[] | Product;
  pagination?: {
    page?: number;
    page_size?: number;
    total_pages?: number;
    total_items?: number;
  };
};

type ColumnKey =
  | "select"
  | "product"
  | "type"
  | "category"
  | "price"
  | "billing"
  | "readiness"
  | "visibility"
  | "status"
  | "updated"
  | "actions";

type ColumnState = Record<ColumnKey, boolean>;

const SAR_ICON_PATH = "/currency/sar.svg";
const PAGE_SIZE = 10;

const DEFAULT_COLUMNS: ColumnState = {
  select: true,
  product: true,
  type: true,
  category: true,
  price: true,
  billing: true,
  readiness: true,
  visibility: true,
  status: true,
  updated: true,
  actions: true,
};

function readStoredLocale(): AppLocale {
  if (typeof window === "undefined") return "ar";

  const saved = window.localStorage.getItem("primey-locale");
  if (saved === "en" || saved === "ar") return saved;

  const htmlLang = document.documentElement.lang;
  if (htmlLang === "en") return "en";

  return "ar";
}

function toNumber(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatMoney(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatDate(value: string | null | undefined, locale: AppLocale) {
  if (!value) return locale === "ar" ? "غير محدد" : "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return locale === "ar" ? "غير محدد" : "Not set";
  }

  return new Intl.DateTimeFormat(
    locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  ).format(date);
}

function normalizeStatus(status?: string | null): ProductStatus {
  const value = String(status || "").toLowerCase();

  if (value === "draft") return "draft";
  if (value === "active") return "active";
  if (value === "inactive") return "inactive";
  if (value === "archived") return "archived";

  return "UNKNOWN";
}

function normalizeType(type?: string | null): ProductType {
  const value = String(type || "").toLowerCase();

  if (value === "membership") return "membership";
  if (value === "card") return "card";
  if (value === "program") return "program";
  if (value === "service") return "service";
  if (value === "other") return "other";

  return "UNKNOWN";
}

function normalizeBillingType(type?: string | null): BillingType {
  const value = String(type || "").toLowerCase();

  if (value === "one_time") return "one_time";
  if (value === "recurring") return "recurring";

  return "UNKNOWN";
}

function normalizeFulfillmentType(type?: string | null): FulfillmentType {
  const value = String(type || "").toLowerCase();

  if (value === "digital") return "digital";
  if (value === "physical") return "physical";
  if (value === "both") return "both";
  if (value === "service_based") return "service_based";
  if (value === "none") return "none";

  return "UNKNOWN";
}

function getStatusMeta(status: ProductStatus, locale: AppLocale) {
  const isArabic = locale === "ar";

  const map: Record<ProductStatus, { label: string; className: string }> = {
    active: {
      label: isArabic ? "نشط" : "Active",
      className:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    draft: {
      label: isArabic ? "مسودة" : "Draft",
      className:
        "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    inactive: {
      label: isArabic ? "غير نشط" : "Inactive",
      className:
        "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    },
    archived: {
      label: isArabic ? "مؤرشف" : "Archived",
      className:
        "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    },
    UNKNOWN: {
      label: isArabic ? "غير محدد" : "Unknown",
      className: "border-muted bg-muted/60 text-muted-foreground",
    },
  };

  return map[status] || map.UNKNOWN;
}

function getTypeLabel(type: ProductType, locale: AppLocale) {
  const isArabic = locale === "ar";

  const map: Record<ProductType, string> = {
    membership: isArabic ? "عضوية" : "Membership",
    card: isArabic ? "بطاقة" : "Card",
    program: isArabic ? "برنامج" : "Program",
    service: isArabic ? "خدمة" : "Service",
    other: isArabic ? "أخرى" : "Other",
    UNKNOWN: isArabic ? "غير محدد" : "Unknown",
  };

  return map[type] || map.UNKNOWN;
}

function getBillingLabel(type: BillingType, locale: AppLocale) {
  const isArabic = locale === "ar";

  const map: Record<BillingType, string> = {
    one_time: isArabic ? "مرة واحدة" : "One time",
    recurring: isArabic ? "متكرر" : "Recurring",
    UNKNOWN: isArabic ? "غير محدد" : "Unknown",
  };

  return map[type] || map.UNKNOWN;
}

function getFulfillmentLabel(type: FulfillmentType, locale: AppLocale) {
  const isArabic = locale === "ar";

  const map: Record<FulfillmentType, string> = {
    digital: isArabic ? "رقمي" : "Digital",
    physical: isArabic ? "فعلي" : "Physical",
    both: isArabic ? "رقمي وفعلي" : "Digital & physical",
    service_based: isArabic ? "خدمة" : "Service based",
    none: isArabic ? "بدون" : "None",
    UNKNOWN: isArabic ? "غير محدد" : "Unknown",
  };

  return map[type] || map.UNKNOWN;
}

function extractProducts(payload: ProductsApiResponse): Product[] {
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    badge1: "System Products",
    badge2: "Products List",

    title: isArabic ? "قائمة المنتجات" : "Products List",
    subtitle: isArabic
      ? "إدارة المنتجات والبطاقات والبرامج والخدمات مع البحث والتصفية والتصدير والطباعة وربطها بالطلبات والعقود."
      : "Manage products, cards, programs, and services with search, filters, export, print, orders, and contracts readiness.",

    dashboard: isArabic ? "لوحة المنتجات" : "Products Dashboard",
    refresh: isArabic ? "تحديث" : "Refresh",
    create: isArabic ? "إنشاء منتج" : "Create Product",
    reports: isArabic ? "التقارير" : "Reports",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة Web PDF" : "Print Web PDF",
    columns: isArabic ? "الأعمدة" : "Columns",
    clear: isArabic ? "مسح" : "Clear",

    searchPlaceholder: isArabic
      ? "ابحث باسم المنتج أو الكود أو التصنيف أو الوسوم..."
      : "Search by product name, code, category, or tags...",

    allStatuses: isArabic ? "كل الحالات" : "All statuses",
    allTypes: isArabic ? "كل الأنواع" : "All types",
    allBilling: isArabic ? "كل طرق الفوترة" : "All billing",

    active: isArabic ? "نشط" : "Active",
    draft: isArabic ? "مسودة" : "Draft",
    inactive: isArabic ? "غير نشط" : "Inactive",
    archived: isArabic ? "مؤرشف" : "Archived",

    membership: isArabic ? "عضوية" : "Membership",
    card: isArabic ? "بطاقة" : "Card",
    program: isArabic ? "برنامج" : "Program",
    service: isArabic ? "خدمة" : "Service",
    other: isArabic ? "أخرى" : "Other",

    oneTime: isArabic ? "مرة واحدة" : "One time",
    recurring: isArabic ? "متكرر" : "Recurring",

    total: isArabic ? "إجمالي المنتجات" : "Total Products",
    activeProducts: isArabic ? "منتجات نشطة" : "Active Products",
    featured: isArabic ? "مميزة" : "Featured",
    orderable: isArabic ? "قابلة للطلب" : "Orderable",
    contractReady: isArabic ? "جاهزة للعقود" : "Contract Ready",
    requiresProvider: isArabic ? "تتطلب مقدم خدمة" : "Requires Provider",

    selected: isArabic ? "محدد" : "Selected",
    showing: isArabic ? "عرض" : "Showing",
    from: isArabic ? "من" : "of",
    page: isArabic ? "صفحة" : "Page",

    colSelect: isArabic ? "تحديد" : "Select",
    colProduct: isArabic ? "المنتج" : "Product",
    colType: isArabic ? "النوع" : "Type",
    colCategory: isArabic ? "التصنيف" : "Category",
    colPrice: isArabic ? "السعر" : "Price",
    colBilling: isArabic ? "الفوترة" : "Billing",
    colReadiness: isArabic ? "الجاهزية" : "Readiness",
    colVisibility: isArabic ? "الظهور" : "Visibility",
    colStatus: isArabic ? "الحالة" : "Status",
    colUpdated: isArabic ? "آخر تحديث" : "Updated",
    colActions: isArabic ? "الإجراء" : "Action",

    public: isArabic ? "عام" : "Public",
    private: isArabic ? "خاص" : "Private",
    featuredLabel: isArabic ? "مميز" : "Featured",
    onlineLabel: isArabic ? "شراء إلكتروني" : "Online",
    agentSale: isArabic ? "بيع مندوب" : "Agent sale",
    providerSale: isArabic ? "بيع مقدم" : "Provider sale",
    taxable: isArabic ? "ضريبة" : "Tax",
    discount: isArabic ? "خصم" : "Discount",
    serviceItems: isArabic ? "خدمات" : "Services",

    noCategory: isArabic ? "بدون تصنيف" : "No category",
    unnamedProduct: isArabic ? "منتج بدون اسم" : "Unnamed product",
    view: isArabic ? "عرض" : "View",

    tableTitle: isArabic ? "جدول المنتجات" : "Products Table",
    tableDesc: isArabic
      ? "القائمة التشغيلية للمنتجات والباقات والخدمات المسجلة في النظام."
      : "Operational list of products, programs, and services registered in the system.",

    loading: isArabic ? "جاري تحميل المنتجات..." : "Loading products...",
    noProducts: isArabic ? "لا توجد منتجات مطابقة" : "No matching products",
    loadError: isArabic
      ? "تعذر تحميل بيانات المنتجات"
      : "Could not load products data",
    refreshSuccess: isArabic ? "تم تحديث المنتجات" : "Products refreshed",
    exportSuccess: isArabic ? "تم تصدير ملف Excel" : "Excel file exported",
    exportError: isArabic ? "تعذر تصدير ملف Excel" : "Could not export Excel file",

    printTitle: isArabic ? "قائمة منتجات Primey Care" : "Primey Care Products List",
    generatedAt: isArabic ? "تاريخ التوليد" : "Generated at",
  };
}

function getColumnLabel(key: ColumnKey, locale: AppLocale) {
  const t = dictionary(locale);

  const map: Record<ColumnKey, string> = {
    select: t.colSelect,
    product: t.colProduct,
    type: t.colType,
    category: t.colCategory,
    price: t.colPrice,
    billing: t.colBilling,
    readiness: t.colReadiness,
    visibility: t.colVisibility,
    status: t.colStatus,
    updated: t.colUpdated,
    actions: t.colActions,
  };

  return map[key];
}

export default function SystemProductsListPage() {
  const printRef = useRef<HTMLDivElement | null>(null);

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ProductType | "all">("all");
  const [billingFilter, setBillingFilter] = useState<BillingType | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [columns, setColumns] = useState<ColumnState>(DEFAULT_COLUMNS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const t = dictionary(locale);

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readStoredLocale();

      setLocale(nextLocale);

      document.documentElement.lang = nextLocale;
      document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr";
      document.body.dir = nextLocale === "ar" ? "rtl" : "ltr";
    };

    syncLocale();

    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    const timer = window.setTimeout(syncLocale, 100);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
      window.clearTimeout(timer);
    };
  }, []);

  const loadProducts = useCallback(
    async (showToast = false) => {
      setIsLoading(true);

      try {
        const response = await fetch(
          "/api/products/?page_size=100&include_children=true",
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }
        );

        const payload = (await response.json().catch(() => ({}))) as ProductsApiResponse;

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.message || t.loadError);
        }

        setProducts(extractProducts(payload));

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load products:", error);
        toast.error(t.loadError);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    },
    [t.loadError, t.refreshSuccess]
  );

  useEffect(() => {
    loadProducts(false);
  }, [loadProducts]);

  const stats = useMemo(() => {
    return {
      total: products.length,
      active: products.filter(
        (product) => normalizeStatus(product.status) === "active"
      ).length,
      featured: products.filter((product) => Boolean(product.is_featured)).length,
      orderable: products.filter((product) => Boolean(product.can_be_ordered))
        .length,
      contractReady: products.filter((product) =>
        Boolean(product.can_be_used_in_contracts)
      ).length,
      requiresProvider: products.filter((product) =>
        Boolean(product.requires_provider)
      ).length,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) => {
      const status = normalizeStatus(product.status);
      const type = normalizeType(product.product_type);
      const billing = normalizeBillingType(product.billing_type);
      const fulfillment = normalizeFulfillmentType(product.fulfillment_type);

      const matchesSearch = term
        ? [
            product.name,
            product.code,
            product.slug,
            product.short_description,
            product.description,
            product.category?.name,
            product.category?.code,
            product.tags,
            product.status,
            product.product_type,
            product.billing_type,
            product.fulfillment_type,
            getTypeLabel(type, locale),
            getBillingLabel(billing, locale),
            getFulfillmentLabel(fulfillment, locale),
          ].some((value) => String(value || "").toLowerCase().includes(term))
        : true;

      const matchesStatus =
        statusFilter === "all" ? true : status === statusFilter;

      const matchesType = typeFilter === "all" ? true : type === typeFilter;

      const matchesBilling =
        billingFilter === "all" ? true : billing === billingFilter;

      return matchesSearch && matchesStatus && matchesType && matchesBilling;
    });
  }, [products, search, statusFilter, typeFilter, billingFilter, locale]);

  const sortedProducts = useMemo(() => {
    const rows = [...filteredProducts];

    rows.sort((a, b) => {
      let first: string | number = "";
      let second: string | number = "";

      if (sortKey === "name") {
        first = String(a.name || "").toLowerCase();
        second = String(b.name || "").toLowerCase();
      }

      if (sortKey === "code") {
        first = String(a.code || "").toLowerCase();
        second = String(b.code || "").toLowerCase();
      }

      if (sortKey === "product_type") {
        first = String(a.product_type || "").toLowerCase();
        second = String(b.product_type || "").toLowerCase();
      }

      if (sortKey === "status") {
        first = String(a.status || "").toLowerCase();
        second = String(b.status || "").toLowerCase();
      }

      if (sortKey === "price") {
        first = toNumber(a.effective_price || a.price);
        second = toNumber(b.effective_price || b.price);
      }

      if (sortKey === "created_at") {
        first = new Date(a.created_at || 0).getTime();
        second = new Date(b.created_at || 0).getTime();
      }

      if (sortKey === "updated_at") {
        first = new Date(a.updated_at || a.created_at || 0).getTime();
        second = new Date(b.updated_at || b.created_at || 0).getTime();
      }

      if (first < second) return sortDirection === "asc" ? -1 : 1;
      if (first > second) return sortDirection === "asc" ? 1 : -1;

      return 0;
    });

    return rows;
  }, [filteredProducts, sortKey, sortDirection]);

  const totalPages = Math.max(Math.ceil(sortedProducts.length / PAGE_SIZE), 1);

  const paginatedProducts = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;

    return sortedProducts.slice(start, start + PAGE_SIZE);
  }, [sortedProducts, currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [search, statusFilter, typeFilter, billingFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const selectedCount = selectedIds.size;

  const allPageSelected =
    paginatedProducts.length > 0 &&
    paginatedProducts.every((product) => selectedIds.has(String(product.id)));

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function toggleRow(productId: number | string) {
    const id = String(productId);

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

  function togglePageSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (allPageSelected) {
        paginatedProducts.forEach((product) => next.delete(String(product.id)));
      } else {
        paginatedProducts.forEach((product) => next.add(String(product.id)));
      }

      return next;
    });
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setBillingFilter("all");
    setSelectedIds(new Set());
    setCurrentPage(1);
  }

  function buildExportRows() {
    return sortedProducts.map((product, index) => {
      const status = normalizeStatus(product.status);
      const type = normalizeType(product.product_type);
      const billing = normalizeBillingType(product.billing_type);
      const fulfillment = normalizeFulfillmentType(product.fulfillment_type);

      return {
        "#": index + 1,
        [t.colProduct]: product.name || t.unnamedProduct,
        [t.colCategory]: product.category?.name || t.noCategory,
        [t.colType]: getTypeLabel(type, locale),
        [t.colBilling]: getBillingLabel(billing, locale),
        Fulfillment: getFulfillmentLabel(fulfillment, locale),
        [t.colPrice]: formatMoney(product.effective_price || product.price),
        [t.colStatus]: getStatusMeta(status, locale).label,
        [t.orderable]: product.can_be_ordered ? t.orderable : "-",
        [t.contractReady]: product.can_be_used_in_contracts
          ? t.contractReady
          : "-",
        [t.requiresProvider]: product.requires_provider ? t.requiresProvider : "-",
        [t.serviceItems]: formatNumber(product.service_items?.length || 0),
        [t.public]: product.is_public ? t.public : t.private,
        [t.featuredLabel]: product.is_featured ? t.featuredLabel : "-",
        [t.onlineLabel]: product.allow_online_purchase ? t.onlineLabel : "-",
        [t.taxable]: product.is_taxable ? t.taxable : "-",
        [t.colUpdated]: formatDate(product.updated_at || product.created_at, locale),
        Code: product.code || "-",
      };
    });
  }

  async function exportExcel() {
    try {
      const XLSX = await import("xlsx");
      const rows = buildExportRows();

      const summaryRows = [
        [t.printTitle],
        [t.generatedAt, formatDate(new Date().toISOString(), locale)],
        [t.total, formatNumber(stats.total)],
        [t.activeProducts, formatNumber(stats.active)],
        [t.featured, formatNumber(stats.featured)],
        [t.orderable, formatNumber(stats.orderable)],
        [t.contractReady, formatNumber(stats.contractReady)],
        [t.requiresProvider, formatNumber(stats.requiresProvider)],
        [],
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.sheet_add_json(worksheet, rows, {
        origin: -1,
        skipHeader: false,
      });

      worksheet["!cols"] = [
        { wch: 8 },
        { wch: 32 },
        { wch: 24 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        locale === "ar" ? "قائمة المنتجات" : "Products List"
      );

      XLSX.writeFile(workbook, "primey-care-products-list.xlsx");

      toast.success(t.exportSuccess);
    } catch (error) {
      console.error("Failed to export products excel:", error);
      toast.error(t.exportError);
    }
  }

  function printTable() {
    const content = printRef.current?.innerHTML;

    if (!content) return;

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) return;

    const dir = locale === "ar" ? "rtl" : "ltr";
    const lang = locale === "ar" ? "ar" : "en";

    printWindow.document.write(`
      <!doctype html>
      <html lang="${lang}" dir="${dir}">
        <head>
          <meta charset="utf-8" />
          <title>${t.printTitle}</title>
          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 28px;
              font-family: Arial, Tahoma, sans-serif;
              color: #111827;
              background: #ffffff;
            }

            .print-header {
              display: flex;
              justify-content: space-between;
              gap: 16px;
              align-items: flex-start;
              margin-bottom: 22px;
              padding-bottom: 16px;
              border-bottom: 1px solid #e5e7eb;
            }

            .print-title {
              margin: 0;
              font-size: 22px;
              font-weight: 800;
            }

            .print-meta {
              margin-top: 8px;
              color: #6b7280;
              font-size: 12px;
            }

            .print-summary {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 10px;
              margin-bottom: 18px;
            }

            .print-card {
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              padding: 12px;
              background: #f9fafb;
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
              overflow: hidden;
              border: 1px solid #e5e7eb;
            }

            th {
              background: #f3f4f6;
              font-size: 12px;
              text-align: start;
              padding: 10px;
              border: 1px solid #e5e7eb;
              white-space: nowrap;
            }

            td {
              font-size: 12px;
              padding: 10px;
              border: 1px solid #e5e7eb;
              vertical-align: top;
            }

            .muted {
              color: #6b7280;
            }

            .badge {
              display: inline-flex;
              align-items: center;
              border: 1px solid #d1d5db;
              border-radius: 999px;
              padding: 3px 8px;
              font-size: 11px;
              background: #ffffff;
              margin: 1px;
            }

            @media print {
              body {
                padding: 16px;
              }

              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          ${content}
          <script>
            window.onload = function () {
              window.print();
              window.onafterprint = function () {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  const statusOptions: Array<{ value: ProductStatus | "all"; label: string }> = [
    { value: "all", label: t.allStatuses },
    { value: "active", label: t.active },
    { value: "draft", label: t.draft },
    { value: "inactive", label: t.inactive },
    { value: "archived", label: t.archived },
  ];

  const typeOptions: Array<{ value: ProductType | "all"; label: string }> = [
    { value: "all", label: t.allTypes },
    { value: "membership", label: t.membership },
    { value: "card", label: t.card },
    { value: "program", label: t.program },
    { value: "service", label: t.service },
    { value: "other", label: t.other },
  ];

  const billingOptions: Array<{ value: BillingType | "all"; label: string }> = [
    { value: "all", label: t.allBilling },
    { value: "one_time", label: t.oneTime },
    { value: "recurring", label: t.recurring },
  ];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-3xl border-white/20 bg-white/70 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardContent className="p-6 md:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full px-3 py-1">{t.badge1}</Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {t.badge2}
                </Badge>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  {t.title}
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                  {t.subtitle}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="/system/products">
                  <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                  {t.dashboard}
                </Link>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => loadProducts(true)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                {t.refresh}
              </Button>

              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="/system/products/reports">
                  <BarChart3 className="h-4 w-4" />
                  {t.reports}
                </Link>
              </Button>

              <Button asChild className="rounded-2xl">
                <Link href="/system/products/create">
                  <Plus className="h-4 w-4" />
                  {t.create}
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardContent className="flex items-start justify-between gap-3 p-5">
            <div>
              <p className="text-sm text-muted-foreground">{t.total}</p>
              <p className="mt-2 text-2xl font-bold">{formatNumber(stats.total)}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardContent className="flex items-start justify-between gap-3 p-5">
            <div>
              <p className="text-sm text-muted-foreground">{t.activeProducts}</p>
              <p className="mt-2 text-2xl font-bold">
                {formatNumber(stats.active)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BadgeCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardContent className="flex items-start justify-between gap-3 p-5">
            <div>
              <p className="text-sm text-muted-foreground">{t.orderable}</p>
              <p className="mt-2 text-2xl font-bold">
                {formatNumber(stats.orderable)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardContent className="flex items-start justify-between gap-3 p-5">
            <div>
              <p className="text-sm text-muted-foreground">{t.contractReady}</p>
              <p className="mt-2 text-2xl font-bold">
                {formatNumber(stats.contractReady)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Boxes className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                {t.tableTitle}
              </CardTitle>
              <CardDescription>{t.tableDesc}</CardDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={exportExcel}
              >
                <Download className="h-4 w-4" />
                {t.exportExcel}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={printTable}
              >
                <Printer className="h-4 w-4" />
                {t.print}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="rounded-2xl">
                    <Columns3 className="h-4 w-4" />
                    {t.columns}
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{t.columns}</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {(Object.keys(DEFAULT_COLUMNS) as ColumnKey[])
                    .filter((key) => key !== "select" && key !== "actions")
                    .map((key) => (
                      <DropdownMenuCheckboxItem
                        key={key}
                        checked={columns[key]}
                        onCheckedChange={(checked) =>
                          setColumns((current) => ({
                            ...current,
                            [key]: Boolean(checked),
                          }))
                        }
                      >
                        {getColumnLabel(key, locale)}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1fr_auto_auto_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t.searchPlaceholder}
                className="rounded-2xl bg-background/70 ltr:pl-9 rtl:pr-9"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="rounded-2xl">
                  <FilterIcon className="h-4 w-4" />
                  {
                    statusOptions.find((option) => option.value === statusFilter)
                      ?.label
                  }
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                {statusOptions.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={statusFilter === option.value}
                    onCheckedChange={() => setStatusFilter(option.value)}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="rounded-2xl">
                  <Tag className="h-4 w-4" />
                  {typeOptions.find((option) => option.value === typeFilter)?.label}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                {typeOptions.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={typeFilter === option.value}
                    onCheckedChange={() => setTypeFilter(option.value)}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="rounded-2xl">
                  <ArrowDownUp className="h-4 w-4" />
                  {
                    billingOptions.find((option) => option.value === billingFilter)
                      ?.label
                  }
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                {billingOptions.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={billingFilter === option.value}
                    onCheckedChange={() => setBillingFilter(option.value)}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              type="button"
              variant="ghost"
              className="rounded-2xl"
              onClick={resetFilters}
            >
              <X className="h-4 w-4" />
              {t.clear}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                {t.showing} {formatNumber(sortedProducts.length)} {t.from}{" "}
                {formatNumber(products.length)}
              </Badge>

              {selectedCount > 0 ? (
                <Badge className="rounded-full">
                  {formatNumber(selectedCount)} {t.selected}
                </Badge>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                disabled={currentPage <= 1}
              >
                <ChevronRight className="h-4 w-4 rtl:hidden" />
                <ChevronLeft className="hidden h-4 w-4 rtl:block" />
              </Button>

              <span className="text-xs">
                {t.page} {formatNumber(currentPage)} / {formatNumber(totalPages)}
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() =>
                  setCurrentPage((page) => Math.min(page + 1, totalPages))
                }
                disabled={currentPage >= totalPages}
              >
                <ChevronLeft className="h-4 w-4 rtl:hidden" />
                <ChevronRight className="hidden h-4 w-4 rtl:block" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-hidden rounded-3xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {columns.select ? (
                    <TableHead className="w-[48px]">
                      <Checkbox
                        checked={allPageSelected}
                        onCheckedChange={togglePageSelection}
                        aria-label={t.colSelect}
                      />
                    </TableHead>
                  ) : null}

                  {columns.product ? (
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort("name")}
                      >
                        {t.colProduct}
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                  ) : null}

                  {columns.type ? (
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort("product_type")}
                      >
                        {t.colType}
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                  ) : null}

                  {columns.category ? <TableHead>{t.colCategory}</TableHead> : null}

                  {columns.price ? (
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort("price")}
                      >
                        {t.colPrice}
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                  ) : null}

                  {columns.billing ? <TableHead>{t.colBilling}</TableHead> : null}

                  {columns.readiness ? (
                    <TableHead>{t.colReadiness}</TableHead>
                  ) : null}

                  {columns.visibility ? (
                    <TableHead>{t.colVisibility}</TableHead>
                  ) : null}

                  {columns.status ? (
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort("status")}
                      >
                        {t.colStatus}
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                  ) : null}

                  {columns.updated ? (
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort("updated_at")}
                      >
                        {t.colUpdated}
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                  ) : null}

                  {columns.actions ? (
                    <TableHead className="text-center">{t.colActions}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-32 text-center">
                      <div className="flex items-center justify-center text-sm text-muted-foreground">
                        <Loader2 className="mx-2 h-4 w-4 animate-spin" />
                        {t.loading}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedProducts.length ? (
                  paginatedProducts.map((product) => {
                    const id = String(product.id);
                    const status = normalizeStatus(product.status);
                    const statusMeta = getStatusMeta(status, locale);
                    const type = normalizeType(product.product_type);
                    const billing = normalizeBillingType(product.billing_type);
                    const fulfillment = normalizeFulfillmentType(
                      product.fulfillment_type
                    );

                    return (
                      <TableRow key={id}>
                        {columns.select ? (
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(id)}
                              onCheckedChange={() => toggleRow(id)}
                              aria-label={t.colSelect}
                            />
                          </TableCell>
                        ) : null}

                        {columns.product ? (
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <Package className="h-4 w-4" />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate font-semibold">
                                  {product.name || t.unnamedProduct}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {product.code || product.slug || "-"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                        ) : null}

                        {columns.type ? (
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant="secondary" className="w-fit rounded-full">
                                {getTypeLabel(type, locale)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {getFulfillmentLabel(fulfillment, locale)}
                              </span>
                            </div>
                          </TableCell>
                        ) : null}

                        {columns.category ? (
                          <TableCell className="text-sm text-muted-foreground">
                            {product.category?.name || t.noCategory}
                          </TableCell>
                        ) : null}

                        {columns.price ? (
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 font-semibold">
                                <span>
                                  {formatMoney(
                                    product.effective_price || product.price
                                  )}
                                </span>
                                <Image
                                  src={SAR_ICON_PATH}
                                  alt="SAR"
                                  width={14}
                                  height={14}
                                  className="opacity-80"
                                />
                              </div>

                              <div className="flex flex-wrap gap-1">
                                {product.has_discount ? (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full text-[11px]"
                                  >
                                    {t.discount}
                                  </Badge>
                                ) : null}

                                {product.is_taxable ? (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full text-[11px]"
                                  >
                                    {t.taxable}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                        ) : null}

                        {columns.billing ? (
                          <TableCell>
                            {getBillingLabel(billing, locale)}
                          </TableCell>
                        ) : null}

                        {columns.readiness ? (
                          <TableCell>
                            <div className="flex max-w-[240px] flex-wrap gap-1">
                              {product.can_be_ordered ? (
                                <Badge variant="secondary" className="rounded-full">
                                  <ShieldCheck className="h-3 w-3" />
                                  {t.orderable}
                                </Badge>
                              ) : null}

                              {product.can_be_used_in_contracts ? (
                                <Badge variant="outline" className="rounded-full">
                                  <Boxes className="h-3 w-3" />
                                  {t.contractReady}
                                </Badge>
                              ) : null}

                              {product.requires_provider ? (
                                <Badge variant="outline" className="rounded-full">
                                  <Stethoscope className="h-3 w-3" />
                                  {t.requiresProvider}
                                </Badge>
                              ) : null}

                              {(product.service_items?.length || 0) > 0 ? (
                                <Badge variant="outline" className="rounded-full">
                                  <Layers3 className="h-3 w-3" />
                                  {formatNumber(product.service_items?.length || 0)}{" "}
                                  {t.serviceItems}
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                        ) : null}

                        {columns.visibility ? (
                          <TableCell>
                            <div className="flex max-w-[220px] flex-wrap gap-1">
                              <Badge variant="outline" className="rounded-full">
                                {product.is_public ? t.public : t.private}
                              </Badge>

                              {product.is_featured ? (
                                <Badge className="rounded-full">
                                  <Star className="h-3 w-3" />
                                  {t.featuredLabel}
                                </Badge>
                              ) : null}

                              {product.allow_online_purchase ? (
                                <Badge variant="secondary" className="rounded-full">
                                  {t.onlineLabel}
                                </Badge>
                              ) : null}

                              {product.allow_agent_sale ? (
                                <Badge variant="outline" className="rounded-full">
                                  {t.agentSale}
                                </Badge>
                              ) : null}

                              {product.allow_provider_sale ? (
                                <Badge variant="outline" className="rounded-full">
                                  {t.providerSale}
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                        ) : null}

                        {columns.status ? (
                          <TableCell>
                            <Badge
                              className={`rounded-full border px-2.5 py-1 ${statusMeta.className}`}
                            >
                              {statusMeta.label}
                            </Badge>
                          </TableCell>
                        ) : null}

                        {columns.updated ? (
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(
                              product.updated_at || product.created_at,
                              locale
                            )}
                          </TableCell>
                        ) : null}

                        {columns.actions ? (
                          <TableCell>
                            <div className="flex justify-center">
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="rounded-xl"
                              >
                                <Link href={`/system/products/${product.id}`}>
                                  <Eye className="h-4 w-4" />
                                  {t.view}
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="h-32 text-center text-sm text-muted-foreground"
                    >
                      {t.noProducts}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="hidden">
        <div ref={printRef}>
          <div className="print-header">
            <div>
              <h1 className="print-title">{t.printTitle}</h1>
              <p className="print-meta">
                {t.generatedAt}: {formatDate(new Date().toISOString(), locale)}
              </p>
            </div>
          </div>

          <div className="print-summary">
            <div className="print-card">
              <div className="print-card-label">{t.total}</div>
              <div className="print-card-value">{formatNumber(stats.total)}</div>
            </div>

            <div className="print-card">
              <div className="print-card-label">{t.activeProducts}</div>
              <div className="print-card-value">{formatNumber(stats.active)}</div>
            </div>

            <div className="print-card">
              <div className="print-card-label">{t.orderable}</div>
              <div className="print-card-value">{formatNumber(stats.orderable)}</div>
            </div>

            <div className="print-card">
              <div className="print-card-label">{t.contractReady}</div>
              <div className="print-card-value">
                {formatNumber(stats.contractReady)}
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{t.colProduct}</th>
                <th>{t.colType}</th>
                <th>{t.colCategory}</th>
                <th>{t.colPrice}</th>
                <th>{t.colBilling}</th>
                <th>{t.colReadiness}</th>
                <th>{t.colVisibility}</th>
                <th>{t.colStatus}</th>
                <th>{t.colUpdated}</th>
              </tr>
            </thead>

            <tbody>
              {sortedProducts.map((product, index) => {
                const status = normalizeStatus(product.status);
                const statusMeta = getStatusMeta(status, locale);
                const type = normalizeType(product.product_type);
                const billing = normalizeBillingType(product.billing_type);
                const fulfillment = normalizeFulfillmentType(product.fulfillment_type);

                return (
                  <tr key={product.id}>
                    <td>{formatNumber(index + 1)}</td>
                    <td>
                      <strong>{product.name || t.unnamedProduct}</strong>
                      <div className="muted">{product.code || "-"}</div>
                    </td>
                    <td>
                      {getTypeLabel(type, locale)}
                      <div className="muted">
                        {getFulfillmentLabel(fulfillment, locale)}
                      </div>
                    </td>
                    <td>{product.category?.name || t.noCategory}</td>
                    <td>{formatMoney(product.effective_price || product.price)}</td>
                    <td>{getBillingLabel(billing, locale)}</td>
                    <td>
                      {product.can_be_ordered ? (
                        <span className="badge">{t.orderable}</span>
                      ) : null}
                      {product.can_be_used_in_contracts ? (
                        <span className="badge">{t.contractReady}</span>
                      ) : null}
                      {product.requires_provider ? (
                        <span className="badge">{t.requiresProvider}</span>
                      ) : null}
                    </td>
                    <td>
                      <span className="badge">
                        {product.is_public ? t.public : t.private}
                      </span>
                      {product.is_featured ? (
                        <span className="badge">{t.featuredLabel}</span>
                      ) : null}
                      {product.allow_online_purchase ? (
                        <span className="badge">{t.onlineLabel}</span>
                      ) : null}
                    </td>
                    <td>
                      <span className="badge">{statusMeta.label}</span>
                    </td>
                    <td>
                      {formatDate(product.updated_at || product.created_at, locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}