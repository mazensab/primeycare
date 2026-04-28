"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Boxes,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Layers3,
  Loader2,
  Package,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Tag,
  Trash2,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ============================================================
   📂 app/system/products/[id]/page.tsx
   🧠 Primey Care | Product Details
   ------------------------------------------------------------
   ✅ ربط حقيقي مع /api/products/<id>/
   ✅ متوافق مع Backend المرحلة 5
   ✅ عرض:
      - Product core
      - Pricing
      - Benefits
      - Pricing tiers
      - Service items
      - Readiness for orders/contracts
   ✅ Delete product
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

type FulfillmentType =
  | "digital"
  | "physical"
  | "both"
  | "service_based"
  | "none"
  | "UNKNOWN";

type ProductCategory = {
  id: number | string;
  code?: string | null;
  name?: string | null;
  category_type?: string | null;
  status?: string | null;
  description?: string | null;
};

type ProductBenefit = {
  id: number | string;
  product_id?: number | string | null;
  title?: string | null;
  description?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

type ProductPricingTier = {
  id: number | string;
  product_id?: number | string | null;
  name?: string | null;
  pricing_type?: string | null;
  currency_code?: string | null;
  price?: string | number | null;
  sale_price?: string | number | null;
  effective_price?: string | number | null;
  has_discount?: boolean | null;
  min_quantity?: number | null;
  max_quantity?: number | null;
  discount_rate?: string | number | null;
  agent_commission_rate?: string | number | null;
  provider_share_rate?: string | number | null;
  system_share_rate?: string | number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

type ProductServiceItem = {
  id: number | string;
  product_id?: number | string | null;
  name?: string | null;
  description?: string | null;
  included_quantity?: number | null;
  unit_price?: string | number | null;
  discount_rate?: string | number | null;
  total_before_discount?: string | number | null;
  discount_amount?: string | number | null;
  total_after_discount?: string | number | null;
  requires_provider?: boolean | null;
  is_optional?: boolean | null;
  is_active?: boolean | null;
  sort_order?: number | null;
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
  terms_and_conditions?: string | null;
  features?: string | null;
  tags?: string | null;
  currency_code?: string | null;
  price?: string | number | null;
  sale_price?: string | number | null;
  cost_price?: string | number | null;
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
  benefits?: ProductBenefit[];
  pricing_tiers?: ProductPricingTier[];
  service_items?: ProductServiceItem[];
  created_at?: string | null;
  updated_at?: string | null;
};

type ProductApiResponse = {
  ok?: boolean;
  message?: string;
  data?: Product;
};

const SAR_ICON_PATH = "/currency/sar.svg";

function readStoredLocale(): AppLocale {
  if (typeof window === "undefined") return "ar";

  const saved = window.localStorage.getItem("primey-locale");
  if (saved === "en" || saved === "ar") return saved;

  const htmlLang = document.documentElement.lang;
  if (htmlLang === "en") return "en";

  return "ar";
}

function getCookie(name: string) {
  if (typeof document === "undefined") return "";

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || "";
  }

  return "";
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
      hour: "2-digit",
      minute: "2-digit",
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
    service_based: isArabic ? "حسب الخدمة" : "Service based",
    none: isArabic ? "بدون" : "None",
    UNKNOWN: isArabic ? "غير محدد" : "Unknown",
  };

  return map[type] || map.UNKNOWN;
}

