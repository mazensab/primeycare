"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Activity,
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Boxes,
  ColumnsIcon,
  CreditCard,
  Download,
  FileText,
  FilterIcon,
  Layers3,
  Loader2,
  Package,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
  Tag,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

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
   📂 app/system/products/reports/page.tsx
   🧠 Primey Care | Products Reports
   ------------------------------------------------------------
   ✅ نفس نمط تقارير المراكز / العملاء / المندوبين
   ✅ استخدام UI الداخلي فقط
   ✅ بطاقات + جداول + فلاتر
   ✅ تحديد صفوف + إظهار/إخفاء أعمدة
   ✅ تصدير Excel منظم .xlsx للقسم فقط
   ✅ طباعة Web PDF للقسم فقط
   ✅ ربط حقيقي مع /api/products/
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ الأرقام دائمًا إنجليزية
   ✅ بدون localhost hardcoded
   ✅ استخدام رمز SAR من /currency/sar.svg
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

type StatusFilter = "ALL" | ProductStatus;
type TypeFilter = "ALL" | ProductType;
type BillingFilter = "ALL" | BillingType;
type FeaturedFilter = "ALL" | "FEATURED" | "NORMAL";

type SortKey = "name" | "code" | "productType" | "status" | "billingType" | "price";
type SortDirection = "asc" | "desc";

type ProductCategory = {
  id?: number | string | null;
  code?: string | null;
  name?: string | null;
  category_type?: string | null;
  status?: string | null;
};

type Product = {
  id: number | string;
  code: string;
  name: string;
  slug: string;
  productType: ProductType;
  categoryName: string;
  status: ProductStatus;
  billingType: BillingType;
  shortDescription: string;
  description: string;
  tags: string;
  price: number;
  salePrice: number | null;
  effectivePrice: number;
  costPrice: number | null;
  hasDiscount: boolean;
  isTaxable: boolean;
  taxRate: number;
  durationValue: number;
  durationUnit: string;
  isPublic: boolean;
  isFeatured: boolean;
  requiresApproval: boolean;
  allowOnlinePurchase: boolean;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type ProductsApiResponse = {
  ok?: boolean;
  message?: string;
  results?: unknown[];
  data?: unknown[];
  items?: unknown[];
  products?: unknown[];
};

type VisibleColumns = {
  code: boolean;
  name: boolean;
  productType: boolean;
  category: boolean;
  billingType: boolean;
  price: boolean;
  flags: boolean;
  status: boolean;
};

const SAR_ICON = "/currency/sar.svg";

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
   🔁 API Normalizers
============================================================ */

function normalizeApiList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const data = payload as ProductsApiResponse;

    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.products)) return data.products;
  }

  return [];
}

function normalizeStatus(value: unknown): ProductStatus {
  const status = String(value || "").toLowerCase();

  if (status === "draft") return "draft";
  if (status === "active") return "active";
  if (status === "inactive") return "inactive";
  if (status === "archived") return "archived";

  return "UNKNOWN";
}

function normalizeProductType(value: unknown): ProductType {
  const type = String(value || "").toLowerCase();

  if (type === "membership") return "membership";
  if (type === "card") return "card";
  if (type === "program") return "program";
  if (type === "service") return "service";
  if (type === "other") return "other";

  return "UNKNOWN";
}

function normalizeBillingType(value: unknown): BillingType {
  const type = String(value || "").toLowerCase();

  if (type === "one_time") return "one_time";
  if (type === "recurring") return "recurring";

  return "UNKNOWN";
}

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeProduct(item: unknown): Product {
  const obj = (item || {}) as Record<string, unknown>;
  const category = (obj.category || {}) as ProductCategory;

  return {
    id: String(obj.id ?? ""),
    code: String(obj.code ?? ""),
    name: String(obj.name ?? ""),
    slug: String(obj.slug ?? ""),
    productType: normalizeProductType(obj.product_type),
    categoryName: String(category?.name ?? obj.category_name ?? ""),
    status: normalizeStatus(obj.status),
    billingType: normalizeBillingType(obj.billing_type),
    shortDescription: String(obj.short_description ?? ""),
    description: String(obj.description ?? ""),
    tags: String(obj.tags ?? ""),
    price: toNumber(obj.price),
    salePrice: obj.sale_price === null || obj.sale_price === undefined ? null : toNumber(obj.sale_price),
    effectivePrice: toNumber(obj.effective_price ?? obj.sale_price ?? obj.price),
    costPrice: obj.cost_price === null || obj.cost_price === undefined ? null : toNumber(obj.cost_price),
    hasDiscount: Boolean(obj.has_discount),
    isTaxable: Boolean(obj.is_taxable),
    taxRate: toNumber(obj.tax_rate),
    durationValue: toNumber(obj.duration_value),
    durationUnit: String(obj.duration_unit ?? ""),
    isPublic: Boolean(obj.is_public),
    isFeatured: Boolean(obj.is_featured),
    requiresApproval: Boolean(obj.requires_approval),
    allowOnlinePurchase: Boolean(obj.allow_online_purchase),
    createdAt: String(obj.created_at ?? ""),
    updatedAt: String(obj.updated_at ?? ""),
    raw: obj,
  };
}

