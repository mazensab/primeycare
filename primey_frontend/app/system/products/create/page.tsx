"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  FileText,
  Layers3,
  Loader2,
  Package,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Trash2,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* ============================================================
   📂 app/system/products/create/page.tsx
   🧠 Primey Care | Create Product
   ------------------------------------------------------------
   ✅ صفحة إضافة منتج كوحدة مستقلة
   ✅ نفس نمط المراكز / العملاء / المندوبين
   ✅ ربط مع /api/products/
   ✅ ربط التصنيفات مع /api/products/categories/
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ الأرقام دائمًا إنجليزية
   ✅ استخدام UI الداخلي فقط
   ✅ استخدام sonner
   ✅ استخدام رمز SAR من /currency/sar.svg
   ✅ لا يوجد localhost hardcoded
============================================================ */

type AppLocale = "ar" | "en";

type ProductType = "membership" | "card" | "program" | "service" | "other";
type ProductStatus = "draft" | "active" | "inactive" | "archived";
type BillingType = "one_time" | "recurring";
type DurationUnit = "none" | "day" | "month" | "year";

type ProductCategory = {
  id: number | string;
  code?: string | null;
  name?: string | null;
  category_type?: string | null;
  status?: string | null;
};

type CategoriesApiResponse = {
  ok?: boolean;
  message?: string;
  results?: ProductCategory[];
  data?: ProductCategory[];
};

type ProductApiResponse = {
  ok?: boolean;
  message?: string;
  data?: {
    id?: number | string;
  };
  errors?: string[] | Record<string, string[]>;
};

type BenefitForm = {
  title: string;
  description: string;
  sort_order: string;
  is_active: boolean;
};

type PricingTierForm = {
  name: string;
  price: string;
  sale_price: string;
  sort_order: string;
  is_active: boolean;
};

type ProductForm = {
  name: string;
  category_id: string;
  product_type: ProductType;
  status: ProductStatus;
  billing_type: BillingType;

  short_description: string;
  description: string;
  terms_and_conditions: string;
  features: string;
  tags: string;

  currency_code: string;
  price: string;
  sale_price: string;
  cost_price: string;
  is_taxable: boolean;
  tax_rate: string;

  duration_value: string;
  duration_unit: DurationUnit;

  is_public: boolean;
  is_featured: boolean;
  requires_approval: boolean;
  allow_online_purchase: boolean;
  sort_order: string;

  benefits: BenefitForm[];
  pricing_tiers: PricingTierForm[];
};

const SAR_ICON_PATH = "/currency/sar.svg";

const initialForm: ProductForm = {
  name: "",
  category_id: "",
  product_type: "program",
  status: "draft",
  billing_type: "one_time",

  short_description: "",
  description: "",
  terms_and_conditions: "",
  features: "",
  tags: "",

  currency_code: "SAR",
  price: "",
  sale_price: "",
  cost_price: "",
  is_taxable: false,
  tax_rate: "0",

  duration_value: "0",
  duration_unit: "none",

  is_public: true,
  is_featured: false,
  requires_approval: false,
  allow_online_purchase: true,
  sort_order: "0",

  benefits: [],
  pricing_tiers: [],
};

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

