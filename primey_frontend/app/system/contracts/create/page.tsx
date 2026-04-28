"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarRange,
  FileSignature,
  Loader2,
  Mail,
  Package,
  Percent,
  Phone,
  PlusCircle,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Wallet,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/* ============================================================
   📂 app/system/contracts/create/page.tsx
   🧾 Primey Care | Create Contract
   ------------------------------------------------------------
   ✅ إنشاء عقد جديد
   ✅ ربط مع /api/contracts/
   ✅ ربط مقدمي الخدمة من /api/providers/
   ✅ ربط المنتجات من /api/products/
   ✅ دعم pricing_model
   ✅ دعم discount_percentage
   ✅ دعم system_commission_percentage
   ✅ دعم contract_products
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ الأرقام دائمًا إنجليزية
   ✅ استخدام sonner
   ✅ استخدام رمز SAR الرسمي
   ✅ بدون hardcoded localhost
============================================================ */

type AppLocale = "ar" | "en";

type ContractStatus =
  | "DRAFT"
  | "ACTIVE"
  | "EXPIRED"
  | "TERMINATED"
  | "SUSPENDED";

type PricingModel = "FIXED" | "PERCENTAGE" | "CUSTOM" | "FREE";

type ProviderOption = {
  id: number | string;
  name: string;
  code: string;
  city: string;
  status: string;
};

type ProductOption = {
  id: number | string;
  name: string;
  code: string;
  productType: string;
  status: string;
  price: string;
  salePrice: string;
};

type ContractProductFormRow = {
  localId: string;
  productId: string;
  isActive: boolean;
  specialPrice: string;
  discountPercentage: string;
  coverageNotes: string;
};

type ContractFormData = {
  contractNumber: string;
  title: string;
  providerId: string;
  status: ContractStatus;
  pricingModel: PricingModel;
  startDate: string;
  endDate: string;
  signedAt: string;
  providerContactName: string;
  providerContactPhone: string;
  providerContactEmail: string;
  discountPercentage: string;
  systemCommissionPercentage: string;
  termsAndConditions: string;
  notes: string;
};

type ContractFormErrors = Partial<
  Record<keyof ContractFormData | "contractProducts", string>
>;

type ApiListResponse = {
  ok?: boolean;
  message?: string;
  results?: unknown[];
  data?: unknown[] | { results?: unknown[] };
  items?: unknown[];
  providers?: unknown[];
  products?: unknown[];
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

function getCookie(name: string) {
  if (typeof document === "undefined") return "";

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || "";
  }

  return "";
}