/* ============================================================
   🔤 Formatting
============================================================ */

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string, locale: AppLocale) {
  if (!value) return locale === "ar" ? "غير محدد" : "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return locale === "ar" ? "غير محدد" : "Not set";

  return new Intl.DateTimeFormat(
    locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  ).format(date);
}

function statusLabel(status: ProductStatus, locale: AppLocale) {
  const ar = locale === "ar";

  const labels: Record<ProductStatus, string> = {
    active: ar ? "نشط" : "Active",
    draft: ar ? "مسودة" : "Draft",
    inactive: ar ? "غير نشط" : "Inactive",
    archived: ar ? "مؤرشف" : "Archived",
    UNKNOWN: ar ? "غير محدد" : "Unknown",
  };

  return labels[status] || labels.UNKNOWN;
}

function statusBadgeClass(status: ProductStatus) {
  if (status === "active") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "draft") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  if (status === "inactive") {
    return "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  }

  if (status === "archived") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }

  return "border-muted bg-muted/60 text-muted-foreground";
}

function typeLabel(type: ProductType, locale: AppLocale) {
  const ar = locale === "ar";

  const labels: Record<ProductType, string> = {
    membership: ar ? "عضوية" : "Membership",
    card: ar ? "بطاقة" : "Card",
    program: ar ? "برنامج" : "Program",
    service: ar ? "خدمة" : "Service",
    other: ar ? "أخرى" : "Other",
    UNKNOWN: ar ? "غير محدد" : "Unknown",
  };

  return labels[type] || labels.UNKNOWN;
}

function billingLabel(type: BillingType, locale: AppLocale) {
  const ar = locale === "ar";

  const labels: Record<BillingType, string> = {
    one_time: ar ? "مرة واحدة" : "One Time",
    recurring: ar ? "متكرر" : "Recurring",
    UNKNOWN: ar ? "غير محدد" : "Unknown",
  };

  return labels[type] || labels.UNKNOWN;
}