function formatMoneyPreview(value: string) {
  const numeric = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function normalizeDecimal(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  return trimmed;
}

function normalizeInt(value: string, fallback = 0) {
  const numeric = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    badge1: "System Products",
    badge2: "Create Product",

    title: isArabic ? "إضافة منتج جديد" : "Create New Product",
    subtitle: isArabic
      ? "إضافة بطاقة أو عضوية أو برنامج أو خدمة وربطها بالتصنيف والتسعير وخيارات البيع."
      : "Add a card, membership, program, or service and connect it to category, pricing, and sales options.",

    back: isArabic ? "رجوع" : "Back",
    dashboard: isArabic ? "لوحة المنتجات" : "Products Dashboard",
    list: isArabic ? "قائمة المنتجات" : "Products List",
    save: isArabic ? "حفظ المنتج" : "Save Product",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",

    mainInfo: isArabic ? "بيانات المنتج الأساسية" : "Main Product Information",
    mainInfoDesc: isArabic
      ? "الاسم، النوع، التصنيف، الحالة وطريقة الفوترة."
      : "Name, type, category, status, and billing method.",

    marketingInfo: isArabic ? "الوصف والمحتوى التسويقي" : "Description & Marketing Content",
    marketingInfoDesc: isArabic
      ? "النصوص التي تظهر في الواجهات والتقارير."
      : "Text displayed in interfaces and reports.",

    pricingInfo: isArabic ? "التسعير والضريبة" : "Pricing & Tax",
    pricingInfoDesc: isArabic
      ? "إعداد سعر المنتج والخصم والتكلفة والضريبة."
      : "Configure product price, discount, cost, and tax.",

    durationInfo: isArabic ? "المدة والصلاحية" : "Duration & Validity",
    durationInfoDesc: isArabic
      ? "إعداد مدة المنتج في حال كان متكررًا أو له صلاحية."
      : "Configure product duration if recurring or validity-based.",

    salesInfo: isArabic ? "خيارات البيع والظهور" : "Sales & Visibility Options",
    salesInfoDesc: isArabic
      ? "تحكم في ظهوره للعامة والشراء الإلكتروني والاعتماد."
      : "Control public visibility, online purchase, and approval.",

    benefitsInfo: isArabic ? "مزايا المنتج" : "Product Benefits",
    benefitsInfoDesc: isArabic
      ? "إضافة مزايا تظهر ضمن تفاصيل المنتج."
      : "Add benefits shown in product details.",

    tiersInfo: isArabic ? "شرائح التسعير" : "Pricing Tiers",
    tiersInfoDesc: isArabic
      ? "إضافة أسعار متعددة عند الحاجة."
      : "Add multiple pricing options when needed.",

    previewTitle: isArabic ? "معاينة المنتج" : "Product Preview",
    previewDesc: isArabic
      ? "ملخص سريع قبل الحفظ."
      : "Quick summary before saving.",

    name: isArabic ? "اسم المنتج" : "Product Name",
    category: isArabic ? "التصنيف" : "Category",
    productType: isArabic ? "نوع المنتج" : "Product Type",
    status: isArabic ? "الحالة" : "Status",
    billingType: isArabic ? "طريقة الفوترة" : "Billing Type",

    shortDescription: isArabic ? "وصف مختصر" : "Short Description",
    description: isArabic ? "الوصف التفصيلي" : "Description",
    terms: isArabic ? "الشروط والأحكام" : "Terms & Conditions",
    features: isArabic ? "الخصائص" : "Features",
    tags: isArabic ? "الوسوم" : "Tags",

    price: isArabic ? "السعر الأساسي" : "Base Price",
    salePrice: isArabic ? "سعر العرض" : "Sale Price",
    costPrice: isArabic ? "التكلفة" : "Cost Price",
    taxRate: isArabic ? "نسبة الضريبة %" : "Tax Rate %",
    currency: isArabic ? "العملة" : "Currency",

    durationValue: isArabic ? "قيمة المدة" : "Duration Value",
    durationUnit: isArabic ? "وحدة المدة" : "Duration Unit",
    sortOrder: isArabic ? "ترتيب العرض" : "Sort Order",

    isTaxable: isArabic ? "خاضع للضريبة" : "Taxable",
    isPublic: isArabic ? "ظاهر للعامة" : "Public",
    isFeatured: isArabic ? "منتج مميز" : "Featured",
    requiresApproval: isArabic ? "يتطلب اعتماد" : "Requires Approval",
    allowOnlinePurchase: isArabic ? "السماح بالشراء الإلكتروني" : "Allow Online Purchase",

    addBenefit: isArabic ? "إضافة ميزة" : "Add Benefit",
    benefitTitle: isArabic ? "عنوان الميزة" : "Benefit Title",
    benefitDescription: isArabic ? "وصف الميزة" : "Benefit Description",

    addTier: isArabic ? "إضافة شريحة" : "Add Tier",
    tierName: isArabic ? "اسم الشريحة" : "Tier Name",
    tierPrice: isArabic ? "سعر الشريحة" : "Tier Price",
    tierSalePrice: isArabic ? "سعر العرض للشريحة" : "Tier Sale Price",

    noCategory: isArabic ? "بدون تصنيف" : "No Category",
    chooseCategory: isArabic ? "اختر التصنيف" : "Choose Category",

    membership: isArabic ? "عضوية" : "Membership",
    card: isArabic ? "بطاقة" : "Card",
    program: isArabic ? "برنامج" : "Program",
    service: isArabic ? "خدمة" : "Service",
    other: isArabic ? "أخرى" : "Other",

    draft: isArabic ? "مسودة" : "Draft",
    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    archived: isArabic ? "مؤرشف" : "Archived",

    oneTime: isArabic ? "مرة واحدة" : "One Time",
    recurring: isArabic ? "متكرر" : "Recurring",

    none: isArabic ? "بدون مدة" : "No Duration",
    day: isArabic ? "يوم" : "Day",
    month: isArabic ? "شهر" : "Month",
    year: isArabic ? "سنة" : "Year",

    remove: isArabic ? "حذف" : "Remove",
    activeItem: isArabic ? "نشط" : "Active",
    requiredName: isArabic ? "اسم المنتج مطلوب" : "Product name is required",
    requiredPrice: isArabic ? "السعر الأساسي مطلوب" : "Base price is required",
    invalidRecurring: isArabic
      ? "المنتج المتكرر يحتاج مدة ووحدة مدة صحيحة"
      : "Recurring product requires a valid duration value and unit",
    loadCategoriesError: isArabic
      ? "تعذر تحميل تصنيفات المنتجات"
      : "Could not load product categories",
    createSuccess: isArabic ? "تم إنشاء المنتج بنجاح" : "Product created successfully",
    createError: isArabic ? "تعذر إنشاء المنتج" : "Could not create product",

    placeholderName: isArabic ? "مثال: بطاقة الرعاية الذهبية" : "Example: Gold Care Card",
    placeholderShort: isArabic
      ? "وصف مختصر يظهر في القائمة..."
      : "Short description shown in list...",
    placeholderDescription: isArabic
      ? "اكتب وصف المنتج التفصيلي..."
      : "Write detailed product description...",
    placeholderTerms: isArabic
      ? "اكتب الشروط والأحكام..."
      : "Write terms and conditions...",
    placeholderFeatures: isArabic
      ? "اكتب الخصائص، كل خاصية في سطر..."
      : "Write features, one per line...",
    placeholderTags: isArabic
      ? "بطاقة، رعاية، خصومات"
      : "card, care, discounts",
    unnamed: isArabic ? "منتج جديد" : "New Product",
  };
}