/* ============================================================
   🔢 Helpers
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

function normalizeNumberInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");

  if (parts.length <= 1) return cleaned;

  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function normalizePercentInput(value: string) {
  const cleaned = normalizeNumberInput(value);
  const numeric = Number(cleaned || 0);

  if (!Number.isFinite(numeric)) return "";
  if (numeric > 100) return "100";

  return cleaned;
}

function normalizeApiList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const data = payload as ApiListResponse;

    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.providers)) return data.providers;
    if (Array.isArray(data.products)) return data.products;
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

function readProviderName(value: Record<string, unknown>) {
  return String(
    value.name ??
      value.display_name ??
      value.provider_name ??
      value.center_name ??
      value.company_name ??
      value.title ??
      `Provider #${value.id ?? ""}`
  );
}

function readProductName(value: Record<string, unknown>) {
  return String(
    value.name ??
      value.display_name ??
      value.product_name ??
      value.title ??
      `Product #${value.id ?? ""}`
  );
}

function normalizeProvider(item: unknown): ProviderOption {
  const obj = (item || {}) as Record<string, unknown>;

  return {
    id: (obj.id ?? "") as number | string,
    name: readProviderName(obj),
    code: String(obj.provider_code ?? obj.code ?? obj.center_code ?? ""),
    city: String(obj.city ?? ""),
    status: String(obj.status ?? ""),
  };
}

function normalizeProduct(item: unknown): ProductOption {
  const obj = (item || {}) as Record<string, unknown>;

  return {
    id: (obj.id ?? "") as number | string,
    name: readProductName(obj),
    code: String(obj.product_code ?? obj.code ?? obj.slug ?? ""),
    productType: String(obj.product_type ?? obj.type ?? ""),
    status: String(obj.status ?? ""),
    price: String(obj.price ?? "0"),
    salePrice: String(obj.sale_price ?? obj.salePrice ?? ""),
  };
}

function buildContractNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const suffix = String(now.getTime()).slice(-5);

  return `CONT-${year}${month}${day}-${suffix}`;
}

function newContractProductRow(): ContractProductFormRow {
  return {
    localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId: "",
    isActive: true,
    specialPrice: "",
    discountPercentage: "",
    coverageNotes: "",
  };
}

/* ============================================================
   📚 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "إنشاء عقد" : "Create Contract",
    subtitle: isArabic
      ? "إضافة عقد جديد وربطه بمقدم الخدمة والمنتجات مع نسبة الخصم ونسبة النظام."
      : "Create a new contract and link it to a provider and products with discount and system commission.",

    back: isArabic ? "لوحة العقود" : "Contracts Overview",
    list: isArabic ? "قائمة العقود" : "Contracts List",
    saveDraft: isArabic ? "حفظ مسودة" : "Save Draft",
    create: isArabic ? "إنشاء العقد" : "Create Contract",

    basicInfo: isArabic ? "البيانات الأساسية" : "Basic Information",
    basicInfoDesc: isArabic
      ? "البيانات الرئيسية التي تميز العقد داخل النظام."
      : "Main data that identifies the contract inside the system.",

    providerInfo: isArabic ? "مقدم الخدمة" : "Provider",
    providerInfoDesc: isArabic
      ? "اختيار مقدم الخدمة المرتبط بهذا العقد."
      : "Choose the provider linked to this contract.",

    durationInfo: isArabic ? "مدة العقد" : "Contract Duration",
    durationInfoDesc: isArabic
      ? "تاريخ بداية ونهاية العقد وتاريخ التوقيع."
      : "Contract start, end, and signing dates.",

    financialInfo: isArabic ? "النسب والتسعير" : "Pricing & Percentages",
    financialInfoDesc: isArabic
      ? "آلية التسعير، نسبة الخصم، ونسبة النظام."
      : "Pricing model, discount percentage, and system commission.",

    contactInfo: isArabic ? "مسؤول الجهة" : "Provider Contact",
    contactInfoDesc: isArabic
      ? "بيانات مسؤول مقدم الخدمة داخل العقد."
      : "Provider contact information inside the contract.",

    productsInfo: isArabic ? "المنتجات المشمولة" : "Covered Products",
    productsInfoDesc: isArabic
      ? "ربط المنتجات أو البرامج المشمولة داخل العقد مع أسعار وخصومات خاصة."
      : "Link covered products or programs with special prices and discounts.",

    termsInfo: isArabic ? "الشروط والملاحظات" : "Terms & Notes",
    termsInfoDesc: isArabic
      ? "الشروط والأحكام والملاحظات الداخلية."
      : "Terms, conditions, and internal notes.",

    contractNumber: isArabic ? "رقم العقد" : "Contract Number",
    contractNumberPlaceholder: isArabic
      ? "مثال: CONT-20260428-00001"
      : "Example: CONT-20260428-00001",

    contractTitle: isArabic ? "اسم العقد" : "Contract Title",
    contractTitlePlaceholder: isArabic
      ? "مثال: عقد خصومات مركز طبي"
      : "Example: Medical Center Discount Contract",

    pricingModel: isArabic ? "آلية التسعير" : "Pricing Model",
    status: isArabic ? "الحالة" : "Status",

    provider: isArabic ? "مقدم الخدمة" : "Provider",
    selectProvider: isArabic ? "اختر مقدم الخدمة" : "Select Provider",
    loadingProviders: isArabic
      ? "جاري تحميل مقدمي الخدمة..."
      : "Loading providers...",
    noProviders: isArabic
      ? "لا توجد مراكز/مقدمو خدمة متاحون"
      : "No providers available",

    startDate: isArabic ? "تاريخ البداية" : "Start Date",
    endDate: isArabic ? "تاريخ النهاية" : "End Date",
    signedAt: isArabic ? "تاريخ التوقيع" : "Signed At",

    discountPercentage: isArabic ? "نسبة الخصم العامة" : "General Discount",
    systemCommissionPercentage: isArabic ? "نسبة النظام" : "System Commission",

    providerContactName: isArabic ? "اسم المسؤول" : "Contact Name",
    providerContactPhone: isArabic ? "جوال المسؤول" : "Contact Phone",
    providerContactEmail: isArabic ? "بريد المسؤول" : "Contact Email",

    product: isArabic ? "المنتج / البرنامج" : "Product / Program",
    selectProduct: isArabic ? "اختر المنتج" : "Select Product",
    loadingProducts: isArabic ? "جاري تحميل المنتجات..." : "Loading products...",
    noProducts: isArabic ? "لا توجد منتجات متاحة" : "No products available",
    addProduct: isArabic ? "إضافة منتج" : "Add Product",
    removeProduct: isArabic ? "حذف" : "Remove",
    specialPrice: isArabic ? "سعر خاص" : "Special Price",
    productDiscount: isArabic ? "خصم المنتج" : "Product Discount",
    coverageNotes: isArabic ? "ملاحظات التغطية" : "Coverage Notes",
    activeProduct: isArabic ? "نشط" : "Active",

    termsAndConditions: isArabic ? "الشروط والأحكام" : "Terms & Conditions",
    termsAndConditionsPlaceholder: isArabic
      ? "اكتب شروط وأحكام العقد..."
      : "Write contract terms and conditions...",

    notes: isArabic ? "ملاحظات داخلية" : "Internal Notes",
    notesPlaceholder: isArabic
      ? "أي ملاحظات داخلية حول العقد..."
      : "Any internal notes about the contract...",

    active: isArabic ? "نشط" : "Active",
    draft: isArabic ? "مسودة" : "Draft",
    suspended: isArabic ? "موقوف" : "Suspended",
    expired: isArabic ? "منتهي" : "Expired",
    terminated: isArabic ? "منهى" : "Terminated",

    fixed: isArabic ? "سعر ثابت" : "Fixed",
    percentage: isArabic ? "نسبة" : "Percentage",
    custom: isArabic ? "مخصص" : "Custom",
    free: isArabic ? "مجاني" : "Free",

    required: isArabic ? "هذا الحقل مطلوب" : "This field is required",
    invalidNumber: isArabic ? "القيمة الرقمية غير صحيحة" : "Invalid numeric value",
    invalidPercent: isArabic
      ? "النسبة يجب أن تكون بين 0 و 100"
      : "Percentage must be between 0 and 100",
    invalidDateRange: isArabic
      ? "تاريخ النهاية يجب أن يكون بعد تاريخ البداية"
      : "End date must be after start date",
    selectProviderError: isArabic
      ? "يجب اختيار مقدم الخدمة"
      : "Provider is required",
    duplicateProduct: isArabic
      ? "لا يمكن تكرار نفس المنتج داخل العقد"
      : "The same product cannot be duplicated inside the contract",

    createdSuccess: isArabic
      ? "تم إنشاء العقد بنجاح"
      : "Contract created successfully",
    draftSuccess: isArabic
      ? "تم حفظ العقد كمسودة"
      : "Contract saved as draft",
    createError: isArabic
      ? "تعذر إنشاء العقد"
      : "Failed to create contract",
    providersError: isArabic
      ? "تعذر تحميل مقدمي الخدمة"
      : "Failed to load providers",
    productsError: isArabic
      ? "تعذر تحميل المنتجات"
      : "Failed to load products",

    summaryTitle: isArabic ? "ملخص العقد" : "Contract Summary",
    summaryDesc: isArabic
      ? "مراجعة سريعة قبل حفظ العقد."
      : "Quick review before saving the contract.",
    selectedProvider: isArabic ? "مقدم الخدمة المحدد" : "Selected Provider",
    contractStatus: isArabic ? "حالة العقد" : "Contract Status",
    coveredProducts: isArabic ? "المنتجات المشمولة" : "Covered Products",
    noCoveredProducts: isArabic
      ? "لم يتم إضافة منتجات بعد"
      : "No products added yet",
  };
}

function statusLabel(status: ContractStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<ContractStatus, string> = {
    DRAFT: t.draft,
    ACTIVE: t.active,
    SUSPENDED: t.suspended,
    EXPIRED: t.expired,
    TERMINATED: t.terminated,
  };

  return labels[status];
}

function pricingModelLabel(pricingModel: PricingModel, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<PricingModel, string> = {
    FIXED: t.fixed,
    PERCENTAGE: t.percentage,
    CUSTOM: t.custom,
    FREE: t.free,
  };

  return labels[pricingModel];
}

/* ============================================================
   🧾 Small Components
============================================================ */

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="mt-1 text-xs font-medium text-destructive">{message}</p>;
}