function getPricingTypeLabel(value: string | null | undefined, locale: AppLocale) {
  const isArabic = locale === "ar";

  const map: Record<string, string> = {
    standard: isArabic ? "قياسي" : "Standard",
    customer: isArabic ? "عميل" : "Customer",
    agent: isArabic ? "مندوب" : "Agent",
    provider: isArabic ? "مقدم خدمة" : "Provider",
    contract: isArabic ? "عقد" : "Contract",
    promotional: isArabic ? "ترويجي" : "Promotional",
  };

  return map[String(value || "").toLowerCase()] || (isArabic ? "غير محدد" : "Unknown");
}

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    badge1: "System Products",
    badge2: "Product Details",

    title: isArabic ? "تفاصيل المنتج" : "Product Details",
    subtitle: isArabic
      ? "عرض بيانات المنتج أو البطاقة أو البرنامج أو الخدمة مع التسعير والجاهزية للطلبات والعقود."
      : "View product, card, program, or service details with pricing and readiness for orders and contracts.",

    back: isArabic ? "رجوع" : "Back",
    dashboard: isArabic ? "لوحة المنتجات" : "Products Dashboard",
    list: isArabic ? "قائمة المنتجات" : "Products List",
    reports: isArabic ? "التقارير" : "Reports",
    refresh: isArabic ? "تحديث" : "Refresh",
    delete: isArabic ? "حذف المنتج" : "Delete Product",
    deleting: isArabic ? "جاري الحذف..." : "Deleting...",

    overview: isArabic ? "نظرة عامة" : "Overview",
    overviewDesc: isArabic
      ? "البيانات الأساسية للمنتج وحالته التشغيلية."
      : "Core product information and operational status.",

    pricing: isArabic ? "التسعير" : "Pricing",
    pricingDesc: isArabic
      ? "السعر الأساسي وسعر العرض والضريبة والتكلفة."
      : "Base price, sale price, tax, and cost.",

    readiness: isArabic ? "الجاهزية والربط" : "Readiness & Binding",
    readinessDesc: isArabic
      ? "جاهزية المنتج للطلبات والعقود ومقدم الخدمة."
      : "Product readiness for orders, contracts, and provider binding.",

    content: isArabic ? "الوصف والمحتوى" : "Description & Content",
    contentDesc: isArabic
      ? "الوصف والخصائص والشروط والوسوم."
      : "Description, features, terms, and tags.",

    benefits: isArabic ? "مزايا المنتج" : "Product Benefits",
    benefitsDesc: isArabic
      ? "المزايا المرتبطة بالمنتج."
      : "Benefits linked to this product.",

    pricingTiers: isArabic ? "شرائح التسعير" : "Pricing Tiers",
    pricingTiersDesc: isArabic
      ? "الأسعار المختلفة حسب العميل أو المندوب أو مقدم الخدمة أو العقد."
      : "Different prices for customer, agent, provider, or contract.",

    serviceItems: isArabic ? "عناصر الخدمات" : "Service Items",
    serviceItemsDesc: isArabic
      ? "الخدمات الداخلية للبرامج والباقات."
      : "Internal services for programs and packages.",

    productName: isArabic ? "اسم المنتج" : "Product Name",
    code: isArabic ? "الكود" : "Code",
    type: isArabic ? "النوع" : "Type",
    category: isArabic ? "التصنيف" : "Category",
    status: isArabic ? "الحالة" : "Status",
    billing: isArabic ? "الفوترة" : "Billing",
    fulfillment: isArabic ? "التسليم" : "Fulfillment",
    duration: isArabic ? "المدة" : "Duration",
    createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
    updatedAt: isArabic ? "آخر تحديث" : "Updated At",

    basePrice: isArabic ? "السعر الأساسي" : "Base Price",
    salePrice: isArabic ? "سعر العرض" : "Sale Price",
    effectivePrice: isArabic ? "السعر الفعلي" : "Effective Price",
    costPrice: isArabic ? "التكلفة" : "Cost Price",
    taxRate: isArabic ? "نسبة الضريبة" : "Tax Rate",
    taxAmount: isArabic ? "قيمة الضريبة" : "Tax Amount",
    totalWithTax: isArabic ? "الإجمالي مع الضريبة" : "Total With Tax",
    maxDiscount: isArabic ? "أعلى خصم" : "Max Discount",
    agentCommission: isArabic ? "عمولة المندوب" : "Agent Commission",

    public: isArabic ? "عام" : "Public",
    private: isArabic ? "خاص" : "Private",
    featured: isArabic ? "مميز" : "Featured",
    onlinePurchase: isArabic ? "شراء إلكتروني" : "Online Purchase",
    agentSale: isArabic ? "بيع مندوب" : "Agent Sale",
    providerSale: isArabic ? "بيع مقدم خدمة" : "Provider Sale",
    canBeOrdered: isArabic ? "قابل للطلب" : "Can Be Ordered",
    canBeUsedInContracts: isArabic ? "قابل للاستخدام في العقود" : "Can Be Used In Contracts",
    requiresProvider: isArabic ? "يتطلب مقدم خدمة" : "Requires Provider",
    requiresApproval: isArabic ? "يتطلب اعتماد" : "Requires Approval",
    taxable: isArabic ? "خاضع للضريبة" : "Taxable",
    hasDiscount: isArabic ? "يوجد خصم" : "Has Discount",

    shortDescription: isArabic ? "وصف مختصر" : "Short Description",
    description: isArabic ? "الوصف التفصيلي" : "Description",
    features: isArabic ? "الخصائص" : "Features",
    terms: isArabic ? "الشروط والأحكام" : "Terms & Conditions",
    tags: isArabic ? "الوسوم" : "Tags",

    tableName: isArabic ? "الاسم" : "Name",
    tableType: isArabic ? "النوع" : "Type",
    tablePrice: isArabic ? "السعر" : "Price",
    tableStatus: isArabic ? "الحالة" : "Status",
    tableQuantity: isArabic ? "الكمية" : "Quantity",
    tableDiscount: isArabic ? "الخصم" : "Discount",
    tableTotal: isArabic ? "الإجمالي" : "Total",
    tableProviderShare: isArabic ? "حصة مقدم الخدمة" : "Provider Share",
    tableSystemShare: isArabic ? "حصة النظام" : "System Share",

    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    optional: isArabic ? "اختياري" : "Optional",
    required: isArabic ? "إجباري" : "Required",

    emptyBenefits: isArabic ? "لا توجد مزايا مسجلة" : "No benefits registered",
    emptyTiers: isArabic ? "لا توجد شرائح تسعير" : "No pricing tiers",
    emptyServiceItems: isArabic ? "لا توجد عناصر خدمات" : "No service items",

    noCategory: isArabic ? "بدون تصنيف" : "No category",
    noData: isArabic ? "غير محدد" : "Not set",
    unnamedProduct: isArabic ? "منتج بدون اسم" : "Unnamed product",

    loading: isArabic ? "جاري تحميل المنتج..." : "Loading product...",
    loadError: isArabic ? "تعذر تحميل بيانات المنتج" : "Could not load product",
    refreshSuccess: isArabic ? "تم تحديث بيانات المنتج" : "Product data refreshed",
    deleteConfirm: isArabic
      ? "هل أنت متأكد من حذف هذا المنتج؟"
      : "Are you sure you want to delete this product?",
    deleteSuccess: isArabic ? "تم حذف المنتج بنجاح" : "Product deleted successfully",
    deleteError: isArabic ? "تعذر حذف المنتج" : "Could not delete product",
  };
}

