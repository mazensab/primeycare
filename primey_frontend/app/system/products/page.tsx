"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Boxes,
  CreditCard,
  Eye,
  FileText,
  Layers3,
  ListChecks,
  Loader2,
  Package,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
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
   📂 app/system/products/page.tsx
   🧠 Primey Care | System Products Dashboard
   ------------------------------------------------------------
   ✅ صفحة المنتجات الرئيسية كوحدة مستقلة
   ✅ نفس نمط صفحة المراكز / العملاء / المندوبين
   ✅ استخدام UI الداخلي فقط
   ✅ ربط حقيقي مع /api/products/
   ✅ دعم عربي / إنجليزي من primey-locale
   ✅ الأرقام دائمًا إنجليزية
   ✅ لا يوجد localhost hardcoded
   ✅ استخدام رمز العملة من /currency/sar.svg
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
  status?: string | null;
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
  tags?: string | null;
  currency_code?: string | null;
  price?: string | number | null;
  sale_price?: string | number | null;
  effective_price?: string | number | null;
  has_discount?: boolean | null;
  is_taxable?: boolean | null;
  tax_rate?: string | number | null;
  duration_value?: number | null;
  duration_unit?: string | null;
  is_public?: boolean | null;
  is_featured?: boolean | null;
  requires_approval?: boolean | null;
  allow_online_purchase?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ProductsApiResponse = {
  ok?: boolean;
  message?: string;
  results?: Product[];
  data?: Product[];
  pagination?: {
    page?: number;
    page_size?: number;
    total_pages?: number;
    total_items?: number;
  };
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

/* ============================================================
   ✅ Numbers Always English
============================================================ */

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function toNumber(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
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

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    badge1: "System Products",
    badge2: "Products Module",

    title: isArabic ? "إدارة المنتجات" : "Products Management",
    subtitle: isArabic
      ? "وحدة المنتجات تجمع البطاقات والعضويات والبرامج والخدمات داخل Primey Care مع متابعة الأسعار والحالة والربط التشغيلي."
      : "The products module manages cards, memberships, programs, and services inside Primey Care with pricing, status, and operational tracking.",

    refresh: isArabic ? "تحديث" : "Refresh",
    create: isArabic ? "إنشاء منتج" : "Create Product",
    list: isArabic ? "قائمة المنتجات" : "Products List",
    reports: isArabic ? "تقارير المنتجات" : "Products Reports",

    searchPlaceholder: isArabic
      ? "ابحث باسم المنتج أو الكود أو التصنيف..."
      : "Search by product name, code, or category...",

    totalProducts: isArabic ? "إجمالي المنتجات" : "Total Products",
    activeProducts: isArabic ? "المنتجات النشطة" : "Active Products",
    featuredProducts: isArabic ? "منتجات مميزة" : "Featured Products",
    totalValue: isArabic ? "قيمة المنتجات" : "Products Value",

    totalProductsDesc: isArabic
      ? "كل المنتجات المسجلة في النظام"
      : "All products registered in the system",
    activeProductsDesc: isArabic
      ? "جاهزة للبيع أو التشغيل"
      : "Ready for sale or operation",
    featuredProductsDesc: isArabic
      ? "مميزة في العرض أو التسويق"
      : "Highlighted for display or marketing",
    totalValueDesc: isArabic
      ? "حسب السعر الفعلي للمنتجات"
      : "Based on effective product prices",

    featuredTitle: isArabic ? "المنتجات المميزة" : "Featured Products",
    featuredDesc: isArabic
      ? "أهم المنتجات التي تظهر في واجهات البيع والتسويق."
      : "Key products shown in sales and marketing surfaces.",

    statusTitle: isArabic ? "حالة المنتجات" : "Products Status",
    statusDesc: isArabic
      ? "نظرة مختصرة على توزيع الحالات التشغيلية."
      : "Quick overview of operational status distribution.",

    latestTitle: isArabic ? "أحدث المنتجات" : "Latest Products",
    latestDesc: isArabic
      ? "آخر المنتجات المضافة أو المحدثة داخل النظام."
      : "Latest products added or updated inside the system.",

    actionsTitle: isArabic ? "إجراءات وحدة المنتجات" : "Products Module Actions",
    actionsDesc: isArabic
      ? "اختصارات سريعة لإدارة وحدة المنتجات."
      : "Quick shortcuts for managing the products module.",

    tableProduct: isArabic ? "المنتج" : "Product",
    tableType: isArabic ? "النوع" : "Type",
    tablePrice: isArabic ? "السعر" : "Price",
    tableStatus: isArabic ? "الحالة" : "Status",
    tableUpdated: isArabic ? "آخر تحديث" : "Updated",
    tableAction: isArabic ? "الإجراء" : "Action",

    view: isArabic ? "عرض" : "View",
    noProducts: isArabic ? "لا توجد منتجات حتى الآن" : "No products yet",
    noFeatured: isArabic
      ? "لا توجد منتجات مميزة حاليًا"
      : "No featured products currently",
    loading: isArabic ? "جاري تحميل المنتجات..." : "Loading products...",
    loadError: isArabic
      ? "تعذر تحميل بيانات المنتجات"
      : "Could not load products data",

    cards: isArabic ? "البطاقات" : "Cards",
    programs: isArabic ? "البرامج" : "Programs",
    memberships: isArabic ? "العضويات" : "Memberships",
    services: isArabic ? "الخدمات" : "Services",
    publicProducts: isArabic ? "متاحة للعامة" : "Public",
    onlinePurchase: isArabic ? "شراء إلكتروني" : "Online purchase",

    actionCreateTitle: isArabic ? "إنشاء منتج جديد" : "Create a new product",
    actionCreateDesc: isArabic
      ? "إضافة بطاقة أو برنامج أو خدمة وربطها بالتسعير."
      : "Add a card, program, or service and connect it to pricing.",
    actionListTitle: isArabic ? "إدارة القائمة" : "Manage list",
    actionListDesc: isArabic
      ? "بحث وفرز وتصفية وتصدير المنتجات."
      : "Search, sort, filter, and export products.",
    actionReportsTitle: isArabic ? "تحليل المنتجات" : "Product analytics",
    actionReportsDesc: isArabic
      ? "متابعة الحالات والقيم والمنتجات المميزة."
      : "Track statuses, values, and featured products.",

    moduleSummary: isArabic ? "ملخص الوحدة" : "Module summary",
    noCategory: isArabic ? "بدون تصنيف" : "No category",
    unnamedProduct: isArabic ? "منتج بدون اسم" : "Unnamed product",
    refreshSuccess: isArabic ? "تم تحديث المنتجات" : "Products refreshed",
  };
}

