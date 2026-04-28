"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Boxes,
  CreditCard,
  Download,
  FileSpreadsheet,
  Layers3,
  Loader2,
  Package,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
  Stethoscope,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

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
   📂 app/system/products/reports/page.tsx
   🧠 Primey Care | Products & Programs Reports
   ------------------------------------------------------------
   ✅ ربط حقيقي مع /api/products/
   ✅ متوافق مع Backend المرحلة 5
   ✅ تقارير المنتجات / البطاقات / البرامج / الخدمات
   ✅ تحليل الحالات والأنواع والجاهزية للعقود والطلبات
   ✅ Excel Export للقسم فقط
   ✅ Web PDF Print للقسم فقط
   ✅ Arabic / English via primey-locale
   ✅ English numbers always
   ✅ SAR icon from /currency/sar.svg
   ✅ sonner toast
   ✅ no localhost hardcoded
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

type ProductCategory = {
  id: number | string;
  code?: string | null;
  name?: string | null;
  category_type?: string | null;
};

type ProductBenefit = {
  id: number | string;
  title?: string | null;
  is_active?: boolean | null;
};

type ProductPricingTier = {
  id: number | string;
  name?: string | null;
  pricing_type?: string | null;
  price?: string | number | null;
  sale_price?: string | number | null;
  effective_price?: string | number | null;
  is_active?: boolean | null;
};

type ProductServiceItem = {
  id: number | string;
  name?: string | null;
  unit_price?: string | number | null;
  total_after_discount?: string | number | null;
  is_active?: boolean | null;
};

type Product = {
  id: number | string;
  code?: string | null;
  name?: string | null;
  slug?: string | null;
  product_type?: ProductType | string | null;
  category?: ProductCategory | null;
  status?: ProductStatus | string | null;
  billing_type?: BillingType | string | null;
  fulfillment_type?: string | null;
  price?: string | number | null;
  sale_price?: string | number | null;
  effective_price?: string | number | null;
  cost_price?: string | number | null;
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
  benefits?: ProductBenefit[];
  pricing_tiers?: ProductPricingTier[];
  service_items?: ProductServiceItem[];
  created_at?: string | null;
  updated_at?: string | null;
};

type ProductsApiResponse = {
  ok?: boolean;
  message?: string;
  results?: Product[];
  data?: Product[] | Product;
};

const SAR_ICON_PATH = "/currency/sar.svg";