/* ============================================================
   🌍 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    badge1: "System Products",
    badge2: "Products Reports",

    title: ar ? "تقارير المنتجات" : "Products Reports",
    subtitle: ar
      ? "تحليل المنتجات والبطاقات والبرامج والخدمات من حيث الحالة والنوع والفوترة والقيمة."
      : "Analyze products, cards, programs, and services by status, type, billing, and value.",

    back: ar ? "رجوع" : "Back",
    dashboard: ar ? "لوحة المنتجات" : "Products Dashboard",
    list: ar ? "قائمة المنتجات" : "Products List",
    refresh: ar ? "تحديث" : "Refresh",
    exportExcel: ar ? "تصدير Excel" : "Export Excel",
    print: ar ? "طباعة Web PDF" : "Print Web PDF",
    columns: ar ? "الأعمدة" : "Columns",

    search: ar ? "بحث" : "Search",
    searchPlaceholder: ar ? "ابحث باسم المنتج أو الكود أو التصنيف..." : "Search by product name, code, or category...",
    filters: ar ? "الفلاتر" : "Filters",
    allStatuses: ar ? "كل الحالات" : "All statuses",
    allTypes: ar ? "كل الأنواع" : "All types",
    allBilling: ar ? "كل الفوترة" : "All billing",
    allFeatured: ar ? "كل المنتجات" : "All products",
    featuredOnly: ar ? "المميزة فقط" : "Featured only",
    normalOnly: ar ? "غير المميزة" : "Normal only",

    totalProducts: ar ? "إجمالي المنتجات" : "Total Products",
    activeProducts: ar ? "المنتجات النشطة" : "Active Products",
    totalValue: ar ? "إجمالي القيمة" : "Total Value",
    featuredProducts: ar ? "منتجات مميزة" : "Featured Products",

    totalProductsDesc: ar ? "كل المنتجات المسجلة" : "All registered products",
    activeProductsDesc: ar ? "جاهزة للبيع أو التشغيل" : "Ready for sale or operation",
    totalValueDesc: ar ? "حسب السعر الفعلي" : "Based on effective price",
    featuredProductsDesc: ar ? "مميزة في العرض" : "Highlighted products",

    statusReport: ar ? "تقرير الحالات" : "Status Report",
    statusReportDesc: ar ? "توزيع المنتجات حسب الحالة." : "Distribution of products by status.",
    typeReport: ar ? "تقرير الأنواع" : "Types Report",
    typeReportDesc: ar ? "توزيع المنتجات حسب النوع." : "Distribution of products by type.",
    billingReport: ar ? "تقرير الفوترة" : "Billing Report",
    billingReportDesc: ar ? "توزيع المنتجات حسب طريقة الفوترة." : "Distribution of products by billing type.",
    valueReport: ar ? "تقرير القيمة" : "Value Report",
    valueReportDesc: ar ? "أعلى المنتجات من حيث السعر الفعلي." : "Top products by effective price.",

    detailedTable: ar ? "جدول تقارير المنتجات" : "Products Reports Table",
    detailedTableDesc: ar
      ? "قائمة تفصيلية قابلة للتصفية والتصدير والطباعة."
      : "Detailed list that supports filtering, export, and print.",

    colCode: ar ? "الكود" : "Code",
    colName: ar ? "المنتج" : "Product",
    colProductType: ar ? "النوع" : "Type",
    colCategory: ar ? "التصنيف" : "Category",
    colBillingType: ar ? "الفوترة" : "Billing",
    colPrice: ar ? "السعر" : "Price",
    colFlags: ar ? "الخيارات" : "Flags",
    colStatus: ar ? "الحالة" : "Status",

    noData: ar ? "لا توجد بيانات مطابقة" : "No matching data",
    loading: ar ? "جاري تحميل تقارير المنتجات..." : "Loading product reports...",
    loadError: ar ? "تعذر تحميل تقارير المنتجات" : "Could not load product reports",
    refreshSuccess: ar ? "تم تحديث التقارير" : "Reports refreshed",
    exportSuccess: ar ? "تم تصدير ملف Excel" : "Excel file exported",
    printTitle: ar ? "تقرير منتجات Primey Care" : "Primey Care Products Report",
    generatedAt: ar ? "تاريخ التوليد" : "Generated at",

    selected: ar ? "محدد" : "Selected",
    visibleRows: ar ? "النتائج" : "Rows",
    from: ar ? "من" : "of",

    public: ar ? "عام" : "Public",
    private: ar ? "خاص" : "Private",
    featured: ar ? "مميز" : "Featured",
    online: ar ? "شراء إلكتروني" : "Online",
    taxable: ar ? "ضريبة" : "Taxable",
    discount: ar ? "خصم" : "Discount",

    active: ar ? "نشط" : "Active",
    draft: ar ? "مسودة" : "Draft",
    inactive: ar ? "غير نشط" : "Inactive",
    archived: ar ? "مؤرشف" : "Archived",

    membership: ar ? "عضوية" : "Membership",
    card: ar ? "بطاقة" : "Card",
    program: ar ? "برنامج" : "Program",
    service: ar ? "خدمة" : "Service",
    other: ar ? "أخرى" : "Other",

    oneTime: ar ? "مرة واحدة" : "One Time",
    recurring: ar ? "متكرر" : "Recurring",

    noCategory: ar ? "بدون تصنيف" : "No Category",
  };
}

function columnLabel(key: keyof VisibleColumns, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<keyof VisibleColumns, string> = {
    code: t.colCode,
    name: t.colName,
    productType: t.colProductType,
    category: t.colCategory,
    billingType: t.colBillingType,
    price: t.colPrice,
    flags: t.colFlags,
    status: t.colStatus,
  };

  return labels[key];
}

/* ============================================================
   🧩 Main Page
============================================================ */