function SarAmount({ amount }: { amount: number | string }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
      <Image
        src={SAR_ICON}
        alt="SAR"
        width={14}
        height={14}
        className="opacity-80"
      />
      {formatEnglishMoney(amount)}
    </span>
  );
}

function PercentValue({ value }: { value: number | string }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
      <Percent className="h-3.5 w-3.5 text-muted-foreground" />
      {formatPercent(value)}
    </span>
  );
}

/* ============================================================
   🧾 Page
============================================================ */

export default function SystemContractsCreatePage() {
  const router = useRouter();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [errors, setErrors] = useState<ContractFormErrors>({});

  const [formData, setFormData] = useState<ContractFormData>({
    contractNumber: buildContractNumber(),
    title: "",
    providerId: "",
    status: "ACTIVE",
    pricingModel: "CUSTOM",
    startDate: "",
    endDate: "",
    signedAt: "",
    providerContactName: "",
    providerContactPhone: "",
    providerContactEmail: "",
    discountPercentage: "",
    systemCommissionPercentage: "",
    termsAndConditions: "",
    notes: "",
  });

  const [contractProducts, setContractProducts] = useState<
    ContractProductFormRow[]
  >([newContractProductRow()]);

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

  async function loadProviders() {
    try {
      setIsLoadingProviders(true);

      const response = await fetch("/api/providers/?page_size=500", {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load providers.");
      }

      const items = normalizeApiList(payload)
        .map(normalizeProvider)
        .filter((provider) => provider.id);

      setProviders(items);
    } catch (error) {
      console.error("Load providers error:", error);
      toast.error(t.providersError);
      setProviders([]);
    } finally {
      setIsLoadingProviders(false);
    }
  }

  async function loadProducts() {
    try {
      setIsLoadingProducts(true);

      const response = await fetch("/api/products/?page_size=500", {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load products.");
      }

      const items = normalizeApiList(payload)
        .map(normalizeProduct)
        .filter((product) => product.id);

      setProducts(items);
    } catch (error) {
      console.error("Load products error:", error);
      toast.error(t.productsError);
      setProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  }

  useEffect(() => {
    loadProviders();
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProvider = useMemo(() => {
    return providers.find(
      (provider) => String(provider.id) === formData.providerId
    );
  }, [providers, formData.providerId]);

  const selectedProductRows = useMemo(() => {
    return contractProducts
      .filter((row) => row.productId)
      .map((row) => {
        const product = products.find(
          (item) => String(item.id) === row.productId
        );

        return {
          ...row,
          product,
        };
      });
  }, [contractProducts, products]);

  function updateField<K extends keyof ContractFormData>(
    key: K,
    value: ContractFormData[K]
  ) {
    setFormData((current) => ({
      ...current,
      [key]: value,
    }));

    setErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
  }

  function updateContractProductRow(
    localId: string,
    patch: Partial<ContractProductFormRow>
  ) {
    setContractProducts((current) =>
      current.map((row) => (row.localId === localId ? { ...row, ...patch } : row))
    );

    setErrors((current) => ({
      ...current,
      contractProducts: undefined,
    }));
  }

  function addContractProductRow() {
    setContractProducts((current) => [...current, newContractProductRow()]);
  }

  function removeContractProductRow(localId: string) {
    setContractProducts((current) => {
      if (current.length <= 1) {
        return [newContractProductRow()];
      }

      return current.filter((row) => row.localId !== localId);
    });
  }

  function isInvalidPercentage(value: string) {
    if (!value) return false;

    const numeric = Number(value);
    return !Number.isFinite(numeric) || numeric < 0 || numeric > 100;
  }

  function validate(nextStatus?: ContractStatus) {
    const nextErrors: ContractFormErrors = {};
    const statusToValidate = nextStatus || formData.status;

    if (!formData.contractNumber.trim()) {
      nextErrors.contractNumber = t.required;
    }

    if (!formData.title.trim()) {
      nextErrors.title = t.required;
    }

    if (!formData.providerId) {
      nextErrors.providerId = t.selectProviderError;
    }

    if (statusToValidate !== "DRAFT") {
      if (!formData.startDate) {
        nextErrors.startDate = t.required;
      }

      if (!formData.endDate) {
        nextErrors.endDate = t.required;
      }
    }

    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);

      if (
        !Number.isNaN(startDate.getTime()) &&
        !Number.isNaN(endDate.getTime()) &&
        endDate < startDate
      ) {
        nextErrors.endDate = t.invalidDateRange;
      }
    }

    if (isInvalidPercentage(formData.discountPercentage)) {
      nextErrors.discountPercentage = t.invalidPercent;
    }

    if (isInvalidPercentage(formData.systemCommissionPercentage)) {
      nextErrors.systemCommissionPercentage = t.invalidPercent;
    }

    const selectedProducts = contractProducts
      .map((row) => row.productId)
      .filter(Boolean);

    const uniqueProducts = new Set(selectedProducts);

    if (selectedProducts.length !== uniqueProducts.size) {
      nextErrors.contractProducts = t.duplicateProduct;
    }

    const hasInvalidProductPercentage = contractProducts.some((row) =>
      isInvalidPercentage(row.discountPercentage)
    );

    if (hasInvalidProductPercentage) {
      nextErrors.contractProducts = t.invalidPercent;
    }

    const hasInvalidSpecialPrice = contractProducts.some((row) => {
      if (!row.specialPrice) return false;

      const numeric = Number(row.specialPrice);
      return !Number.isFinite(numeric) || numeric < 0;
    });

    if (hasInvalidSpecialPrice) {
      nextErrors.contractProducts = t.invalidNumber;
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  function buildPayload(statusOverride?: ContractStatus) {
    const status = statusOverride || formData.status;

    const filteredProducts = contractProducts
      .filter((row) => row.productId)
      .map((row) => ({
        product_id: Number(row.productId),
        is_active: row.isActive,
        special_price: row.specialPrice ? Number(row.specialPrice) : null,
        discount_percentage: row.discountPercentage
          ? Number(row.discountPercentage)
          : 0,
        coverage_notes: row.coverageNotes.trim(),
      }));

    return {
      contract_number: formData.contractNumber.trim(),
      title: formData.title.trim(),
      provider_id: formData.providerId ? Number(formData.providerId) : null,
      status,
      pricing_model: formData.pricingModel,
      start_date: formData.startDate || null,
      end_date: formData.endDate || null,
      signed_at: formData.signedAt || null,
      provider_contact_name: formData.providerContactName.trim(),
      provider_contact_phone: formData.providerContactPhone.trim(),
      provider_contact_email: formData.providerContactEmail.trim(),
      discount_percentage: formData.discountPercentage
        ? Number(formData.discountPercentage)
        : 0,
      system_commission_percentage: formData.systemCommissionPercentage
        ? Number(formData.systemCommissionPercentage)
        : 0,
      terms_and_conditions: formData.termsAndConditions.trim(),
      notes: formData.notes.trim(),
      contract_products: filteredProducts,
    };
  }

  async function submitContract(statusOverride?: ContractStatus) {
    const nextStatus = statusOverride || formData.status;

    if (!validate(nextStatus)) return;

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/contracts/", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify(buildPayload(nextStatus)),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        const serverMessage =
          payload?.message ||
          payload?.errors?.join?.(", ") ||
          payload?.errors ||
          t.createError;

        throw new Error(String(serverMessage));
      }

      toast.success(nextStatus === "DRAFT" ? t.draftSuccess : t.createdSuccess);

      const createdId = payload?.data?.id || payload?.id;

      if (createdId) {
        router.push(`/system/contracts/${createdId}`);
      } else {
        router.push("/system/contracts/list");
      }

      router.refresh();
    } catch (error) {
      console.error("Create contract error:", error);
      toast.error(error instanceof Error ? error.message : t.createError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/80 p-6 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-sky-500/10" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
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
                  {t.title}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                  {t.subtitle}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link href="/system/contracts/list">
                <Button
                  variant="outline"
                  className="rounded-2xl bg-white/70 dark:bg-white/5"
                >
                  <BadgeCheck className="me-2 h-4 w-4" />
                  {t.list}
                </Button>
              </Link>

              <Button
                variant="outline"
                className="rounded-2xl bg-white/70 dark:bg-white/5"
                disabled={isSubmitting}
                onClick={() => submitContract("DRAFT")}
              >
                {isSubmitting ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="me-2 h-4 w-4" />
                )}
                {t.saveDraft}
              </Button>

              <Button
                className="rounded-2xl shadow-lg"
                disabled={isSubmitting}
                onClick={() => submitContract()}
              >
                {isSubmitting ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="me-2 h-4 w-4" />
                )}
                {t.create}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-6">
            {/* Basic Info */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-primary" />
                  {t.basicInfo}
                </CardTitle>
                <CardDescription>{t.basicInfoDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contractNumber">{t.contractNumber}</Label>
                  <Input
                    id="contractNumber"
                    value={formData.contractNumber}
                    onChange={(event) =>
                      updateField("contractNumber", event.target.value)
                    }
                    placeholder={t.contractNumberPlaceholder}
                    className="rounded-2xl bg-white/80 dark:bg-white/5"
                  />
                  <FieldError message={errors.contractNumber} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">{t.contractTitle}</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(event) => updateField("title", event.target.value)}
                    placeholder={t.contractTitlePlaceholder}
                    className="rounded-2xl bg-white/80 dark:bg-white/5"
                  />
                  <FieldError message={errors.title} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pricingModel">{t.pricingModel}</Label>
                  <select
                    id="pricingModel"
                    value={formData.pricingModel}
                    onChange={(event) =>
                      updateField(
                        "pricingModel",
                        event.target.value as PricingModel
                      )
                    }
                    className="h-10 w-full rounded-2xl border border-input bg-white/80 px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring dark:bg-white/5"
                  >
                    <option value="CUSTOM">{t.custom}</option>
                    <option value="PERCENTAGE">{t.percentage}</option>
                    <option value="FIXED">{t.fixed}</option>
                    <option value="FREE">{t.free}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">{t.status}</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(event) =>
                      updateField("status", event.target.value as ContractStatus)
                    }
                    className="h-10 w-full rounded-2xl border border-input bg-white/80 px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring dark:bg-white/5"
                  >
                    <option value="ACTIVE">{t.active}</option>
                    <option value="DRAFT">{t.draft}</option>
                    <option value="SUSPENDED">{t.suspended}</option>
                    <option value="EXPIRED">{t.expired}</option>
                    <option value="TERMINATED">{t.terminated}</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Provider */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {t.providerInfo}
                </CardTitle>
                <CardDescription>{t.providerInfoDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="provider">{t.provider}</Label>
                  <select
                    id="provider"
                    value={formData.providerId}
                    onChange={(event) =>
                      updateField("providerId", event.target.value)
                    }
                    disabled={isLoadingProviders}
                    className="h-10 w-full rounded-2xl border border-input bg-white/80 px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/5"
                  >
                    <option value="">
                      {isLoadingProviders ? t.loadingProviders : t.selectProvider}
                    </option>

                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                        {provider.code ? ` - ${provider.code}` : ""}
                        {provider.city ? ` - ${provider.city}` : ""}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.providerId} />

                  {!isLoadingProviders && providers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t.noProviders}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {/* Duration */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarRange className="h-5 w-5 text-primary" />
                  {t.durationInfo}
                </CardTitle>
                <CardDescription>{t.durationInfoDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-5 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="startDate">{t.startDate}</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(event) =>
                      updateField("startDate", event.target.value)
                    }
                    className="rounded-2xl bg-white/80 dark:bg-white/5"
                  />
                  <FieldError message={errors.startDate} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">{t.endDate}</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(event) => updateField("endDate", event.target.value)}
                    className="rounded-2xl bg-white/80 dark:bg-white/5"
                  />
                  <FieldError message={errors.endDate} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signedAt">{t.signedAt}</Label>
                  <Input
                    id="signedAt"
                    type="date"
                    value={formData.signedAt}
                    onChange={(event) => updateField("signedAt", event.target.value)}
                    className="rounded-2xl bg-white/80 dark:bg-white/5"
                  />
                  <FieldError message={errors.signedAt} />
                </div>
              </CardContent>
            </Card>

            {/* Financial */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  {t.financialInfo}
                </CardTitle>
                <CardDescription>{t.financialInfoDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="discountPercentage">
                    {t.discountPercentage}
                  </Label>
                  <div className="relative">
                    <Percent className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="discountPercentage"
                      inputMode="decimal"
                      value={formData.discountPercentage}
                      onChange={(event) =>
                        updateField(
                          "discountPercentage",
                          normalizePercentInput(event.target.value)
                        )
                      }
                      placeholder="0"
                      className="rounded-2xl bg-white/80 ps-9 dark:bg-white/5"
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                  <FieldError message={errors.discountPercentage} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="systemCommissionPercentage">
                    {t.systemCommissionPercentage}
                  </Label>
                  <div className="relative">
                    <Image
                      src={SAR_ICON}
                      alt="SAR"
                      width={16}
                      height={16}
                      className="absolute start-3 top-1/2 -translate-y-1/2 opacity-70"
                    />
                    <Input
                      id="systemCommissionPercentage"
                      inputMode="decimal"
                      value={formData.systemCommissionPercentage}
                      onChange={(event) =>
                        updateField(
                          "systemCommissionPercentage",
                          normalizePercentInput(event.target.value)
                        )
                      }
                      placeholder="0"
                      className="rounded-2xl bg-white/80 ps-9 dark:bg-white/5"
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                  <FieldError message={errors.systemCommissionPercentage} />
                </div>
              </CardContent>
            </Card>

            {/* Contact */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="h-5 w-5 text-primary" />
                  {t.contactInfo}
                </CardTitle>
                <CardDescription>{t.contactInfoDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-5 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="providerContactName">
                    {t.providerContactName}
                  </Label>
                  <div className="relative">
                    <UserRound className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="providerContactName"
                      value={formData.providerContactName}
                      onChange={(event) =>
                        updateField("providerContactName", event.target.value)
                      }
                      className="rounded-2xl bg-white/80 ps-9 dark:bg-white/5"
                    />
                  </div>
                  <FieldError message={errors.providerContactName} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="providerContactPhone">
                    {t.providerContactPhone}
                  </Label>
                  <div className="relative">
                    <Phone className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="providerContactPhone"
                      value={formData.providerContactPhone}
                      onChange={(event) =>
                        updateField("providerContactPhone", event.target.value)
                      }
                      className="rounded-2xl bg-white/80 ps-9 dark:bg-white/5"
                    />
                  </div>
                  <FieldError message={errors.providerContactPhone} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="providerContactEmail">
                    {t.providerContactEmail}
                  </Label>
                  <div className="relative">
                    <Mail className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="providerContactEmail"
                      type="email"
                      value={formData.providerContactEmail}
                      onChange={(event) =>
                        updateField("providerContactEmail", event.target.value)
                      }
                      className="rounded-2xl bg-white/80 ps-9 dark:bg-white/5"
                    />
                  </div>
                  <FieldError message={errors.providerContactEmail} />
                </div>
              </CardContent>
            </Card>

            {/* Contract Products */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      {t.productsInfo}
                    </CardTitle>
                    <CardDescription>{t.productsInfoDesc}</CardDescription>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    onClick={addContractProductRow}
                  >
                    <PlusCircle className="me-2 h-4 w-4" />
                    {t.addProduct}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <FieldError message={errors.contractProducts} />

                {contractProducts.map((row, index) => (
                  <div
                    key={row.localId}
                    className="rounded-3xl border border-white/20 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <Badge
                        variant="outline"
                        className="rounded-full bg-white/70 dark:bg-white/5"
                      >
                        {t.product} #{formatEnglishNumber(index + 1)}
                      </Badge>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-destructive"
                        onClick={() => removeContractProductRow(row.localId)}
                      >
                        <Trash2 className="me-2 h-4 w-4" />
                        {t.removeProduct}
                      </Button>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr_0.7fr_0.5fr]">
                      <div className="space-y-2">
                        <Label>{t.product}</Label>
                        <select
                          value={row.productId}
                          onChange={(event) =>
                            updateContractProductRow(row.localId, {
                              productId: event.target.value,
                            })
                          }
                          disabled={isLoadingProducts}
                          className="h-10 w-full rounded-2xl border border-input bg-white/80 px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/5"
                        >
                          <option value="">
                            {isLoadingProducts
                              ? t.loadingProducts
                              : t.selectProduct}
                          </option>

                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                              {product.code ? ` - ${product.code}` : ""}
                            </option>
                          ))}
                        </select>

                        {!isLoadingProducts && products.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {t.noProducts}
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label>{t.specialPrice}</Label>
                        <div className="relative">
                          <Image
                            src={SAR_ICON}
                            alt="SAR"
                            width={16}
                            height={16}
                            className="absolute start-3 top-1/2 -translate-y-1/2 opacity-70"
                          />
                          <Input
                            inputMode="decimal"
                            value={row.specialPrice}
                            onChange={(event) =>
                              updateContractProductRow(row.localId, {
                                specialPrice: normalizeNumberInput(
                                  event.target.value
                                ),
                              })
                            }
                            placeholder="0.00"
                            className="rounded-2xl bg-white/80 ps-9 dark:bg-white/5"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{t.productDiscount}</Label>
                        <div className="relative">
                          <Percent className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            inputMode="decimal"
                            value={row.discountPercentage}
                            onChange={(event) =>
                              updateContractProductRow(row.localId, {
                                discountPercentage: normalizePercentInput(
                                  event.target.value
                                ),
                              })
                            }
                            placeholder="0"
                            className="rounded-2xl bg-white/80 ps-9 dark:bg-white/5"
                          />
                          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            %
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{t.activeProduct}</Label>
                        <select
                          value={row.isActive ? "true" : "false"}
                          onChange={(event) =>
                            updateContractProductRow(row.localId, {
                              isActive: event.target.value === "true",
                            })
                          }
                          className="h-10 w-full rounded-2xl border border-input bg-white/80 px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring dark:bg-white/5"
                        >
                          <option value="true">{t.active}</option>
                          <option value="false">{t.suspended}</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label>{t.coverageNotes}</Label>
                      <Textarea
                        value={row.coverageNotes}
                        onChange={(event) =>
                          updateContractProductRow(row.localId, {
                            coverageNotes: event.target.value,
                          })
                        }
                        className="min-h-20 rounded-2xl bg-white/80 dark:bg-white/5"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Terms */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  {t.termsInfo}
                </CardTitle>
                <CardDescription>{t.termsInfoDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-5">
                <div className="space-y-2">
                  <Label htmlFor="termsAndConditions">
                    {t.termsAndConditions}
                  </Label>
                  <Textarea
                    id="termsAndConditions"
                    value={formData.termsAndConditions}
                    onChange={(event) =>
                      updateField("termsAndConditions", event.target.value)
                    }
                    placeholder={t.termsAndConditionsPlaceholder}
                    className="min-h-32 rounded-2xl bg-white/80 dark:bg-white/5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{t.notes}</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(event) => updateField("notes", event.target.value)}
                    placeholder={t.notesPlaceholder}
                    className="min-h-28 rounded-2xl bg-white/80 dark:bg-white/5"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <div className="space-y-6">
            <Card className="sticky top-6 rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {t.summaryTitle}
                </CardTitle>
                <CardDescription>{t.summaryDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-white/20 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs text-muted-foreground">
                    {t.contractTitle}
                  </p>
                  <p className="mt-1 font-semibold">
                    {formData.title || (isArabic ? "غير محدد" : "Not set")}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/20 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs text-muted-foreground">
                    {t.selectedProvider}
                  </p>
                  <p className="mt-1 font-semibold">
                    {selectedProvider?.name ||
                      (isArabic ? "غير محدد" : "Not set")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/20 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs text-muted-foreground">
                      {t.discountPercentage}
                    </p>
                    <p className="mt-1 text-sm">
                      <PercentValue value={formData.discountPercentage || 0} />
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/20 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs text-muted-foreground">
                      {t.systemCommissionPercentage}
                    </p>
                    <p className="mt-1 text-sm">
                      <PercentValue
                        value={formData.systemCommissionPercentage || 0}
                      />
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/20 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs text-muted-foreground">
                    {t.contractStatus}
                  </p>
                  <div className="mt-2">
                    <Badge className="rounded-full border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                      {statusLabel(formData.status, locale)}
                    </Badge>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/20 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs text-muted-foreground">
                    {t.pricingModel}
                  </p>
                  <div className="mt-2">
                    <Badge
                      variant="outline"
                      className="rounded-full bg-white/70 dark:bg-white/5"
                    >
                      {pricingModelLabel(formData.pricingModel, locale)}
                    </Badge>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/20 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs text-muted-foreground">
                    {t.coveredProducts}
                  </p>

                  {selectedProductRows.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t.noCoveredProducts}
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {selectedProductRows.slice(0, 5).map((row) => (
                        <div
                          key={row.localId}
                          className="rounded-xl bg-muted/50 px-3 py-2 text-sm"
                        >
                          <p className="font-medium">
                            {row.product?.name || row.productId}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              {t.productDiscount}:{" "}
                              {formatPercent(row.discountPercentage || 0)}
                            </span>
                            {row.specialPrice ? (
                              <span>
                                {t.specialPrice}:{" "}
                                <SarAmount amount={row.specialPrice} />
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}

                      {selectedProductRows.length > 5 ? (
                        <p className="text-xs text-muted-foreground">
                          +{formatEnglishNumber(selectedProductRows.length - 5)}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    className="rounded-2xl"
                    disabled={isSubmitting}
                    onClick={() => submitContract()}
                  >
                    {isSubmitting ? (
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    ) : (
                      <PlusCircle className="me-2 h-4 w-4" />
                    )}
                    {t.create}
                  </Button>

                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    disabled={isSubmitting}
                    onClick={() => submitContract("DRAFT")}
                  >
                    {isSubmitting ? (
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="me-2 h-4 w-4" />
                    )}
                    {t.saveDraft}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}