function TextAreaField({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="min-h-[110px] w-full rounded-2xl border border-input bg-background/70 px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

function SelectField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-2xl border border-input bg-background/70 px-3 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </select>
  );
}

export default function SystemProductsCreatePage() {
  const router = useRouter();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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

  useEffect(() => {
    async function loadCategories() {
      setIsLoadingCategories(true);

      try {
        const response = await fetch("/api/products/categories/?page_size=100", {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        const payload = (await response
          .json()
          .catch(() => ({}))) as CategoriesApiResponse;

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.message || t.loadCategoriesError);
        }

        const rows = Array.isArray(payload.results)
          ? payload.results
          : Array.isArray(payload.data)
            ? payload.data
            : [];

        setCategories(rows);
      } catch (error) {
        console.error("Failed to load product categories:", error);
        toast.error(t.loadCategoriesError);
        setCategories([]);
      } finally {
        setIsLoadingCategories(false);
      }
    }

    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCategory = useMemo(() => {
    return categories.find((item) => String(item.id) === String(form.category_id));
  }, [categories, form.category_id]);

  const productTypeOptions: Array<{ value: ProductType; label: string }> = [
    { value: "membership", label: t.membership },
    { value: "card", label: t.card },
    { value: "program", label: t.program },
    { value: "service", label: t.service },
    { value: "other", label: t.other },
  ];

  const statusOptions: Array<{ value: ProductStatus; label: string }> = [
    { value: "draft", label: t.draft },
    { value: "active", label: t.active },
    { value: "inactive", label: t.inactive },
    { value: "archived", label: t.archived },
  ];

  const billingOptions: Array<{ value: BillingType; label: string }> = [
    { value: "one_time", label: t.oneTime },
    { value: "recurring", label: t.recurring },
  ];

  const durationOptions: Array<{ value: DurationUnit; label: string }> = [
    { value: "none", label: t.none },
    { value: "day", label: t.day },
    { value: "month", label: t.month },
    { value: "year", label: t.year },
  ];

  function updateField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function addBenefit() {
    setForm((current) => ({
      ...current,
      benefits: [
        ...current.benefits,
        {
          title: "",
          description: "",
          sort_order: String(current.benefits.length),
          is_active: true,
        },
      ],
    }));
  }

  function updateBenefit(index: number, patch: Partial<BenefitForm>) {
    setForm((current) => ({
      ...current,
      benefits: current.benefits.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }));
  }

  function removeBenefit(index: number) {
    setForm((current) => ({
      ...current,
      benefits: current.benefits.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function addTier() {
    setForm((current) => ({
      ...current,
      pricing_tiers: [
        ...current.pricing_tiers,
        {
          name: "",
          price: "",
          sale_price: "",
          sort_order: String(current.pricing_tiers.length),
          is_active: true,
        },
      ],
    }));
  }

  function updateTier(index: number, patch: Partial<PricingTierForm>) {
    setForm((current) => ({
      ...current,
      pricing_tiers: current.pricing_tiers.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }));
  }

  function removeTier(index: number) {
    setForm((current) => ({
      ...current,
      pricing_tiers: current.pricing_tiers.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function validateForm() {
    if (!form.name.trim()) {
      toast.error(t.requiredName);
      return false;
    }

    if (!form.price.trim()) {
      toast.error(t.requiredPrice);
      return false;
    }

    if (
      form.billing_type === "recurring" &&
      (normalizeInt(form.duration_value, 0) <= 0 || form.duration_unit === "none")
    ) {
      toast.error(t.invalidRecurring);
      return false;
    }

    return true;
  }

  function buildPayload() {
    const benefits = form.benefits
      .filter((item) => item.title.trim())
      .map((item) => ({
        title: item.title.trim(),
        description: item.description.trim(),
        sort_order: normalizeInt(item.sort_order, 0),
        is_active: item.is_active,
      }));

    const pricingTiers = form.pricing_tiers
      .filter((item) => item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        price: normalizeDecimal(item.price) || "0",
        sale_price: normalizeDecimal(item.sale_price),
        sort_order: normalizeInt(item.sort_order, 0),
        is_active: item.is_active,
      }));

    return {
      name: form.name.trim(),
      category_id: form.category_id || null,
      product_type: form.product_type,
      status: form.status,
      billing_type: form.billing_type,

      short_description: form.short_description.trim(),
      description: form.description.trim(),
      terms_and_conditions: form.terms_and_conditions.trim(),
      features: form.features.trim(),
      tags: form.tags.trim(),

      currency_code: "SAR",
      price: normalizeDecimal(form.price) || "0",
      sale_price: normalizeDecimal(form.sale_price),
      cost_price: normalizeDecimal(form.cost_price),
      is_taxable: form.is_taxable,
      tax_rate: normalizeDecimal(form.tax_rate) || "0",

      duration_value: normalizeInt(form.duration_value, 0),
      duration_unit: form.duration_unit,

      is_public: form.is_public,
      is_featured: form.is_featured,
      requires_approval: form.requires_approval,
      allow_online_purchase: form.allow_online_purchase,
      sort_order: normalizeInt(form.sort_order, 0),

      benefits,
      pricing_tiers: pricingTiers,
    };
  }

  async function handleSubmit() {
    if (!validateForm()) return;

    setIsSaving(true);

    try {
      const response = await fetch("/api/products/", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify(buildPayload()),
      });

      const payload = (await response.json().catch(() => ({}))) as ProductApiResponse;

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message || t.createError);
      }

      toast.success(payload.message || t.createSuccess);
      router.push("/system/products/list");
      router.refresh();
    } catch (error) {
      console.error("Failed to create product:", error);
      toast.error(error instanceof Error ? error.message : t.createError);
    } finally {
      setIsSaving(false);
    }
  }

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
                className="rounded-2xl"
                onClick={handleSubmit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSaving ? t.saving : t.save}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                {t.mainInfo}
              </CardTitle>
              <CardDescription>{t.mainInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>{t.name}</Label>
                <Input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder={t.placeholderName}
                  className="rounded-2xl bg-background/70"
                />
              </div>

              <div className="space-y-2">
                <Label>{t.category}</Label>
                <SelectField
                  value={form.category_id}
                  onChange={(value) => updateField("category_id", value)}
                >
                  <option value="">
                    {isLoadingCategories ? t.loadCategoriesError : t.chooseCategory}
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {category.name || category.code || category.id}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div className="space-y-2">
                <Label>{t.productType}</Label>
                <SelectField
                  value={form.product_type}
                  onChange={(value) => updateField("product_type", value as ProductType)}
                >
                  {productTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div className="space-y-2">
                <Label>{t.status}</Label>
                <SelectField
                  value={form.status}
                  onChange={(value) => updateField("status", value as ProductStatus)}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div className="space-y-2">
                <Label>{t.billingType}</Label>
                <SelectField
                  value={form.billing_type}
                  onChange={(value) => {
                    const nextValue = value as BillingType;
                    setForm((current) => ({
                      ...current,
                      billing_type: nextValue,
                      duration_unit:
                        nextValue === "one_time" ? "none" : current.duration_unit,
                      duration_value:
                        nextValue === "one_time" ? "0" : current.duration_value,
                    }));
                  }}
                >
                  {billingOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {t.marketingInfo}
              </CardTitle>
              <CardDescription>{t.marketingInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label>{t.shortDescription}</Label>
                <Input
                  value={form.short_description}
                  onChange={(event) =>
                    updateField("short_description", event.target.value)
                  }
                  placeholder={t.placeholderShort}
                  className="rounded-2xl bg-background/70"
                />
              </div>

              <div className="space-y-2">
                <Label>{t.description}</Label>
                <TextAreaField
                  value={form.description}
                  onChange={(value) => updateField("description", value)}
                  placeholder={t.placeholderDescription}
                  rows={5}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.features}</Label>
                  <TextAreaField
                    value={form.features}
                    onChange={(value) => updateField("features", value)}
                    placeholder={t.placeholderFeatures}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t.terms}</Label>
                  <TextAreaField
                    value={form.terms_and_conditions}
                    onChange={(value) => updateField("terms_and_conditions", value)}
                    placeholder={t.placeholderTerms}
                    rows={4}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t.tags}</Label>
                <Input
                  value={form.tags}
                  onChange={(event) => updateField("tags", event.target.value)}
                  placeholder={t.placeholderTags}
                  className="rounded-2xl bg-background/70"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-primary" />
                {t.pricingInfo}
              </CardTitle>
              <CardDescription>{t.pricingInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.price}</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(event) => updateField("price", event.target.value)}
                    className="rounded-2xl bg-background/70 ltr:pr-10 rtl:pl-10"
                  />
                  <Image
                    src={SAR_ICON_PATH}
                    alt="SAR"
                    width={16}
                    height={16}
                    className="absolute top-1/2 -translate-y-1/2 opacity-70 ltr:right-3 rtl:left-3"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t.salePrice}</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.sale_price}
                    onChange={(event) =>
                      updateField("sale_price", event.target.value)
                    }
                    className="rounded-2xl bg-background/70 ltr:pr-10 rtl:pl-10"
                  />
                  <Image
                    src={SAR_ICON_PATH}
                    alt="SAR"
                    width={16}
                    height={16}
                    className="absolute top-1/2 -translate-y-1/2 opacity-70 ltr:right-3 rtl:left-3"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t.costPrice}</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cost_price}
                    onChange={(event) =>
                      updateField("cost_price", event.target.value)
                    }
                    className="rounded-2xl bg-background/70 ltr:pr-10 rtl:pl-10"
                  />
                  <Image
                    src={SAR_ICON_PATH}
                    alt="SAR"
                    width={16}
                    height={16}
                    className="absolute top-1/2 -translate-y-1/2 opacity-70 ltr:right-3 rtl:left-3"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t.taxRate}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.tax_rate}
                  onChange={(event) => updateField("tax_rate", event.target.value)}
                  className="rounded-2xl bg-background/70"
                />
              </div>

              <div className="flex items-center gap-3 rounded-2xl border bg-background/50 p-4 md:col-span-2">
                <Checkbox
                  checked={form.is_taxable}
                  onCheckedChange={(checked) =>
                    updateField("is_taxable", Boolean(checked))
                  }
                />
                <Label className="cursor-pointer">{t.isTaxable}</Label>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-primary" />
                {t.durationInfo}
              </CardTitle>
              <CardDescription>{t.durationInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>{t.durationValue}</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.duration_value}
                  onChange={(event) =>
                    updateField("duration_value", event.target.value)
                  }
                  className="rounded-2xl bg-background/70"
                />
              </div>

              <div className="space-y-2">
                <Label>{t.durationUnit}</Label>
                <SelectField
                  value={form.duration_unit}
                  onChange={(value) =>
                    updateField("duration_unit", value as DurationUnit)
                  }
                >
                  {durationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div className="space-y-2">
                <Label>{t.sortOrder}</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.sort_order}
                  onChange={(event) => updateField("sort_order", event.target.value)}
                  className="rounded-2xl bg-background/70"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                {t.salesInfo}
              </CardTitle>
              <CardDescription>{t.salesInfoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-3 md:grid-cols-2">
              {[
                ["is_public", t.isPublic],
                ["is_featured", t.isFeatured],
                ["requires_approval", t.requiresApproval],
                ["allow_online_purchase", t.allowOnlinePurchase],
              ].map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center gap-3 rounded-2xl border bg-background/50 p-4"
                >
                  <Checkbox
                    checked={Boolean(form[key as keyof ProductForm])}
                    onCheckedChange={(checked) =>
                      updateField(key as keyof ProductForm, Boolean(checked) as never)
                    }
                  />
                  <Label className="cursor-pointer">{label}</Label>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {t.benefitsInfo}
                </CardTitle>
                <CardDescription>{t.benefitsInfoDesc}</CardDescription>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={addBenefit}
              >
                <Plus className="h-4 w-4" />
                {t.addBenefit}
              </Button>
            </CardHeader>

            <CardContent className="space-y-3">
              {form.benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="rounded-3xl border bg-background/50 p-4"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <Badge variant="secondary" className="rounded-full">
                      {t.addBenefit} #{index + 1}
                    </Badge>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-destructive"
                      onClick={() => removeBenefit(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t.remove}
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_120px]">
                    <div className="space-y-2">
                      <Label>{t.benefitTitle}</Label>
                      <Input
                        value={benefit.title}
                        onChange={(event) =>
                          updateBenefit(index, { title: event.target.value })
                        }
                        className="rounded-2xl bg-background/70"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t.sortOrder}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={benefit.sort_order}
                        onChange={(event) =>
                          updateBenefit(index, { sort_order: event.target.value })
                        }
                        className="rounded-2xl bg-background/70"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>{t.benefitDescription}</Label>
                      <TextAreaField
                        value={benefit.description}
                        onChange={(value) =>
                          updateBenefit(index, { description: value })
                        }
                        rows={3}
                      />
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl border bg-background/50 p-3 md:col-span-2">
                      <Checkbox
                        checked={benefit.is_active}
                        onCheckedChange={(checked) =>
                          updateBenefit(index, { is_active: Boolean(checked) })
                        }
                      />
                      <Label>{t.activeItem}</Label>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary" />
                  {t.tiersInfo}
                </CardTitle>
                <CardDescription>{t.tiersInfoDesc}</CardDescription>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={addTier}
              >
                <Plus className="h-4 w-4" />
                {t.addTier}
              </Button>
            </CardHeader>

            <CardContent className="space-y-3">
              {form.pricing_tiers.map((tier, index) => (
                <div
                  key={index}
                  className="rounded-3xl border bg-background/50 p-4"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <Badge variant="secondary" className="rounded-full">
                      {t.addTier} #{index + 1}
                    </Badge>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-destructive"
                      onClick={() => removeTier(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t.remove}
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label>{t.tierName}</Label>
                      <Input
                        value={tier.name}
                        onChange={(event) =>
                          updateTier(index, { name: event.target.value })
                        }
                        className="rounded-2xl bg-background/70"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t.tierPrice}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={tier.price}
                        onChange={(event) =>
                          updateTier(index, { price: event.target.value })
                        }
                        className="rounded-2xl bg-background/70"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t.tierSalePrice}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={tier.sale_price}
                        onChange={(event) =>
                          updateTier(index, { sale_price: event.target.value })
                        }
                        className="rounded-2xl bg-background/70"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t.sortOrder}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={tier.sort_order}
                        onChange={(event) =>
                          updateTier(index, { sort_order: event.target.value })
                        }
                        className="rounded-2xl bg-background/70"
                      />
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl border bg-background/50 p-3 md:col-span-3">
                      <Checkbox
                        checked={tier.is_active}
                        onCheckedChange={(checked) =>
                          updateTier(index, { is_active: Boolean(checked) })
                        }
                      />
                      <Label>{t.activeItem}</Label>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                {t.previewTitle}
              </CardTitle>
              <CardDescription>{t.previewDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-3xl border bg-gradient-to-br from-primary/10 via-background/70 to-background p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold">
                      {form.name || t.unnamed}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {form.short_description || t.placeholderShort}
                    </p>
                  </div>

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Package className="h-5 w-5" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full">
                    {productTypeOptions.find((item) => item.value === form.product_type)?.label}
                  </Badge>

                  <Badge variant="secondary" className="rounded-full">
                    {statusOptions.find((item) => item.value === form.status)?.label}
                  </Badge>

                  {form.is_featured ? (
                    <Badge variant="outline" className="rounded-full">
                      <Star className="h-3 w-3" />
                      {t.isFeatured}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl border bg-background/50 p-4">
                  <span className="text-sm text-muted-foreground">{t.price}</span>
                  <div className="flex items-center gap-1 font-bold">
                    <span>{formatMoneyPreview(form.sale_price || form.price)}</span>
                    <Image
                      src={SAR_ICON_PATH}
                      alt="SAR"
                      width={15}
                      height={15}
                      className="opacity-80"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl border bg-background/50 p-4">
                  <span className="text-sm text-muted-foreground">{t.category}</span>
                  <span className="text-sm font-semibold">
                    {selectedCategory?.name || t.noCategory}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl border bg-background/50 p-4">
                  <span className="text-sm text-muted-foreground">
                    {t.billingType}
                  </span>
                  <span className="text-sm font-semibold">
                    {billingOptions.find((item) => item.value === form.billing_type)?.label}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 rounded-2xl border bg-background/50 p-4">
                  {form.is_public ? (
                    <Badge variant="secondary" className="rounded-full">
                      {t.isPublic}
                    </Badge>
                  ) : null}

                  {form.allow_online_purchase ? (
                    <Badge variant="secondary" className="rounded-full">
                      {t.allowOnlinePurchase}
                    </Badge>
                  ) : null}

                  {form.requires_approval ? (
                    <Badge variant="secondary" className="rounded-full">
                      {t.requiresApproval}
                    </Badge>
                  ) : null}

                  {form.is_taxable ? (
                    <Badge variant="secondary" className="rounded-full">
                      {t.isTaxable}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <Button
                type="button"
                className="w-full rounded-2xl"
                onClick={handleSubmit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSaving ? t.saving : t.save}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{t.tags}</span>
              </div>

              <p className="text-sm leading-7 text-muted-foreground">
                {form.tags || t.placeholderTags}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}