export default function ProductsReportsPage() {
  const printRef = useRef<HTMLDivElement | null>(null);

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [billingFilter, setBillingFilter] = useState<BillingFilter>("ALL");
  const [featuredFilter, setFeaturedFilter] = useState<FeaturedFilter>("ALL");

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    code: true,
    name: true,
    productType: true,
    category: true,
    billingType: true,
    price: true,
    flags: true,
    status: true,
  });

  const t = dictionary(locale);

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readLocale();
      setLocale(nextLocale);
      applyDocumentLocale(nextLocale);
    };

    syncLocale();

    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  async function loadProducts(showToast = false) {
    setIsLoading(true);

    try {
      const response = await fetch("/api/products/?page_size=100", {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || t.loadError);
      }

      const rows = normalizeApiList(payload).map(normalizeProduct);
      setProducts(rows);

      if (showToast) toast.success(t.refreshSuccess);
    } catch (error) {
      console.error("Load products reports error:", error);
      toast.error(error instanceof Error ? error.message : t.loadError);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProducts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredProducts = useMemo(() => {
    const searchTerm = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch = searchTerm
        ? [
            product.name,
            product.code,
            product.slug,
            product.categoryName,
            product.shortDescription,
            product.description,
            product.tags,
          ]
            .join(" ")
            .toLowerCase()
            .includes(searchTerm)
        : true;

      const matchesStatus =
        statusFilter === "ALL" ? true : product.status === statusFilter;

      const matchesType =
        typeFilter === "ALL" ? true : product.productType === typeFilter;

      const matchesBilling =
        billingFilter === "ALL" ? true : product.billingType === billingFilter;

      const matchesFeatured =
        featuredFilter === "ALL"
          ? true
          : featuredFilter === "FEATURED"
            ? product.isFeatured
            : !product.isFeatured;

      return matchesSearch && matchesStatus && matchesType && matchesBilling && matchesFeatured;
    });
  }, [products, query, statusFilter, typeFilter, billingFilter, featuredFilter]);

  const sortedProducts = useMemo(() => {
    const rows = [...filteredProducts];

    rows.sort((a, b) => {
      let first: string | number = "";
      let second: string | number = "";

      if (sortKey === "name") {
        first = a.name.toLowerCase();
        second = b.name.toLowerCase();
      }

      if (sortKey === "code") {
        first = a.code.toLowerCase();
        second = b.code.toLowerCase();
      }

      if (sortKey === "productType") {
        first = a.productType;
        second = b.productType;
      }

      if (sortKey === "status") {
        first = a.status;
        second = b.status;
      }

      if (sortKey === "billingType") {
        first = a.billingType;
        second = b.billingType;
      }

      if (sortKey === "price") {
        first = a.effectivePrice;
        second = b.effectivePrice;
      }

      if (first < second) return sortDirection === "asc" ? -1 : 1;
      if (first > second) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }, [filteredProducts, sortDirection, sortKey]);

  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter((item) => item.status === "active").length;
    const featured = products.filter((item) => item.isFeatured).length;
    const totalValue = products.reduce((sum, item) => sum + item.effectivePrice, 0);

    return {
      total,
      active,
      featured,
      totalValue,
    };
  }, [products]);

  const statusReport = useMemo(() => {
    const statuses: ProductStatus[] = ["active", "draft", "inactive", "archived"];

    return statuses.map((status) => ({
      key: status,
      label: statusLabel(status, locale),
      count: products.filter((item) => item.status === status).length,
    }));
  }, [locale, products]);

  const typeReport = useMemo(() => {
    const types: ProductType[] = ["membership", "card", "program", "service", "other"];

    return types.map((type) => ({
      key: type,
      label: typeLabel(type, locale),
      count: products.filter((item) => item.productType === type).length,
    }));
  }, [locale, products]);

  const billingReport = useMemo(() => {
    const billings: BillingType[] = ["one_time", "recurring"];

    return billings.map((billing) => ({
      key: billing,
      label: billingLabel(billing, locale),
      count: products.filter((item) => item.billingType === billing).length,
    }));
  }, [locale, products]);

  const topValueProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => b.effectivePrice - a.effectivePrice)
      .slice(0, 5);
  }, [products]);

  const selectedCount = selectedIds.size;
  const allSelected =
    sortedProducts.length > 0 &&
    sortedProducts.every((product) => selectedIds.has(String(product.id)));

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function toggleSelected(id: string) {
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

  function toggleAllSelected() {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (allSelected) {
        sortedProducts.forEach((product) => next.delete(String(product.id)));
      } else {
        sortedProducts.forEach((product) => next.add(String(product.id)));
      }

      return next;
    });
  }

  function buildExcelRows() {
    return sortedProducts.map((product, index) => ({
      "#": index + 1,
      [t.colCode]: product.code || "-",
      [t.colName]: product.name || "-",
      [t.colProductType]: typeLabel(product.productType, locale),
      [t.colCategory]: product.categoryName || t.noCategory,
      [t.colBillingType]: billingLabel(product.billingType, locale),
      [t.colPrice]: formatMoney(product.effectivePrice),
      [t.colStatus]: statusLabel(product.status, locale),
      [t.featured]: product.isFeatured ? t.featured : "-",
      [t.public]: product.isPublic ? t.public : t.private,
      [t.online]: product.allowOnlinePurchase ? t.online : "-",
      [t.taxable]: product.isTaxable ? t.taxable : "-",
      [t.discount]: product.hasDiscount ? t.discount : "-",
      [t.generatedAt]: formatDate(product.updatedAt || product.createdAt, locale),
    }));
  }

  function exportExcel() {
    const rows = buildExcelRows();

    const summaryRows = [
      [t.printTitle],
      [t.generatedAt, formatDate(new Date().toISOString(), locale)],
      [t.totalProducts, formatNumber(stats.total)],
      [t.activeProducts, formatNumber(stats.active)],
      [t.featuredProducts, formatNumber(stats.featured)],
      [t.totalValue, formatMoney(stats.totalValue)],
      [],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.sheet_add_json(worksheet, rows, {
      origin: -1,
      skipHeader: false,
    });

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 34 },
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      locale === "ar" ? "تقارير المنتجات" : "Products Reports"
    );

    XLSX.writeFile(workbook, "primey-care-products-reports.xlsx");
    toast.success(t.exportSuccess);
  }

  function printReport() {
    const content = printRef.current?.innerHTML;
    if (!content) return;

    const popup = window.open("", "_blank", "width=1200,height=800");
    if (!popup) return;

    const dir = locale === "ar" ? "rtl" : "ltr";
    const lang = locale === "ar" ? "ar" : "en";

    popup.document.write(`
      <!doctype html>
      <html lang="${lang}" dir="${dir}">
        <head>
          <meta charset="utf-8" />
          <title>${t.printTitle}</title>
          <style>
            * { box-sizing: border-box; }
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
            .badge {
              display: inline-flex;
              align-items: center;
              border: 1px solid #d1d5db;
              border-radius: 999px;
              padding: 3px 8px;
              font-size: 11px;
              background: #ffffff;
              margin: 2px;
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

    popup.document.close();
  }

  const statCards = [
    {
      title: t.totalProducts,
      value: formatNumber(stats.total),
      desc: t.totalProductsDesc,
      icon: Package,
      money: false,
    },
    {
      title: t.activeProducts,
      value: formatNumber(stats.active),
      desc: t.activeProductsDesc,
      icon: BadgeCheck,
      money: false,
    },
    {
      title: t.totalValue,
      value: formatMoney(stats.totalValue),
      desc: t.totalValueDesc,
      icon: CreditCard,
      money: true,
    },
    {
      title: t.featuredProducts,
      value: formatNumber(stats.featured),
      desc: t.featuredProductsDesc,
      icon: Star,
      money: false,
    },
  ];

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: "ALL", label: t.allStatuses },
    { value: "active", label: t.active },
    { value: "draft", label: t.draft },
    { value: "inactive", label: t.inactive },
    { value: "archived", label: t.archived },
  ];

  const typeOptions: Array<{ value: TypeFilter; label: string }> = [
    { value: "ALL", label: t.allTypes },
    { value: "membership", label: t.membership },
    { value: "card", label: t.card },
    { value: "program", label: t.program },
    { value: "service", label: t.service },
    { value: "other", label: t.other },
  ];

  const billingOptions: Array<{ value: BillingFilter; label: string }> = [
    { value: "ALL", label: t.allBilling },
    { value: "one_time", label: t.oneTime },
    { value: "recurring", label: t.recurring },
  ];

  const featuredOptions: Array<{ value: FeaturedFilter; label: string }> = [
    { value: "ALL", label: t.allFeatured },
    { value: "FEATURED", label: t.featuredOnly },
    { value: "NORMAL", label: t.normalOnly },
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

              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="/system/products/list">
                  <Layers3 className="h-4 w-4" />
                  {t.list}
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
                className="rounded-2xl"
                onClick={printReport}
              >
                <Printer className="h-4 w-4" />
                {t.print}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card
              key={card.title}
              className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
            >
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{card.value}</p>
                    {card.money ? (
                      <Image
                        src={SAR_ICON}
                        alt="SAR"
                        width={18}
                        height={18}
                        className="opacity-80"
                      />
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{card.desc}</p>
                </div>

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-4">
        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {t.statusReport}
            </CardTitle>
            <CardDescription>{t.statusReportDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusReport.map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-2xl bg-muted/40 p-3">
                <Badge className={`rounded-full border ${statusBadgeClass(item.key)}`}>
                  {item.label}
                </Badge>
                <span className="font-bold">{formatNumber(item.count)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              {t.typeReport}
            </CardTitle>
            <CardDescription>{t.typeReportDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {typeReport.map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-2xl bg-muted/40 p-3">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="font-bold">{formatNumber(item.count)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletCards className="h-5 w-5 text-primary" />
              {t.billingReport}
            </CardTitle>
            <CardDescription>{t.billingReportDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {billingReport.map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-2xl bg-muted/40 p-3">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="font-bold">{formatNumber(item.count)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t.valueReport}
            </CardTitle>
            <CardDescription>{t.valueReportDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topValueProducts.map((product) => (
              <div key={product.id} className="rounded-2xl bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold">{product.name || "-"}</p>
                  <div className="flex items-center gap-1 font-bold">
                    <span>{formatMoney(product.effectivePrice)}</span>
                    <Image src={SAR_ICON} alt="SAR" width={14} height={14} />
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {typeLabel(product.productType, locale)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {t.detailedTable}
              </CardTitle>
              <CardDescription>{t.detailedTableDesc}</CardDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-2xl">
                    <ColumnsIcon className="h-4 w-4" />
                    {t.columns}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {(Object.keys(visibleColumns) as Array<keyof VisibleColumns>).map((key) => (
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
                      {columnLabel(key, locale)}
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
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.searchPlaceholder}
                className="rounded-2xl bg-background/70 ltr:pl-9 rtl:pr-9"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-2xl">
                  <FilterIcon className="h-4 w-4" />
                  {statusOptions.find((item) => item.value === statusFilter)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {statusOptions.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.value}
                    checked={statusFilter === item.value}
                    onCheckedChange={() => setStatusFilter(item.value)}
                  >
                    {item.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-2xl">
                  <Tag className="h-4 w-4" />
                  {typeOptions.find((item) => item.value === typeFilter)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {typeOptions.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.value}
                    checked={typeFilter === item.value}
                    onCheckedChange={() => setTypeFilter(item.value)}
                  >
                    {item.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-2xl">
                  <ArrowDownUp className="h-4 w-4" />
                  {billingOptions.find((item) => item.value === billingFilter)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {billingOptions.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.value}
                    checked={billingFilter === item.value}
                    onCheckedChange={() => setBillingFilter(item.value)}
                  >
                    {item.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-2xl">
                  <Star className="h-4 w-4" />
                  {featuredOptions.find((item) => item.value === featuredFilter)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {featuredOptions.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.value}
                    checked={featuredFilter === item.value}
                    onCheckedChange={() => setFeaturedFilter(item.value)}
                  >
                    {item.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary" className="rounded-full">
              {t.visibleRows}: {formatNumber(sortedProducts.length)} {t.from} {formatNumber(products.length)}
            </Badge>

            {selectedCount ? (
              <Badge className="rounded-full">
                {formatNumber(selectedCount)} {t.selected}
              </Badge>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-hidden rounded-3xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[48px]">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAllSelected} />
                  </TableHead>

                  {visibleColumns.code ? (
                    <TableHead>
                      <button className="inline-flex items-center gap-1" onClick={() => toggleSort("code")}>
                        {t.colCode}
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                  ) : null}

                  {visibleColumns.name ? (
                    <TableHead>
                      <button className="inline-flex items-center gap-1" onClick={() => toggleSort("name")}>
                        {t.colName}
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                  ) : null}

                  {visibleColumns.productType ? (
                    <TableHead>
                      <button className="inline-flex items-center gap-1" onClick={() => toggleSort("productType")}>
                        {t.colProductType}
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                  ) : null}

                  {visibleColumns.category ? <TableHead>{t.colCategory}</TableHead> : null}

                  {visibleColumns.billingType ? (
                    <TableHead>
                      <button className="inline-flex items-center gap-1" onClick={() => toggleSort("billingType")}>
                        {t.colBillingType}
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                  ) : null}

                  {visibleColumns.price ? (
                    <TableHead>
                      <button className="inline-flex items-center gap-1" onClick={() => toggleSort("price")}>
                        {t.colPrice}
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                  ) : null}

                  {visibleColumns.flags ? <TableHead>{t.colFlags}</TableHead> : null}

                  {visibleColumns.status ? (
                    <TableHead>
                      <button className="inline-flex items-center gap-1" onClick={() => toggleSort("status")}>
                        {t.colStatus}
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.loading}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : sortedProducts.length ? (
                  sortedProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(String(product.id))}
                          onCheckedChange={() => toggleSelected(String(product.id))}
                        />
                      </TableCell>

                      {visibleColumns.code ? (
                        <TableCell className="font-medium">{product.code || "-"}</TableCell>
                      ) : null}

                      {visibleColumns.name ? (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                              <Package className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-semibold">{product.name || "-"}</p>
                              <p className="text-xs text-muted-foreground">
                                {product.shortDescription || product.slug || "-"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      ) : null}

                      {visibleColumns.productType ? (
                        <TableCell>
                          <Badge variant="secondary" className="rounded-full">
                            {typeLabel(product.productType, locale)}
                          </Badge>
                        </TableCell>
                      ) : null}

                      {visibleColumns.category ? (
                        <TableCell className="text-muted-foreground">
                          {product.categoryName || t.noCategory}
                        </TableCell>
                      ) : null}

                      {visibleColumns.billingType ? (
                        <TableCell>{billingLabel(product.billingType, locale)}</TableCell>
                      ) : null}

                      {visibleColumns.price ? (
                        <TableCell>
                          <div className="flex items-center gap-1 font-semibold">
                            <span>{formatMoney(product.effectivePrice)}</span>
                            <Image src={SAR_ICON} alt="SAR" width={14} height={14} />
                          </div>
                        </TableCell>
                      ) : null}

                      {visibleColumns.flags ? (
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {product.isFeatured ? (
                              <Badge className="rounded-full">{t.featured}</Badge>
                            ) : null}
                            {product.isPublic ? (
                              <Badge variant="outline" className="rounded-full">{t.public}</Badge>
                            ) : null}
                            {product.allowOnlinePurchase ? (
                              <Badge variant="secondary" className="rounded-full">{t.online}</Badge>
                            ) : null}
                            {product.hasDiscount ? (
                              <Badge variant="outline" className="rounded-full">{t.discount}</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                      ) : null}

                      {visibleColumns.status ? (
                        <TableCell>
                          <Badge className={`rounded-full border ${statusBadgeClass(product.status)}`}>
                            {statusLabel(product.status, locale)}
                          </Badge>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-sm text-muted-foreground">
                      {t.noData}
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
              <div className="print-card-label">{t.totalProducts}</div>
              <div className="print-card-value">{formatNumber(stats.total)}</div>
            </div>
            <div className="print-card">
              <div className="print-card-label">{t.activeProducts}</div>
              <div className="print-card-value">{formatNumber(stats.active)}</div>
            </div>
            <div className="print-card">
              <div className="print-card-label">{t.featuredProducts}</div>
              <div className="print-card-value">{formatNumber(stats.featured)}</div>
            </div>
            <div className="print-card">
              <div className="print-card-label">{t.totalValue}</div>
              <div className="print-card-value">{formatMoney(stats.totalValue)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{t.colCode}</th>
                <th>{t.colName}</th>
                <th>{t.colProductType}</th>
                <th>{t.colCategory}</th>
                <th>{t.colBillingType}</th>
                <th>{t.colPrice}</th>
                <th>{t.colStatus}</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((product, index) => (
                <tr key={product.id}>
                  <td>{formatNumber(index + 1)}</td>
                  <td>{product.code || "-"}</td>
                  <td>{product.name || "-"}</td>
                  <td>{typeLabel(product.productType, locale)}</td>
                  <td>{product.categoryName || t.noCategory}</td>
                  <td>{billingLabel(product.billingType, locale)}</td>
                  <td>{formatMoney(product.effectivePrice)}</td>
                  <td>
                    <span className="badge">{statusLabel(product.status, locale)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}