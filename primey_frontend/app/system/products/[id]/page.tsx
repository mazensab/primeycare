"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Boxes,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Edit3,
  Eye,
  FileText,
  Layers2,
  Loader2,
  Package,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Trash2,
  WalletCards,
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
  TableRow,
} from "@/components/ui/table";

/* ============================================================
   📂 app/system/products/[id]/page.tsx
   🧠 Primey Care | Product Detail
   ------------------------------------------------------------
   ✅ صفحة تفاصيل المنتج
   ✅ نفس نمط الصفحات المرفقة
   ✅ ربط حقيقي مع /api/products/<id>/
   ✅ حذف المنتج عبر DELETE
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ الأرقام دائمًا إنجليزية
   ✅ استخدام UI الداخلي فقط
   ✅ استخدام sonner
   ✅ استخدام رمز SAR من /currency/sar.svg
   ✅ لا يوجد localhost hardcoded
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
type DurationUnit = "none" | "day" | "month" | "year" | "UNKNOWN";

type ProductCategory = {
  id: number | string;
  code?: string | null;
  name?: string | null;
  category_type?: string | null;
  status?: string | null;
  description?: string | null;
  sort_order?: number | null;
};

type ProductBenefit = {
  id: number | string;
  title?: string | null;
  description?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

type ProductPricingTier = {
  id: number | string;
  name?: string | null;
  price?: string | number | null;
  sale_price?: string | number | null;
  effective_price?: string | number | null;
  sort_order?: number | null;
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
  has_discount?: boolean | null;
  is_taxable?: boolean | null;
  tax_rate?: string | number | null;

  duration_value?: number | null;
  duration_unit?: DurationUnit | string | null;

  is_public?: boolean | null;
  is_featured?: boolean | null;
  requires_approval?: boolean | null;
  allow_online_purchase?: boolean | null;
  sort_order?: number | null;

  benefits?: ProductBenefit[];
  pricing_tiers?: ProductPricingTier[];

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

function normalizeDurationUnit(unit?: string | null): DurationUnit {
  const value = String(unit || "").toLowerCase();

  if (value === "none") return "none";
  if (value === "day") return "day";
  if (value === "month") return "month";
  if (value === "year") return "year";

  return "UNKNOWN";
}

function splitLines(value?: string | null) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getStatusMeta(status: ProductStatus, locale: AppLocale) {
  const isArabic = locale === "ar";

  const map: Record<
    ProductStatus,
    {
      label: string;
      className: string;
    }
  > = {
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

function getDurationLabel(unit: DurationUnit, locale: AppLocale) {
  const isArabic = locale === "ar";

  const map: Record<DurationUnit, string> = {
    none: isArabic ? "بدون مدة" : "No duration",
    day: isArabic ? "يوم" : "Day",
    month: isArabic ? "شهر" : "Month",
    year: isArabic ? "سنة" : "Year",
    UNKNOWN: isArabic ? "غير محدد" : "Unknown",
  };

  return map[unit] || map.UNKNOWN;
}

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    badge1: "System Products",
    badge2: "Product Detail",

    loading: isArabic ? "جاري تحميل تفاصيل المنتج..." : "Loading product details...",
    notFound: isArabic ? "لم يتم العثور على المنتج" : "Product not found",
    loadError: isArabic ? "تعذر تحميل تفاصيل المنتج" : "Could not load product details",
    deleteSuccess: isArabic ? "تم حذف المنتج بنجاح" : "Product deleted successfully",
    deleteError: isArabic ? "تعذر حذف المنتج" : "Could not delete product",
    deleteConfirm: isArabic
      ? "هل تريد حذف هذا المنتج؟ لا يمكن التراجع عن هذه العملية."
      : "Delete this product? This action cannot be undone.",

    back: isArabic ? "رجوع" : "Back",
    dashboard: isArabic ? "لوحة المنتجات" : "Products Dashboard",
    list: isArabic ? "قائمة المنتجات" : "Products List",
    edit: isArabic ? "تعديل" : "Edit",
    delete: isArabic ? "حذف" : "Delete",
    refresh: isArabic ? "تحديث" : "Refresh",

    seller: isArabic ? "التصنيف" : "Category",
    published: isArabic ? "تاريخ الإنشاء" : "Published",
    sku: isArabic ? "الكود" : "SKU",

    price: isArabic ? "السعر" : "Price",
    productType: isArabic ? "نوع المنتج" : "Product Type",
    billingType: isArabic ? "الفوترة" : "Billing",
    value: isArabic ? "القيمة" : "Value",

    description: isArabic ? "الوصف" : "Description",
    keyFeatures: isArabic ? "الخصائص الرئيسية" : "Key Features",
    productInfo: isArabic ? "معلومات المنتج" : "Product Information",
    benefits: isArabic ? "مزايا المنتج" : "Product Benefits",
    pricingTiers: isArabic ? "شرائح التسعير" : "Pricing Tiers",
    terms: isArabic ? "الشروط والأحكام" : "Terms & Conditions",
    operationalOptions: isArabic ? "خيارات التشغيل والبيع" : "Sales & Operational Options",

    status: isArabic ? "الحالة" : "Status",
    category: isArabic ? "التصنيف" : "Category",
    currency: isArabic ? "العملة" : "Currency",
    basePrice: isArabic ? "السعر الأساسي" : "Base Price",
    salePrice: isArabic ? "سعر العرض" : "Sale Price",
    costPrice: isArabic ? "التكلفة" : "Cost Price",
    taxRate: isArabic ? "نسبة الضريبة" : "Tax Rate",
    duration: isArabic ? "المدة" : "Duration",
    sortOrder: isArabic ? "ترتيب العرض" : "Sort Order",
    slug: isArabic ? "Slug" : "Slug",
    updatedAt: isArabic ? "آخر تحديث" : "Updated At",
    createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",

    public: isArabic ? "ظاهر للعامة" : "Public",
    featured: isArabic ? "منتج مميز" : "Featured",
    online: isArabic ? "شراء إلكتروني" : "Online Purchase",
    approval: isArabic ? "يتطلب اعتماد" : "Requires Approval",
    taxable: isArabic ? "خاضع للضريبة" : "Taxable",
    discount: isArabic ? "يوجد خصم" : "Discount",

    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",
    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    noCategory: isArabic ? "بدون تصنيف" : "No category",
    notSet: isArabic ? "غير محدد" : "Not set",
    noDescription: isArabic ? "لا يوجد وصف لهذا المنتج." : "No description for this product.",
    noFeatures: isArabic ? "لا توجد خصائص مسجلة." : "No features registered.",
    noTerms: isArabic ? "لا توجد شروط وأحكام مسجلة." : "No terms and conditions registered.",
    noBenefits: isArabic ? "لا توجد مزايا مسجلة." : "No benefits registered.",
    noTiers: isArabic ? "لا توجد شرائح تسعير مسجلة." : "No pricing tiers registered.",

    tierName: isArabic ? "الشريحة" : "Tier",
    tierPrice: isArabic ? "السعر" : "Price",
    tierSalePrice: isArabic ? "سعر العرض" : "Sale Price",
    tierStatus: isArabic ? "الحالة" : "Status",

    quickSummary: isArabic ? "ملخص سريع" : "Quick Summary",
    quickSummaryDesc: isArabic
      ? "نظرة مختصرة على حالة المنتج وإعداداته."
      : "A quick view of product status and configuration.",

    tags: isArabic ? "الوسوم" : "Tags",
    noTags: isArabic ? "لا توجد وسوم" : "No tags",
  };
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <TableRow>
      <TableCell className="w-[42%] font-semibold">{label}</TableCell>
      <TableCell className="text-end text-muted-foreground">{value}</TableCell>
    </TableRow>
  );
}

function OptionBadge({
  enabled,
  label,
}: {
  enabled: boolean;
  label: string;
}) {
  return (
    <Badge
      variant={enabled ? "default" : "outline"}
      className="rounded-full px-3 py-1"
    >
      {enabled ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <Eye className="h-3.5 w-3.5 opacity-50" />
      )}
      {label}
    </Badge>
  );
}

export default function SystemProductDetailPage() {
  const params = useParams();
  const router = useRouter();

  const productId = String(params?.id || "");

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

      const payload = (await response
        .json()
        .catch(() => ({}))) as ProductApiResponse;

      if (!response.ok || payload.ok === false || !payload.data) {
        throw new Error(payload.message || t.loadError);
      }

      setProduct(payload.data);

      if (showToast) {
        toast.success(locale === "ar" ? "تم تحديث تفاصيل المنتج" : "Product details refreshed");
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
    if (!productId || !window.confirm(t.deleteConfirm)) return;

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

      const payload = await response.json().catch(() => ({}));

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

  const productStatus = normalizeStatus(product?.status);
  const productType = normalizeType(product?.product_type);
  const billingType = normalizeBillingType(product?.billing_type);
  const durationUnit = normalizeDurationUnit(product?.duration_unit);
  const statusMeta = getStatusMeta(productStatus, locale);

  const features = useMemo(() => splitLines(product?.features), [product?.features]);
  const tags = useMemo(() => splitLines(product?.tags), [product?.tags]);

  const durationText = useMemo(() => {
    const durationValue = Number(product?.duration_value || 0);

    if (!durationValue || durationUnit === "none" || durationUnit === "UNKNOWN") {
      return t.notSet;
    }

    return `${formatNumber(durationValue)} ${getDurationLabel(durationUnit, locale)}`;
  }, [durationUnit, locale, product?.duration_value, t.notSet]);

  if (isLoading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t.loading}
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <Card className="rounded-3xl border-white/20 bg-white/70 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardContent className="flex min-h-[360px] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
            <Package className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t.notFound}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t.loadError}</p>
          </div>
          <Button asChild className="rounded-2xl">
            <Link href="/system/products/list">
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              {t.list}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const priceCards = [
    {
      label: t.price,
      value: formatMoney(product.effective_price || product.price),
      icon: CreditCard,
      money: true,
    },
    {
      label: t.productType,
      value: getTypeLabel(productType, locale),
      icon: Layers2,
      money: false,
    },
    {
      label: t.billingType,
      value: getBillingLabel(billingType, locale),
      icon: WalletCards,
      money: false,
    },
    {
      label: t.value,
      value: formatMoney(product.price),
      icon: Boxes,
      money: true,
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-3xl border-white/20 bg-white/70 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardContent className="p-6 md:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full px-3 py-1">{t.badge1}</Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {t.badge2}
                </Badge>
                <Badge className={`rounded-full border px-3 py-1 ${statusMeta.className}`}>
                  {statusMeta.label}
                </Badge>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  {product.name || t.notSet}
                </h1>

                <div className="flex flex-col gap-2 text-sm text-muted-foreground lg:flex-row lg:flex-wrap lg:gap-4">
                  <div>
                    <span className="font-semibold text-foreground">{t.seller}: </span>
                    {product.category?.name || t.noCategory}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">{t.published}: </span>
                    {formatDate(product.created_at, locale)}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">{t.sku}: </span>
                    {product.code || product.slug || "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="/system/products/list">
                  <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                  {t.list}
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

              <Button asChild className="rounded-2xl">
                <Link href={`/system/products/${product.id}/edit`}>
                  <Edit3 className="h-4 w-4" />
                  {t.edit}
                </Link>
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
                {t.delete}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-1">
          <Card className="overflow-hidden rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <CardContent className="p-5">
              <div className="flex aspect-square items-center justify-center rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-muted">
                <div className="text-center">
                  <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-[2rem] bg-primary/10 text-primary">
                    <Package className="h-14 w-14" />
                  </div>
                  <h2 className="mt-5 text-xl font-bold">
                    {product.name || t.notSet}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {product.short_description || product.category?.name || t.noCategory}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <OptionBadge enabled={Boolean(product.is_public)} label={t.public} />
                <OptionBadge enabled={Boolean(product.is_featured)} label={t.featured} />
                <OptionBadge enabled={Boolean(product.allow_online_purchase)} label={t.online} />
                <OptionBadge enabled={Boolean(product.requires_approval)} label={t.approval} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 xl:col-span-2">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {priceCards.map((item) => {
              const Icon = item.icon;

              return (
                <Card
                  key={item.label}
                  className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/5"
                >
                  <CardContent className="grid auto-cols-max grid-flow-col gap-4 p-4">
                    <Icon className="h-6 w-6 opacity-40" />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-muted-foreground">
                        {item.label}
                      </span>
                      <span className="flex items-center gap-1 text-lg font-semibold">
                        {item.value}
                        {item.money ? (
                          <Image
                            src={SAR_ICON_PATH}
                            alt="SAR"
                            width={15}
                            height={15}
                            className="opacity-80"
                          />
                        ) : null}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <CardContent className="space-y-6 p-6">
              <div className="grid items-start gap-8 xl:grid-cols-3">
                <div className="space-y-8 xl:col-span-2">
                  <div>
                    <h3 className="mb-2 flex items-center gap-2 font-semibold">
                      <FileText className="h-4 w-4 text-primary" />
                      {t.description}:
                    </h3>
                    <p className="leading-7 text-muted-foreground">
                      {product.description || product.short_description || t.noDescription}
                    </p>
                  </div>

                  <div>
                    <h3 className="mb-2 flex items-center gap-2 font-semibold">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {t.keyFeatures}:
                    </h3>

                    {features.length ? (
                      <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                        {features.map((feature, index) => (
                          <li key={`${feature}-${index}`}>{feature}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">{t.noFeatures}</p>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border xl:col-span-1">
                  <Table>
                    <TableBody>
                      <InfoRow label={t.category} value={product.category?.name || t.noCategory} />
                      <InfoRow label={t.status} value={statusMeta.label} />
                      <InfoRow label={t.billingType} value={getBillingLabel(billingType, locale)} />
                      <InfoRow label={t.duration} value={durationText} />
                      <InfoRow label={t.slug} value={product.slug || t.notSet} />
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="rounded-3xl bg-muted/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      {t.operationalOptions}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <OptionBadge enabled={Boolean(product.is_public)} label={t.public} />
                    <OptionBadge enabled={Boolean(product.is_featured)} label={t.featured} />
                    <OptionBadge enabled={Boolean(product.allow_online_purchase)} label={t.online} />
                    <OptionBadge enabled={Boolean(product.requires_approval)} label={t.approval} />
                    <OptionBadge enabled={Boolean(product.is_taxable)} label={t.taxable} />
                    <OptionBadge enabled={Boolean(product.has_discount)} label={t.discount} />
                  </CardContent>
                </Card>

                <Card className="rounded-3xl bg-muted/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Tag className="h-4 w-4 text-primary" />
                      {t.tags}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {tags.length ? (
                      tags.map((tag, index) => (
                        <Badge
                          key={`${tag}-${index}`}
                          variant="secondary"
                          className="rounded-full"
                        >
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">{t.noTags}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  {t.productInfo}
                </CardTitle>
                <CardDescription>{t.quickSummaryDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-2xl border">
                  <Table>
                    <TableBody>
                      <InfoRow label={t.basePrice} value={
                        <span className="inline-flex items-center gap-1">
                          {formatMoney(product.price)}
                          <Image src={SAR_ICON_PATH} alt="SAR" width={13} height={13} />
                        </span>
                      } />
                      <InfoRow label={t.salePrice} value={
                        product.sale_price ? (
                          <span className="inline-flex items-center gap-1">
                            {formatMoney(product.sale_price)}
                            <Image src={SAR_ICON_PATH} alt="SAR" width={13} height={13} />
                          </span>
                        ) : t.notSet
                      } />
                      <InfoRow label={t.costPrice} value={
                        product.cost_price ? (
                          <span className="inline-flex items-center gap-1">
                            {formatMoney(product.cost_price)}
                            <Image src={SAR_ICON_PATH} alt="SAR" width={13} height={13} />
                          </span>
                        ) : t.notSet
                      } />
                      <InfoRow label={t.taxRate} value={`${formatMoney(product.tax_rate)}%`} />
                      <InfoRow label={t.sortOrder} value={formatNumber(Number(product.sort_order || 0))} />
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  {t.quickSummary}
                </CardTitle>
                <CardDescription>{t.quickSummaryDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-2xl border">
                  <Table>
                    <TableBody>
                      <InfoRow label={t.createdAt} value={formatDate(product.created_at, locale)} />
                      <InfoRow label={t.updatedAt} value={formatDate(product.updated_at, locale)} />
                      <InfoRow label={t.productType} value={getTypeLabel(productType, locale)} />
                      <InfoRow label={t.currency} value={product.currency_code || "SAR"} />
                      <InfoRow label={t.sku} value={product.code || "-"} />
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-primary" />
                {t.benefits}
              </CardTitle>
              <CardDescription>{t.benefits}</CardDescription>
            </CardHeader>

            <CardContent>
              {product.benefits?.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {product.benefits.map((benefit, index) => (
                    <div
                      key={benefit.id || index}
                      className="rounded-3xl border bg-background/50 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="font-semibold">
                          {benefit.title || t.notSet}
                        </h3>
                        <Badge
                          variant={benefit.is_active ? "default" : "outline"}
                          className="rounded-full"
                        >
                          {benefit.is_active ? t.active : t.inactive}
                        </Badge>
                      </div>
                      <p className="text-sm leading-7 text-muted-foreground">
                        {benefit.description || t.noDescription}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[140px] items-center justify-center rounded-3xl border border-dashed text-sm text-muted-foreground">
                  {t.noBenefits}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WalletCards className="h-5 w-5 text-primary" />
                {t.pricingTiers}
              </CardTitle>
              <CardDescription>{t.pricingTiers}</CardDescription>
            </CardHeader>

            <CardContent>
              {product.pricing_tiers?.length ? (
                <div className="overflow-hidden rounded-3xl border">
                  <Table>
                    <TableBody>
                      {product.pricing_tiers.map((tier) => (
                        <TableRow key={tier.id}>
                          <TableCell className="font-semibold">
                            {tier.name || t.notSet}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1">
                              {formatMoney(tier.effective_price || tier.price)}
                              <Image src={SAR_ICON_PATH} alt="SAR" width={13} height={13} />
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {tier.sale_price ? formatMoney(tier.sale_price) : t.notSet}
                          </TableCell>
                          <TableCell className="text-end">
                            <Badge
                              variant={tier.is_active ? "default" : "outline"}
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
                <div className="flex min-h-[140px] items-center justify-center rounded-3xl border border-dashed text-sm text-muted-foreground">
                  {t.noTiers}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {t.terms}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <p className="whitespace-pre-line leading-7 text-muted-foreground">
                {product.terms_and_conditions || t.noTerms}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}