export default function SystemProductsPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const isArabic = locale === "ar";
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

      const payload = (await response
        .json()
        .catch(() => ({}))) as ProductsApiResponse;

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message || t.loadError);
      }

      const rows = Array.isArray(payload.results)
        ? payload.results
        : Array.isArray(payload.data)
          ? payload.data
          : [];

      setProducts(rows);

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
  }

  useEffect(() => {
    loadProducts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return products;

    return products.filter((product) => {
      const values = [
        product.name,
        product.code,
        product.slug,
        product.short_description,
        product.category?.name,
        product.product_type,
        product.status,
        product.tags,
      ];

      return values.some((value) =>
        String(value || "").toLowerCase().includes(term)
      );
    });
  }, [products, search]);

  const stats = useMemo(() => {
    const total = products.length;

    const active = products.filter(
      (product) => normalizeStatus(product.status) === "active"
    ).length;

    const featured = products.filter((product) =>
      Boolean(product.is_featured)
    ).length;

    const publicProducts = products.filter((product) =>
      Boolean(product.is_public)
    ).length;

    const onlinePurchase = products.filter((product) =>
      Boolean(product.allow_online_purchase)
    ).length;

    const cards = products.filter(
      (product) => normalizeType(product.product_type) === "card"
    ).length;

    const programs = products.filter(
      (product) => normalizeType(product.product_type) === "program"
    ).length;

    const memberships = products.filter(
      (product) => normalizeType(product.product_type) === "membership"
    ).length;

    const services = products.filter(
      (product) => normalizeType(product.product_type) === "service"
    ).length;

    const totalValue = products.reduce(
      (sum, product) => sum + toNumber(product.effective_price || product.price),
      0
    );

    return {
      total,
      active,
      featured,
      publicProducts,
      onlinePurchase,
      cards,
      programs,
      memberships,
      services,
      totalValue,
    };
  }, [products]);

  const featuredProducts = useMemo(() => {
    return products.filter((product) => Boolean(product.is_featured)).slice(0, 4);
  }, [products]);

  const latestProducts = useMemo(() => {
    return [...filteredProducts]
      .sort((a, b) => {
        const first = new Date(a.updated_at || a.created_at || 0).getTime();
        const second = new Date(b.updated_at || b.created_at || 0).getTime();
        return second - first;
      })
      .slice(0, 7);
  }, [filteredProducts]);

  const statusRows = useMemo(() => {
    const statuses: ProductStatus[] = [
      "active",
      "draft",
      "inactive",
      "archived",
    ];

    return statuses.map((status) => ({
      status,
      count: products.filter(
        (product) => normalizeStatus(product.status) === status
      ).length,
    }));
  }, [products]);

  const topCards = [
    {
      title: t.totalProducts,
      value: formatNumber(stats.total),
      description: t.totalProductsDesc,
      icon: Package,
      money: false,
    },
    {
      title: t.activeProducts,
      value: formatNumber(stats.active),
      description: t.activeProductsDesc,
      icon: BadgeCheck,
      money: false,
    },
    {
      title: t.featuredProducts,
      value: formatNumber(stats.featured),
      description: t.featuredProductsDesc,
      icon: Star,
      money: false,
    },
    {
      title: t.totalValue,
      value: formatMoney(stats.totalValue),
      description: t.totalValueDesc,
      icon: CreditCard,
      money: true,
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-3xl border-white/20 bg-white/70 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardContent className="p-6 md:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-center">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full px-3 py-1">{t.badge1}</Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {t.badge2}
                </Badge>
              </div>

              <div className="space-y-3">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  {t.title}
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                  {t.subtitle}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild className="rounded-2xl">
                  <Link href="/system/products/create">
                    <Plus className="h-4 w-4" />
                    {t.create}
                  </Link>
                </Button>

                <Button asChild variant="secondary" className="rounded-2xl">
                  <Link href="/system/products/list">
                    <ListChecks className="h-4 w-4" />
                    {t.list}
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

            <div className="rounded-3xl border border-white/20 bg-gradient-to-br from-primary/10 via-background/60 to-background p-5 shadow-inner dark:border-white/10">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t.moduleSummary}
                  </p>
                  <h2 className="text-xl font-bold">
                    {formatNumber(stats.total)}
                  </h2>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Boxes className="h-6 w-6" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white/70 p-3 dark:bg-white/5">
                  <p className="text-muted-foreground">{t.cards}</p>
                  <p className="mt-1 font-bold">{formatNumber(stats.cards)}</p>
                </div>

                <div className="rounded-2xl bg-white/70 p-3 dark:bg-white/5">
                  <p className="text-muted-foreground">{t.programs}</p>
                  <p className="mt-1 font-bold">
                    {formatNumber(stats.programs)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/70 p-3 dark:bg-white/5">
                  <p className="text-muted-foreground">{t.memberships}</p>
                  <p className="mt-1 font-bold">
                    {formatNumber(stats.memberships)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/70 p-3 dark:bg-white/5">
                  <p className="text-muted-foreground">{t.services}</p>
                  <p className="mt-1 font-bold">
                    {formatNumber(stats.services)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {topCards.map((item) => {
          const Icon = item.icon;

          return (
            <Card
              key={item.title}
              className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/5"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {item.title}
                    </p>

                    <div className="flex items-center gap-2">
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

                    <p className="text-xs leading-5 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary" />
                  {t.featuredTitle}
                </CardTitle>
                <CardDescription>{t.featuredDesc}</CardDescription>
              </div>

              <Button asChild variant="outline" size="sm" className="rounded-xl">
                <Link href="/system/products/list">
                  <Eye className="h-4 w-4" />
                  {t.view}
                </Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex min-h-[190px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mx-2 h-4 w-4 animate-spin" />
                {t.loading}
              </div>
            ) : featuredProducts.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {featuredProducts.map((product) => {
                  const status = normalizeStatus(product.status);
                  const statusMeta = getStatusMeta(status, locale);
                  const type = normalizeType(product.product_type);

                  return (
                    <div
                      key={product.id}
                      className="rounded-3xl border border-white/20 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold">
                            {product.name || t.unnamedProduct}
                          </h3>

                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {product.code || product.slug || "-"}
                          </p>
                        </div>

                        <Badge
                          className={`rounded-full border px-2.5 py-1 ${statusMeta.className}`}
                        >
                          {statusMeta.label}
                        </Badge>
                      </div>

                      <div className="mb-3 flex flex-wrap gap-2">
                        <Badge variant="secondary" className="rounded-full">
                          <Tag className="h-3.5 w-3.5" />
                          {getTypeLabel(type, locale)}
                        </Badge>

                        <Badge variant="outline" className="rounded-full">
                          {getBillingLabel(
                            normalizeBillingType(product.billing_type),
                            locale
                          )}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">
                          {product.category?.name || t.noCategory}
                        </p>

                        <div className="flex items-center gap-1 font-bold">
                          <span>
                            {formatMoney(
                              product.effective_price || product.price
                            )}
                          </span>

                          <Image
                            src={SAR_ICON_PATH}
                            alt="SAR"
                            width={15}
                            height={15}
                            className="opacity-80"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[190px] items-center justify-center rounded-3xl border border-dashed text-sm text-muted-foreground">
                {t.noFeatured}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {t.statusTitle}
            </CardTitle>
            <CardDescription>{t.statusDesc}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {statusRows.map((row) => {
              const statusMeta = getStatusMeta(row.status, locale);
              const percent = stats.total
                ? Math.round((row.count / stats.total) * 100)
                : 0;

              return (
                <div
                  key={row.status}
                  className="rounded-3xl border border-white/20 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <Badge
                      className={`rounded-full border px-3 py-1 ${statusMeta.className}`}
                    >
                      {statusMeta.label}
                    </Badge>

                    <span className="text-sm font-bold">
                      {formatNumber(row.count)}
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
            })}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-3xl bg-primary/10 p-4">
                <p className="text-xs text-muted-foreground">
                  {t.publicProducts}
                </p>

                <p className="mt-1 text-lg font-bold">
                  {formatNumber(stats.publicProducts)}
                </p>
              </div>

              <div className="rounded-3xl bg-primary/10 p-4">
                <p className="text-xs text-muted-foreground">
                  {t.onlinePurchase}
                </p>

                <p className="mt-1 text-lg font-bold">
                  {formatNumber(stats.onlinePurchase)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {t.latestTitle}
            </CardTitle>

            <CardDescription>{t.latestDesc}</CardDescription>
          </div>

          <div className="relative w-full md:w-[320px]">
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
                  <TableHead>{t.tableProduct}</TableHead>
                  <TableHead>{t.tableType}</TableHead>
                  <TableHead>{t.tablePrice}</TableHead>
                  <TableHead>{t.tableStatus}</TableHead>
                  <TableHead>{t.tableUpdated}</TableHead>
                  <TableHead className="text-center">{t.tableAction}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center">
                      <div className="flex items-center justify-center text-sm text-muted-foreground">
                        <Loader2 className="mx-2 h-4 w-4 animate-spin" />
                        {t.loading}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : latestProducts.length ? (
                  latestProducts.map((product) => {
                    const status = normalizeStatus(product.status);
                    const statusMeta = getStatusMeta(status, locale);
                    const type = normalizeType(product.product_type);

                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="font-semibold">
                              {product.name || t.unnamedProduct}
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {product.code || product.slug || "-"}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium">
                              {getTypeLabel(type, locale)}
                            </span>

                            <span className="text-xs text-muted-foreground">
                              {product.category?.name || t.noCategory}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
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
                        </TableCell>

                        <TableCell>
                          <Badge
                            className={`rounded-full border px-2.5 py-1 ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(
                            product.updated_at || product.created_at,
                            locale
                          )}
                        </TableCell>

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
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t.actionsTitle}
          </CardTitle>

          <CardDescription>{t.actionsDesc}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Link
              href="/system/products/create"
              className="group rounded-3xl border border-white/20 bg-white/70 p-5 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/5"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <Plus className="h-5 w-5" />
              </div>

              <h3 className="font-bold">{t.actionCreateTitle}</h3>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t.actionCreateDesc}
              </p>
            </Link>

            <Link
              href="/system/products/list"
              className="group rounded-3xl border border-white/20 bg-white/70 p-5 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/5"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <Layers3 className="h-5 w-5" />
              </div>

              <h3 className="font-bold">{t.actionListTitle}</h3>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t.actionListDesc}
              </p>
            </Link>

            <Link
              href="/system/products/reports"
              className="group rounded-3xl border border-white/20 bg-white/70 p-5 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/5"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <h3 className="font-bold">{t.actionReportsTitle}</h3>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t.actionReportsDesc}
              </p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}