function MoneyValue({
  value,
  className = "",
}: {
  value: string | number | null | undefined;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
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

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border bg-background/50 p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-end text-sm font-semibold">{value}</div>
    </div>
  );
}

function TextBlock({
  title,
  value,
  fallback,
}: {
  title: string;
  value?: string | null;
  fallback: string;
}) {
  return (
    <div className="rounded-3xl border bg-background/50 p-4">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">
        {value?.trim() || fallback}
      </p>
    </div>
  );
}

export default function SystemProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const productId = params?.id;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

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

  async function loadProduct(showToast = false) {
    if (!productId) return;

    setIsLoading(true);

    try {
      const response = await fetch(`/api/products/${productId}/`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = (await response.json().catch(() => ({}))) as ProductApiResponse;

      if (!response.ok || payload.ok === false || !payload.data) {
        throw new Error(payload.message || t.loadError);
      }

      setProduct(payload.data);

      if (showToast) {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error("Failed to load product:", error);
      toast.error(error instanceof Error ? error.message : t.loadError);
      setProduct(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProduct(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function deleteProduct() {
    if (!productId || !product) return;

    const confirmed = window.confirm(t.deleteConfirm);
    if (!confirmed) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/products/${productId}/`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
      });

      const payload = (await response.json().catch(() => ({}))) as ProductApiResponse;

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message || t.deleteError);
      }

      toast.success(payload.message || t.deleteSuccess);
      router.push("/system/products/list");
      router.refresh();
    } catch (error) {
      console.error("Failed to delete product:", error);
      toast.error(error instanceof Error ? error.message : t.deleteError);
    } finally {
      setIsDeleting(false);
    }
  }

  const status = normalizeStatus(product?.status);
  const statusMeta = getStatusMeta(status, locale);
  const productType = normalizeType(product?.product_type);
  const billingType = normalizeBillingType(product?.billing_type);
  const fulfillmentType = normalizeFulfillmentType(product?.fulfillment_type);

  const durationLabel = useMemo(() => {
    if (!product) return t.noData;

    const value = Number(product.duration_value || 0);
    const unit = String(product.duration_unit || "none");

    if (!value || unit === "none") return t.noData;

    const unitMap: Record<string, string> = {
      day: locale === "ar" ? "يوم" : "Day",
      month: locale === "ar" ? "شهر" : "Month",
      year: locale === "ar" ? "سنة" : "Year",
    };

    return `${formatNumber(value)} ${unitMap[unit] || unit}`;
  }, [locale, product, t.noData]);

  const stats = useMemo(() => {
    if (!product) {
      return {
        benefits: 0,
        pricingTiers: 0,
        serviceItems: 0,
        readiness: 0,
      };
    }

    const readinessFlags = [
      product.can_be_ordered,
      product.can_be_used_in_contracts,
      product.requires_provider,
      product.allow_online_purchase,
      product.allow_agent_sale,
      product.allow_provider_sale,
    ].filter(Boolean).length;

    return {
      benefits: product.benefits?.length || 0,
      pricingTiers: product.pricing_tiers?.length || 0,
      serviceItems: product.service_items?.length || 0,
      readiness: readinessFlags,
    };
  }, [product]);

  if (isLoading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-3xl border bg-white/70 px-5 py-4 text-sm text-muted-foreground shadow-sm backdrop-blur-xl dark:bg-white/5">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          {t.loading}
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-6">
        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground" />
            <div>
              <h1 className="text-xl font-bold">{t.loadError}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t.noData}
              </p>
            </div>
            <Button asChild className="rounded-2xl">
              <Link href="/system/products/list">
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                {t.list}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-3xl border-white/20 bg-white/70 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardContent className="p-6 md:p-7">
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr] xl:items-center">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full px-3 py-1">{t.badge1}</Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {t.badge2}
                </Badge>
                <Badge
                  className={`rounded-full border px-3 py-1 ${statusMeta.className}`}
                >
                  {statusMeta.label}
                </Badge>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  {product.name || t.unnamedProduct}
                </h1>

                <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                  {product.short_description || t.subtitle}
                </p>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge variant="outline" className="rounded-full">
                    <Package className="h-3.5 w-3.5" />
                    {product.code || t.noData}
                  </Badge>

                  <Badge variant="outline" className="rounded-full">
                    <Tag className="h-3.5 w-3.5" />
                    {getTypeLabel(productType, locale)}
                  </Badge>

                  <Badge variant="outline" className="rounded-full">
                    {product.category?.name || t.noCategory}
                  </Badge>

                  {product.is_featured ? (
                    <Badge className="rounded-full">
                      <Star className="h-3.5 w-3.5" />
                      {t.featured}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" className="rounded-2xl">
                  <Link href="/system/products/list">
                    <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                    {t.back}
                  </Link>
                </Button>

                <Button asChild variant="outline" className="rounded-2xl">
                  <Link href="/system/products">
                    <Eye className="h-4 w-4" />
                    {t.dashboard}
                  </Link>
                </Button>

                <Button asChild variant="outline" className="rounded-2xl">
                  <Link href="/system/products/reports">
                    <BarChart3 className="h-4 w-4" />
                    {t.reports}
                  </Link>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => loadProduct(true)}
                  disabled={isLoading}
                >
                  <RefreshCcw className="h-4 w-4" />
                  {t.refresh}
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  className="rounded-2xl"
                  onClick={deleteProduct}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {isDeleting ? t.deleting : t.delete}
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/20 bg-gradient-to-br from-primary/10 via-background/60 to-background p-5 shadow-inner dark:border-white/10">
              <p className="text-sm text-muted-foreground">{t.effectivePrice}</p>
              <MoneyValue
                value={product.effective_price || product.price}
                className="mt-2 text-3xl font-bold"
              />

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white/70 p-3 dark:bg-white/5">
                  <p className="text-muted-foreground">{t.benefits}</p>
                  <p className="mt-1 font-bold">{formatNumber(stats.benefits)}</p>
                </div>

                <div className="rounded-2xl bg-white/70 p-3 dark:bg-white/5">
                  <p className="text-muted-foreground">{t.pricingTiers}</p>
                  <p className="mt-1 font-bold">
                    {formatNumber(stats.pricingTiers)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/70 p-3 dark:bg-white/5">
                  <p className="text-muted-foreground">{t.serviceItems}</p>
                  <p className="mt-1 font-bold">
                    {formatNumber(stats.serviceItems)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/70 p-3 dark:bg-white/5">
                  <p className="text-muted-foreground">{t.readiness}</p>
                  <p className="mt-1 font-bold">
                    {formatNumber(stats.readiness)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardContent className="flex items-start justify-between gap-3 p-5">
            <div>
              <p className="text-sm text-muted-foreground">{t.basePrice}</p>
              <MoneyValue value={product.price} className="mt-2 text-2xl font-bold" />
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardContent className="flex items-start justify-between gap-3 p-5">
            <div>
              <p className="text-sm text-muted-foreground">{t.taxAmount}</p>
              <MoneyValue
                value={product.tax_amount}
                className="mt-2 text-2xl font-bold"
              />
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BadgeCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardContent className="flex items-start justify-between gap-3 p-5">
            <div>
              <p className="text-sm text-muted-foreground">{t.totalWithTax}</p>
              <MoneyValue
                value={product.total_price_with_tax}
                className="mt-2 text-2xl font-bold"
              />
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardContent className="flex items-start justify-between gap-3 p-5">
            <div>
              <p className="text-sm text-muted-foreground">{t.agentCommission}</p>
              <p className="mt-2 text-2xl font-bold">
                {formatPercent(product.default_agent_commission_rate)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {t.overview}
            </CardTitle>
            <CardDescription>{t.overviewDesc}</CardDescription>
          </CardHeader>

          <CardContent className="grid gap-3 md:grid-cols-2">
            <InfoRow label={t.productName} value={product.name || t.noData} />
            <InfoRow label={t.code} value={product.code || t.noData} />
            <InfoRow label={t.type} value={getTypeLabel(productType, locale)} />
            <InfoRow label={t.category} value={product.category?.name || t.noCategory} />
            <InfoRow label={t.status} value={statusMeta.label} />
            <InfoRow label={t.billing} value={getBillingLabel(billingType, locale)} />
            <InfoRow
              label={t.fulfillment}
              value={getFulfillmentLabel(fulfillmentType, locale)}
            />
            <InfoRow label={t.duration} value={durationLabel} />
            <InfoRow
              label={t.createdAt}
              value={formatDate(product.created_at, locale)}
            />
            <InfoRow
              label={t.updatedAt}
              value={formatDate(product.updated_at, locale)}
            />
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {t.readiness}
            </CardTitle>
            <CardDescription>{t.readinessDesc}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={product.is_public ? "secondary" : "outline"}
                className="rounded-full"
              >
                {product.is_public ? t.public : t.private}
              </Badge>

              {product.is_featured ? (
                <Badge className="rounded-full">
                  <Star className="h-3 w-3" />
                  {t.featured}
                </Badge>
              ) : null}

              {product.allow_online_purchase ? (
                <Badge variant="secondary" className="rounded-full">
                  {t.onlinePurchase}
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

              {product.can_be_ordered ? (
                <Badge variant="secondary" className="rounded-full">
                  <ShieldCheck className="h-3 w-3" />
                  {t.canBeOrdered}
                </Badge>
              ) : null}

              {product.can_be_used_in_contracts ? (
                <Badge variant="outline" className="rounded-full">
                  <Boxes className="h-3 w-3" />
                  {t.canBeUsedInContracts}
                </Badge>
              ) : null}

              {product.requires_provider ? (
                <Badge variant="outline" className="rounded-full">
                  <Stethoscope className="h-3 w-3" />
                  {t.requiresProvider}
                </Badge>
              ) : null}

              {product.requires_approval ? (
                <Badge variant="outline" className="rounded-full">
                  {t.requiresApproval}
                </Badge>
              ) : null}

              {product.is_taxable ? (
                <Badge variant="outline" className="rounded-full">
                  {t.taxable}
                </Badge>
              ) : null}

              {product.has_discount ? (
                <Badge variant="outline" className="rounded-full">
                  {t.hasDiscount}
                </Badge>
              ) : null}
            </div>

            <div className="grid gap-3 pt-2">
              <InfoRow label={t.maxDiscount} value={formatPercent(product.max_discount_rate)} />
              <InfoRow
                label={t.agentCommission}
                value={formatPercent(product.default_agent_commission_rate)}
              />
              <InfoRow label={t.taxRate} value={formatPercent(product.tax_rate)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {t.pricing}
          </CardTitle>
          <CardDescription>{t.pricingDesc}</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoRow label={t.basePrice} value={<MoneyValue value={product.price} />} />
          <InfoRow label={t.salePrice} value={<MoneyValue value={product.sale_price} />} />
          <InfoRow
            label={t.effectivePrice}
            value={<MoneyValue value={product.effective_price} />}
          />
          <InfoRow label={t.costPrice} value={<MoneyValue value={product.cost_price} />} />
          <InfoRow label={t.taxRate} value={formatPercent(product.tax_rate)} />
          <InfoRow label={t.taxAmount} value={<MoneyValue value={product.tax_amount} />} />
          <InfoRow
            label={t.totalWithTax}
            value={<MoneyValue value={product.total_price_with_tax} />}
          />
          <InfoRow label={t.maxDiscount} value={formatPercent(product.max_discount_rate)} />
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {t.content}
          </CardTitle>
          <CardDescription>{t.contentDesc}</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2">
          <TextBlock
            title={t.shortDescription}
            value={product.short_description}
            fallback={t.noData}
          />
          <TextBlock title={t.tags} value={product.tags} fallback={t.noData} />
          <TextBlock
            title={t.description}
            value={product.description}
            fallback={t.noData}
          />
          <TextBlock title={t.features} value={product.features} fallback={t.noData} />
          <div className="md:col-span-2">
            <TextBlock
              title={t.terms}
              value={product.terms_and_conditions}
              fallback={t.noData}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t.benefits}
          </CardTitle>
          <CardDescription>{t.benefitsDesc}</CardDescription>
        </CardHeader>

        <CardContent>
          {product.benefits?.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {product.benefits.map((benefit) => (
                <div
                  key={benefit.id}
                  className="rounded-3xl border bg-background/50 p-4"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h3 className="font-bold">{benefit.title || t.noData}</h3>
                    <Badge
                      variant={benefit.is_active ? "secondary" : "outline"}
                      className="rounded-full"
                    >
                      {benefit.is_active ? t.active : t.inactive}
                    </Badge>
                  </div>

                  <p className="text-sm leading-7 text-muted-foreground">
                    {benefit.description || t.noData}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[130px] items-center justify-center rounded-3xl border border-dashed text-sm text-muted-foreground">
              {t.emptyBenefits}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers3 className="h-5 w-5 text-primary" />
            {t.pricingTiers}
          </CardTitle>
          <CardDescription>{t.pricingTiersDesc}</CardDescription>
        </CardHeader>

        <CardContent>
          {product.pricing_tiers?.length ? (
            <div className="overflow-hidden rounded-3xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>{t.tableName}</TableHead>
                    <TableHead>{t.tableType}</TableHead>
                    <TableHead>{t.tablePrice}</TableHead>
                    <TableHead>{t.tableDiscount}</TableHead>
                    <TableHead>{t.agentCommission}</TableHead>
                    <TableHead>{t.tableProviderShare}</TableHead>
                    <TableHead>{t.tableSystemShare}</TableHead>
                    <TableHead>{t.tableStatus}</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {product.pricing_tiers.map((tier) => (
                    <TableRow key={tier.id}>
                      <TableCell>
                        <div>
                          <p className="font-semibold">{tier.name || t.noData}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatNumber(tier.min_quantity || 1)}
                            {tier.max_quantity
                              ? ` - ${formatNumber(tier.max_quantity)}`
                              : ""}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        {getPricingTypeLabel(tier.pricing_type, locale)}
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <MoneyValue value={tier.effective_price || tier.price} />
                          {tier.has_discount ? (
                            <Badge variant="outline" className="rounded-full">
                              {t.hasDiscount}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell>{formatPercent(tier.discount_rate)}</TableCell>
                      <TableCell>{formatPercent(tier.agent_commission_rate)}</TableCell>
                      <TableCell>{formatPercent(tier.provider_share_rate)}</TableCell>
                      <TableCell>{formatPercent(tier.system_share_rate)}</TableCell>

                      <TableCell>
                        <Badge
                          variant={tier.is_active ? "secondary" : "outline"}
                          className="rounded-full"
                        >
                          {tier.is_active ? t.active : t.inactive}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex min-h-[130px] items-center justify-center rounded-3xl border border-dashed text-sm text-muted-foreground">
              {t.emptyTiers}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            {t.serviceItems}
          </CardTitle>
          <CardDescription>{t.serviceItemsDesc}</CardDescription>
        </CardHeader>

        <CardContent>
          {product.service_items?.length ? (
            <div className="overflow-hidden rounded-3xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>{t.tableName}</TableHead>
                    <TableHead>{t.tableQuantity}</TableHead>
                    <TableHead>{t.tablePrice}</TableHead>
                    <TableHead>{t.tableDiscount}</TableHead>
                    <TableHead>{t.tableTotal}</TableHead>
                    <TableHead>{t.requiresProvider}</TableHead>
                    <TableHead>{t.tableStatus}</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {product.service_items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-semibold">{item.name || t.noData}</p>
                          <p className="max-w-[360px] text-xs leading-5 text-muted-foreground">
                            {item.description || t.noData}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        {formatNumber(item.included_quantity || 0)}
                      </TableCell>

                      <TableCell>
                        <MoneyValue value={item.unit_price} />
                      </TableCell>

                      <TableCell>{formatPercent(item.discount_rate)}</TableCell>

                      <TableCell>
                        <MoneyValue value={item.total_after_discount} />
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="rounded-full">
                            {item.requires_provider
                              ? t.requiresProvider
                              : t.noData}
                          </Badge>

                          <Badge
                            variant={item.is_optional ? "secondary" : "outline"}
                            className="rounded-full"
                          >
                            {item.is_optional ? t.optional : t.required}
                          </Badge>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={item.is_active ? "secondary" : "outline"}
                          className="rounded-full"
                        >
                          {item.is_active ? t.active : t.inactive}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex min-h-[130px] items-center justify-center rounded-3xl border border-dashed text-sm text-muted-foreground">
              {t.emptyServiceItems}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}