function readStoredLocale(): AppLocale {
  if (typeof window === "undefined") return "ar";

  const saved = window.localStorage.getItem("primey-locale");
  if (saved === "en" || saved === "ar") return saved;

  return document.documentElement.lang === "en" ? "en" : "ar";
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

function formatPercent(value: string | number | null | undefined) {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(toNumber(value))}%`;
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

function extractProducts(payload: ProductsApiResponse): Product[] {
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function getStatusLabel(status: ProductStatus, locale: AppLocale) {
  const isArabic = locale === "ar";

  const map: Record<ProductStatus, string> = {
    active: isArabic ? "نشط" : "Active",
    draft: isArabic ? "مسودة" : "Draft",
    inactive: isArabic ? "غير نشط" : "Inactive",
    archived: isArabic ? "مؤرشف" : "Archived",
    UNKNOWN: isArabic ? "غير محدد" : "Unknown",
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

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    badge1: "System Products",
    badge2: "Products Reports",

    title: isArabic ? "تقارير المنتجات والباقات" : "Products & Programs Reports",
    subtitle: isArabic
      ? "تحليل المنتجات والبطاقات والبرامج والخدمات حسب الحالة والنوع والتسعير والجاهزية للطلبات والعقود."
      : "Analyze products, cards, programs, and services by status, type, pricing, and readiness for orders and contracts.",

    dashboard: isArabic ? "لوحة المنتجات" : "Products Dashboard",
    list: isArabic ? "قائمة المنتجات" : "Products List",
    create: isArabic ? "إنشاء منتج" : "Create Product",
    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة Web PDF" : "Print Web PDF",

    searchPlaceholder: isArabic
      ? "ابحث باسم المنتج أو الكود أو التصنيف..."
      : "Search by product name, code, or category...",

    totalProducts: isArabic ? "إجمالي المنتجات" : "Total Products",
    activeProducts: isArabic ? "منتجات نشطة" : "Active Products",
    totalValue: isArabic ? "القيمة الفعلية" : "Effective Value",
    taxValue: isArabic ? "قيمة الضريبة" : "Tax Value",

    cards: isArabic ? "البطاقات" : "Cards",
    programs: isArabic ? "البرامج" : "Programs",
    services: isArabic ? "الخدمات" : "Services",
    memberships: isArabic ? "العضويات" : "Memberships",

    orderable: isArabic ? "قابلة للطلب" : "Orderable",
    contractReady: isArabic ? "جاهزة للعقود" : "Contract Ready",
    requiresProvider: isArabic ? "تتطلب مقدم خدمة" : "Requires Provider",
    featured: isArabic ? "مميزة" : "Featured",

    statusReport: isArabic ? "تقرير الحالات" : "Status Report",
    statusReportDesc: isArabic
      ? "توزيع المنتجات حسب الحالة التشغيلية."
      : "Products distribution by operational status.",

    typeReport: isArabic ? "تقرير الأنواع" : "Type Report",
    typeReportDesc: isArabic
      ? "توزيع المنتجات حسب النوع."
      : "Products distribution by type.",

    readinessReport: isArabic ? "تقرير الجاهزية" : "Readiness Report",
    readinessReportDesc: isArabic
      ? "جاهزية المنتجات للطلبات والعقود ومقدمي الخدمة."
      : "Readiness for orders, contracts, and providers.",

    topValueProducts: isArabic ? "أعلى المنتجات قيمة" : "Top Value Products",
    topValueProductsDesc: isArabic
      ? "أعلى المنتجات حسب السعر الفعلي."
      : "Top products by effective price.",

    detailedReport: isArabic ? "التقرير التفصيلي" : "Detailed Report",
    detailedReportDesc: isArabic
      ? "قائمة تفصيلية للمنتجات الحالية."
      : "Detailed list of current products.",

    product: isArabic ? "المنتج" : "Product",
    type: isArabic ? "النوع" : "Type",
    category: isArabic ? "التصنيف" : "Category",
    price: isArabic ? "السعر" : "Price",
    billing: isArabic ? "الفوترة" : "Billing",
    status: isArabic ? "الحالة" : "Status",
    readiness: isArabic ? "الجاهزية" : "Readiness",
    updated: isArabic ? "آخر تحديث" : "Updated",

    public: isArabic ? "عام" : "Public",
    private: isArabic ? "خاص" : "Private",
    online: isArabic ? "شراء إلكتروني" : "Online",
    taxable: isArabic ? "ضريبة" : "Tax",
    discount: isArabic ? "خصم" : "Discount",
    noCategory: isArabic ? "بدون تصنيف" : "No category",
    noProducts: isArabic ? "لا توجد منتجات مطابقة" : "No matching products",
    unnamedProduct: isArabic ? "منتج بدون اسم" : "Unnamed product",

    generatedAt: isArabic ? "تاريخ التوليد" : "Generated at",
    reportTitle: isArabic
      ? "تقرير منتجات Primey Care"
      : "Primey Care Products Report",

    loading: isArabic ? "جاري تحميل التقرير..." : "Loading report...",
    loadError: isArabic ? "تعذر تحميل تقرير المنتجات" : "Could not load products report",
    refreshSuccess: isArabic ? "تم تحديث التقرير" : "Report refreshed",
    exportSuccess: isArabic ? "تم تصدير التقرير" : "Report exported",
    exportError: isArabic ? "تعذر تصدير التقرير" : "Could not export report",
  };
}

function MoneyValue({ value }: { value: string | number | null | undefined }) {
  return (
    <div className="flex items-center gap-1 font-semibold">
      <span>{formatMoney(value)}</span>
      <Image
        src={SAR_ICON_PATH}
        alt="SAR"
        width={15}
        height={15}
        className="opacity-80"
      />
    </div>
  );
}

function ProgressRow({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const percent = total ? Math.round((count / total) * 100) : 0;

  return (
    <div className="rounded-3xl border bg-background/50 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm text-muted-foreground">
          {formatNumber(count)} / {formatNumber(total)}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default function SystemProductsReportsPage() {
  const printRef = useRef<HTMLDivElement | null>(null);

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
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
          "/api/products/?page_size=500&include_children=true",
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
        console.error("Failed to load products report:", error);
        toast.error(error instanceof Error ? error.message : t.loadError);
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

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return products;

    return products.filter((product) => {
      const values = [
        product.name,
        product.code,
        product.slug,
        product.category?.name,
        product.category?.code,
        product.product_type,
        product.status,
        product.billing_type,
      ];

      return values.some((value) =>
        String(value || "").toLowerCase().includes(term)
      );
    });
  }, [products, search]);

  const stats = useMemo(() => {
    const total = filteredProducts.length;

    const active = filteredProducts.filter(
      (product) => normalizeStatus(product.status) === "active"
    ).length;

    const cards = filteredProducts.filter(
      (product) => normalizeType(product.product_type) === "card"
    ).length;

    const programs = filteredProducts.filter(
      (product) => normalizeType(product.product_type) === "program"
    ).length;

    const services = filteredProducts.filter(
      (product) => normalizeType(product.product_type) === "service"
    ).length;

    const memberships = filteredProducts.filter(
      (product) => normalizeType(product.product_type) === "membership"
    ).length;

    const featured = filteredProducts.filter((product) =>
      Boolean(product.is_featured)
    ).length;

    const orderable = filteredProducts.filter((product) =>
      Boolean(product.can_be_ordered)
    ).length;

    const contractReady = filteredProducts.filter((product) =>
      Boolean(product.can_be_used_in_contracts)
    ).length;

    const requiresProvider = filteredProducts.filter((product) =>
      Boolean(product.requires_provider)
    ).length;

    const totalValue = filteredProducts.reduce(
      (sum, product) => sum + toNumber(product.effective_price || product.price),
      0
    );

    const taxValue = filteredProducts.reduce(
      (sum, product) => sum + toNumber(product.tax_amount),
      0
    );

    const benefitsCount = filteredProducts.reduce(
      (sum, product) => sum + (product.benefits?.length || 0),
      0
    );

    const pricingTiersCount = filteredProducts.reduce(
      (sum, product) => sum + (product.pricing_tiers?.length || 0),
      0
    );

    const serviceItemsCount = filteredProducts.reduce(
      (sum, product) => sum + (product.service_items?.length || 0),
      0
    );

    return {
      total,
      active,
      cards,
      programs,
      services,
      memberships,
      featured,
      orderable,
      contractReady,
      requiresProvider,
      totalValue,
      taxValue,
      benefitsCount,
      pricingTiersCount,
      serviceItemsCount,
    };
  }, [filteredProducts]);

  const statusRows = useMemo(() => {
    const statuses: ProductStatus[] = [
      "active",
      "draft",
      "inactive",
      "archived",
    ];

    return statuses.map((status) => ({
      key: status,
      label: getStatusLabel(status, locale),
      count: filteredProducts.filter(
        (product) => normalizeStatus(product.status) === status
      ).length,
    }));
  }, [filteredProducts, locale]);

  const typeRows = useMemo(() => {
    const types: ProductType[] = [
      "card",
      "program",
      "service",
      "membership",
      "other",
    ];

    return types.map((type) => ({
      key: type,
      label: getTypeLabel(type, locale),
      count: filteredProducts.filter(
        (product) => normalizeType(product.product_type) === type
      ).length,
    }));
  }, [filteredProducts, locale]);

  const topProducts = useMemo(() => {
    return [...filteredProducts]
      .sort(
        (a, b) =>
          toNumber(b.effective_price || b.price) -
          toNumber(a.effective_price || a.price)
      )
      .slice(0, 8);
  }, [filteredProducts]);

  async function exportExcel() {
    try {
      const XLSX = await import("xlsx");

      const summaryRows = [
        [t.reportTitle],
        [t.generatedAt, formatDate(new Date().toISOString(), locale)],
        [t.totalProducts, formatNumber(stats.total)],
        [t.activeProducts, formatNumber(stats.active)],
        [t.totalValue, formatMoney(stats.totalValue)],
        [t.taxValue, formatMoney(stats.taxValue)],
        [],
      ];

      const rows = filteredProducts.map((product, index) => {
        const type = normalizeType(product.product_type);
        const status = normalizeStatus(product.status);
        const billing = normalizeBillingType(product.billing_type);

        return {
          "#": index + 1,
          [t.product]: product.name || t.unnamedProduct,
          Code: product.code || "-",
          [t.type]: getTypeLabel(type, locale),
          [t.category]: product.category?.name || t.noCategory,
          [t.billing]: getBillingLabel(billing, locale),
          [t.price]: formatMoney(product.effective_price || product.price),
          [t.status]: getStatusLabel(status, locale),
          [t.orderable]: product.can_be_ordered ? "Yes" : "No",
          [t.contractReady]: product.can_be_used_in_contracts ? "Yes" : "No",
          [t.requiresProvider]: product.requires_provider ? "Yes" : "No",
          [t.featured]: product.is_featured ? "Yes" : "No",
          [t.taxable]: product.is_taxable ? "Yes" : "No",
          [t.updated]: formatDate(product.updated_at || product.created_at, locale),
        };
      });

      const worksheet = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.sheet_add_json(worksheet, rows, {
        origin: -1,
        skipHeader: false,
      });

      worksheet["!cols"] = [
        { wch: 8 },
        { wch: 32 },
        { wch: 18 },
        { wch: 18 },
        { wch: 24 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        locale === "ar" ? "تقرير المنتجات" : "Products Report"
      );

      XLSX.writeFile(workbook, "primey-care-products-report.xlsx");
      toast.success(t.exportSuccess);
    } catch (error) {
      console.error("Failed to export products report:", error);
      toast.error(t.exportError);
    }
  }

  function printReport() {
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
          <title>${t.reportTitle}</title>
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
              margin-bottom: 20px;
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
            .print-grid {
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
            @media print {
              body { padding: 16px; }
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

  const topCards = [
    {
      label: t.totalProducts,
      value: formatNumber(stats.total),
      icon: Package,
      money: false,
    },
    {
      label: t.activeProducts,
      value: formatNumber(stats.active),
      icon: BadgeCheck,
      money: false,
    },
    {
      label: t.totalValue,
      value: formatMoney(stats.totalValue),
      icon: CreditCard,
      money: true,
    },
    {
      label: t.taxValue,
      value: formatMoney(stats.taxValue),
      icon: FileSpreadsheet,
      money: true,
    },
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

              <Button asChild className="rounded-2xl">
                <Link href="/system/products/create">
                  <Package className="h-4 w-4" />
                  {t.create}
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
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {topCards.map((item) => {
          const Icon = item.icon;

          return (
            <Card
              key={item.label}
              className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
            >
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="text-2xl font-bold">{item.value}</p>
                    {item.money ? (
                      <Image
                        src={SAR_ICON_PATH}
                        alt="SAR"
                        width={18}
                        height={18}
                        className="opacity-80"
                      />
                    ) : null}
                  </div>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.orderable}</p>
            <p className="mt-2 text-2xl font-bold">
              {formatNumber(stats.orderable)}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.contractReady}</p>
            <p className="mt-2 text-2xl font-bold">
              {formatNumber(stats.contractReady)}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.requiresProvider}</p>
            <p className="mt-2 text-2xl font-bold">
              {formatNumber(stats.requiresProvider)}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.featured}</p>
            <p className="mt-2 text-2xl font-bold">
              {formatNumber(stats.featured)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t.statusReport}
            </CardTitle>
            <CardDescription>{t.statusReportDesc}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {statusRows.map((row) => (
              <ProgressRow
                key={row.key}
                label={row.label}
                count={row.count}
                total={stats.total}
              />
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
            {typeRows.map((row) => (
              <ProgressRow
                key={row.key}
                label={row.label}
                count={row.count}
                total={stats.total}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {t.readinessReport}
            </CardTitle>
            <CardDescription>{t.readinessReportDesc}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <ProgressRow
              label={t.orderable}
              count={stats.orderable}
              total={stats.total}
            />
            <ProgressRow
              label={t.contractReady}
              count={stats.contractReady}
              total={stats.total}
            />
            <ProgressRow
              label={t.requiresProvider}
              count={stats.requiresProvider}
              total={stats.total}
            />
            <ProgressRow
              label={t.featured}
              count={stats.featured}
              total={stats.total}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              {t.topValueProducts}
            </CardTitle>
            <CardDescription>{t.topValueProductsDesc}</CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-hidden rounded-3xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{t.product}</TableHead>
                  <TableHead>{t.type}</TableHead>
                  <TableHead>{t.category}</TableHead>
                  <TableHead>{t.price}</TableHead>
                  <TableHead>{t.status}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-28 text-center">
                      <div className="flex items-center justify-center text-sm text-muted-foreground">
                        <Loader2 className="mx-2 h-4 w-4 animate-spin" />
                        {t.loading}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : topProducts.length ? (
                  topProducts.map((product) => {
                    const type = normalizeType(product.product_type);
                    const status = normalizeStatus(product.status);

                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <p className="font-semibold">
                              {product.name || t.unnamedProduct}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {product.code || "-"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>{getTypeLabel(type, locale)}</TableCell>

                        <TableCell className="text-muted-foreground">
                          {product.category?.name || t.noCategory}
                        </TableCell>

                        <TableCell>
                          <MoneyValue value={product.effective_price || product.price} />
                        </TableCell>

                        <TableCell>{getStatusLabel(status, locale)}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-28 text-center text-sm text-muted-foreground"
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

      <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                {t.detailedReport}
              </CardTitle>
              <CardDescription>{t.detailedReportDesc}</CardDescription>
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
                onClick={printReport}
              >
                <Printer className="h-4 w-4" />
                {t.print}
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t.searchPlaceholder}
              className="rounded-2xl bg-background/70 ltr:pl-9 rtl:pr-9"
            />
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-hidden rounded-3xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{t.product}</TableHead>
                  <TableHead>{t.type}</TableHead>
                  <TableHead>{t.category}</TableHead>
                  <TableHead>{t.price}</TableHead>
                  <TableHead>{t.billing}</TableHead>
                  <TableHead>{t.readiness}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead>{t.updated}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex items-center justify-center text-sm text-muted-foreground">
                        <Loader2 className="mx-2 h-4 w-4 animate-spin" />
                        {t.loading}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length ? (
                  filteredProducts.map((product) => {
                    const type = normalizeType(product.product_type);
                    const status = normalizeStatus(product.status);
                    const billing = normalizeBillingType(product.billing_type);

                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <p className="font-semibold">
                              {product.name || t.unnamedProduct}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {product.code || "-"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>{getTypeLabel(type, locale)}</TableCell>

                        <TableCell className="text-muted-foreground">
                          {product.category?.name || t.noCategory}
                        </TableCell>

                        <TableCell>
                          <MoneyValue value={product.effective_price || product.price} />
                        </TableCell>

                        <TableCell>{getBillingLabel(billing, locale)}</TableCell>

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

                            {product.is_featured ? (
                              <Badge className="rounded-full">
                                <Star className="h-3 w-3" />
                                {t.featured}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>

                        <TableCell>{getStatusLabel(status, locale)}</TableCell>

                        <TableCell className="text-muted-foreground">
                          {formatDate(product.updated_at || product.created_at, locale)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={8}
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
              <h1 className="print-title">{t.reportTitle}</h1>
              <p className="print-meta">
                {t.generatedAt}: {formatDate(new Date().toISOString(), locale)}
              </p>
            </div>
          </div>

          <div className="print-grid">
            <div className="print-card">
              <div className="print-card-label">{t.totalProducts}</div>
              <div className="print-card-value">{formatNumber(stats.total)}</div>
            </div>

            <div className="print-card">
              <div className="print-card-label">{t.activeProducts}</div>
              <div className="print-card-value">{formatNumber(stats.active)}</div>
            </div>

            <div className="print-card">
              <div className="print-card-label">{t.totalValue}</div>
              <div className="print-card-value">{formatMoney(stats.totalValue)}</div>
            </div>

            <div className="print-card">
              <div className="print-card-label">{t.taxValue}</div>
              <div className="print-card-value">{formatMoney(stats.taxValue)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{t.product}</th>
                <th>{t.type}</th>
                <th>{t.category}</th>
                <th>{t.price}</th>
                <th>{t.billing}</th>
                <th>{t.status}</th>
                <th>{t.updated}</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map((product, index) => {
                const type = normalizeType(product.product_type);
                const status = normalizeStatus(product.status);
                const billing = normalizeBillingType(product.billing_type);

                return (
                  <tr key={product.id}>
                    <td>{formatNumber(index + 1)}</td>
                    <td>
                      <strong>{product.name || t.unnamedProduct}</strong>
                      <div>{product.code || "-"}</div>
                    </td>
                    <td>{getTypeLabel(type, locale)}</td>
                    <td>{product.category?.name || t.noCategory}</td>
                    <td>{formatMoney(product.effective_price || product.price)}</td>
                    <td>{getBillingLabel(billing, locale)}</td>
                    <td>{getStatusLabel(status, locale)}</td>
                    <td>{formatDate(product.updated_at || product.created_at, locale)}</td>
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