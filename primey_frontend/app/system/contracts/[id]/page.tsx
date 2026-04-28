"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarRange,
  CheckCircle2,
  Edit3,
  FileSignature,
  FileText,
  Loader2,
  Mail,
  Package,
  Percent,
  Phone,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Wallet,
  X,
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
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

/* ============================================================
   📂 app/system/contracts/[id]/page.tsx
   🧾 Primey Care | Contract Detail
   ------------------------------------------------------------
   ✅ تفاصيل عقد
   ✅ ربط حقيقي مع /api/contracts/<id>/
   ✅ تعديل سريع للحقول المدعومة في Backend
   ✅ إنهاء آمن للعقد بدل الحذف النهائي
   ✅ دعم status actions
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
  | "SUSPENDED"
  | "UNKNOWN";

type EditableContractStatus =
  | "DRAFT"
  | "ACTIVE"
  | "EXPIRED"
  | "TERMINATED"
  | "SUSPENDED";

type PricingModel = "FIXED" | "PERCENTAGE" | "CUSTOM" | "FREE" | "UNKNOWN";

type EditablePricingModel = "FIXED" | "PERCENTAGE" | "CUSTOM" | "FREE";

type ContractProduct = {
  id: number | string;
  productId: number | string | null;
  productName: string;
  productCode: string;
  productType: string;
  productStatus: string;
  productPrice: number;
  productSalePrice: number | null;
  productEffectivePrice: number;
  isActive: boolean;
  specialPrice: number | null;
  discountPercentage: number;
  coverageNotes: string;
};

type Contract = {
  id: number | string;
  providerId: number | string | null;
  providerName: string;
  providerCode: string;
  providerType: string;
  providerStatus: string;
  contractNumber: string;
  title: string;
  status: ContractStatus;
  pricingModel: PricingModel;
  startDate: string;
  endDate: string;
  signedAt: string;
  providerContactName: string;
  providerContactPhone: string;
  providerContactEmail: string;
  discountPercentage: number;
  systemCommissionPercentage: number;
  notes: string;
  termsAndConditions: string;
  productsCount: number;
  contractProducts: ContractProduct[];
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type ContractFormData = {
  contractNumber: string;
  title: string;
  status: EditableContractStatus;
  pricingModel: EditablePricingModel;
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

type ContractFormErrors = Partial<Record<keyof ContractFormData, string>>;

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

function formatDateTime(value: string, locale: AppLocale) {
  if (!value) return locale === "ar" ? "غير محدد" : "Not set";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);
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

function daysUntil(dateValue: string) {
  if (!dateValue) return null;

  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/* ============================================================
   🔁 API Normalizers
============================================================ */

function normalizeStatus(value: unknown): ContractStatus {
  const status = String(value || "").toUpperCase();

  if (status === "DRAFT") return "DRAFT";
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "EXPIRED") return "EXPIRED";
  if (status === "TERMINATED") return "TERMINATED";
  if (status === "SUSPENDED") return "SUSPENDED";

  return "UNKNOWN";
}

function toEditableStatus(status: ContractStatus): EditableContractStatus {
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "EXPIRED") return "EXPIRED";
  if (status === "TERMINATED") return "TERMINATED";
  if (status === "SUSPENDED") return "SUSPENDED";
  return "DRAFT";
}

function normalizePricingModel(value: unknown): PricingModel {
  const pricingModel = String(value || "").toUpperCase();

  if (pricingModel === "FIXED") return "FIXED";
  if (pricingModel === "PERCENTAGE") return "PERCENTAGE";
  if (pricingModel === "CUSTOM") return "CUSTOM";
  if (pricingModel === "FREE") return "FREE";

  return "UNKNOWN";
}

function toEditablePricingModel(pricingModel: PricingModel): EditablePricingModel {
  if (pricingModel === "FIXED") return "FIXED";
  if (pricingModel === "PERCENTAGE") return "PERCENTAGE";
  if (pricingModel === "FREE") return "FREE";
  return "CUSTOM";
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
      obj.company_name ??
      ""
  );
}

function unwrapContractPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;

  const obj = payload as Record<string, unknown>;

  if (obj.data && typeof obj.data === "object") return obj.data;
  if (obj.contract && typeof obj.contract === "object") return obj.contract;
  if (obj.result && typeof obj.result === "object") return obj.result;

  return payload;
}

function normalizeContractProduct(item: unknown): ContractProduct {
  const obj = (item || {}) as Record<string, unknown>;
  const productObj = obj.product as Record<string, unknown> | undefined;

  return {
    id: (obj.id ?? obj.product_id ?? "-") as number | string,
    productId:
      (obj.product_id as number | string | undefined) ??
      (productObj?.id as number | string | undefined) ??
      null,
    productName: String(
      productObj?.name ??
        obj.product_name ??
        obj.name ??
        readNestedName(obj.product) ??
        "-"
    ),
    productCode: String(productObj?.code ?? obj.product_code ?? obj.code ?? ""),
    productType: String(productObj?.product_type ?? obj.product_type ?? ""),
    productStatus: String(productObj?.status ?? obj.product_status ?? ""),
    productPrice: Number(productObj?.price ?? obj.product_price ?? obj.price ?? 0),
    productSalePrice:
      productObj?.sale_price !== null &&
      productObj?.sale_price !== undefined &&
      productObj?.sale_price !== ""
        ? Number(productObj.sale_price)
        : null,
    productEffectivePrice: Number(
      productObj?.effective_price ??
        obj.product_effective_price ??
        obj.effective_price ??
        productObj?.price ??
        obj.price ??
        0
    ),
    isActive: Boolean(obj.is_active ?? true),
    specialPrice:
      obj.special_price !== null &&
      obj.special_price !== undefined &&
      obj.special_price !== ""
        ? Number(obj.special_price)
        : null,
    discountPercentage: Number(
      obj.discount_percentage ?? obj.discountPercentage ?? 0
    ),
    coverageNotes: String(obj.coverage_notes ?? ""),
  };
}

function normalizeContract(payload: unknown): Contract {
  const obj = (unwrapContractPayload(payload) || {}) as Record<string, unknown>;
  const providerObj = obj.provider as Record<string, unknown> | undefined;

  const contractProducts = Array.isArray(obj.contract_products)
    ? obj.contract_products
    : Array.isArray(obj.products)
      ? obj.products
      : Array.isArray(obj.items)
        ? obj.items
        : [];

  const providerName = String(
    obj.provider_name ??
      obj.center_name ??
      obj.providerName ??
      readNestedName(obj.provider) ??
      "-"
  );

  return {
    id: (obj.id ?? "-") as number | string,
    providerId:
      (obj.provider_id as number | string | undefined) ??
      (providerObj?.id as number | string | undefined) ??
      null,
    providerName,
    providerCode: String(providerObj?.code ?? obj.provider_code ?? ""),
    providerType: String(providerObj?.provider_type ?? obj.provider_type ?? ""),
    providerStatus: String(providerObj?.status ?? obj.provider_status ?? ""),
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
    status: normalizeStatus(obj.status),
    pricingModel: normalizePricingModel(obj.pricing_model ?? obj.pricingModel),
    startDate: String(obj.start_date ?? obj.startDate ?? ""),
    endDate: String(obj.end_date ?? obj.endDate ?? ""),
    signedAt: String(obj.signed_at ?? obj.signedAt ?? ""),
    providerContactName: String(obj.provider_contact_name ?? ""),
    providerContactPhone: String(obj.provider_contact_phone ?? ""),
    providerContactEmail: String(obj.provider_contact_email ?? ""),
    discountPercentage: Number(
      obj.discount_percentage ?? obj.discountPercentage ?? 0
    ),
    systemCommissionPercentage: Number(
      obj.system_commission_percentage ??
        obj.systemCommissionPercentage ??
        obj.commission_rate ??
        0
    ),
    notes: String(obj.notes ?? ""),
    termsAndConditions: String(obj.terms_and_conditions ?? ""),
    productsCount: Number(
      obj.products_count ??
        obj.contract_products_count ??
        obj.items_count ??
        contractProducts.length ??
        0
    ),
    contractProducts: contractProducts.map(normalizeContractProduct),
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
    pageTitle: isArabic ? "تفاصيل العقد" : "Contract Details",
    pageSubtitle: isArabic
      ? "عرض بيانات العقد، مقدم الخدمة، مدة العقد، نسب الخصم، نسبة النظام، والمنتجات المرتبطة."
      : "View contract data, provider, duration, discounts, system commission, and linked products.",

    back: isArabic ? "رجوع" : "Back",
    list: isArabic ? "قائمة العقود" : "Contracts List",
    refresh: isArabic ? "تحديث" : "Refresh",
    edit: isArabic ? "تعديل" : "Edit",
    cancelEdit: isArabic ? "إلغاء التعديل" : "Cancel Edit",
    saveChanges: isArabic ? "حفظ التعديلات" : "Save Changes",
    terminate: isArabic ? "إنهاء العقد" : "Terminate Contract",
    activate: isArabic ? "تفعيل" : "Activate",
    suspend: isArabic ? "إيقاف" : "Suspend",

    overview: isArabic ? "نظرة عامة" : "Overview",
    overviewDesc: isArabic
      ? "البيانات الأساسية والحالة التشغيلية للعقد."
      : "Basic information and operational status of the contract.",

    providerInfo: isArabic ? "مقدم الخدمة" : "Provider",
    providerInfoDesc: isArabic
      ? "معلومات مقدم الخدمة المرتبط بالعقد."
      : "Provider information linked to this contract.",

    durationInfo: isArabic ? "مدة العقد" : "Contract Duration",
    durationDesc: isArabic
      ? "تاريخ بداية العقد ونهايته وتاريخ التوقيع."
      : "Contract start, end, and signing dates.",

    financialInfo: isArabic ? "النسب والتسعير" : "Pricing & Percentages",
    financialDesc: isArabic
      ? "آلية التسعير، نسبة الخصم، ونسبة النظام."
      : "Pricing model, discount percentage, and system commission.",

    contactInfo: isArabic ? "مسؤول الجهة" : "Provider Contact",
    contactDesc: isArabic
      ? "بيانات مسؤول مقدم الخدمة داخل العقد."
      : "Provider contact information inside the contract.",

    termsInfo: isArabic ? "الشروط والملاحظات" : "Terms & Notes",
    productsInfo: isArabic ? "المنتجات المشمولة" : "Covered Products",
    productsInfoDesc: isArabic
      ? "قائمة المنتجات أو البرامج المرتبطة بهذا العقد."
      : "Products or programs linked to this contract.",

    contractNumber: isArabic ? "رقم العقد" : "Contract Number",
    contractTitle: isArabic ? "اسم العقد" : "Contract Title",
    status: isArabic ? "الحالة" : "Status",
    pricingModel: isArabic ? "آلية التسعير" : "Pricing Model",
    provider: isArabic ? "مقدم الخدمة" : "Provider",
    providerCode: isArabic ? "كود مقدم الخدمة" : "Provider Code",
    providerType: isArabic ? "نوع مقدم الخدمة" : "Provider Type",
    providerStatus: isArabic ? "حالة مقدم الخدمة" : "Provider Status",

    startDate: isArabic ? "تاريخ البداية" : "Start Date",
    endDate: isArabic ? "تاريخ النهاية" : "End Date",
    signedAt: isArabic ? "تاريخ التوقيع" : "Signed At",
    remainingDays: isArabic ? "الأيام المتبقية" : "Remaining Days",

    discountPercentage: isArabic ? "نسبة الخصم العامة" : "General Discount",
    systemCommissionPercentage: isArabic ? "نسبة النظام" : "System Commission",

    providerContactName: isArabic ? "اسم المسؤول" : "Contact Name",
    providerContactPhone: isArabic ? "جوال المسؤول" : "Contact Phone",
    providerContactEmail: isArabic ? "بريد المسؤول" : "Contact Email",

    termsAndConditions: isArabic ? "الشروط والأحكام" : "Terms & Conditions",
    notes: isArabic ? "ملاحظات داخلية" : "Internal Notes",
    createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
    updatedAt: isArabic ? "آخر تحديث" : "Updated At",

    product: isArabic ? "المنتج / البرنامج" : "Product / Program",
    productCode: isArabic ? "الكود" : "Code",
    specialPrice: isArabic ? "سعر خاص" : "Special Price",
    effectivePrice: isArabic ? "السعر الفعلي" : "Effective Price",
    discount: isArabic ? "الخصم" : "Discount",
    coverageNotes: isArabic ? "ملاحظات التغطية" : "Coverage Notes",
    productStatus: isArabic ? "الحالة" : "Status",

    active: isArabic ? "نشط" : "Active",
    draft: isArabic ? "مسودة" : "Draft",
    expired: isArabic ? "منتهي" : "Expired",
    terminated: isArabic ? "منهى" : "Terminated",
    suspended: isArabic ? "موقوف" : "Suspended",
    unknown: isArabic ? "غير معروف" : "Unknown",

    fixed: isArabic ? "سعر ثابت" : "Fixed",
    percentage: isArabic ? "نسبة" : "Percentage",
    custom: isArabic ? "مخصص" : "Custom",
    free: isArabic ? "مجاني" : "Free",

    notSet: isArabic ? "غير محدد" : "Not set",
    noProducts: isArabic
      ? "لا توجد منتجات مرتبطة بهذا العقد."
      : "No products are linked to this contract.",

    loading: isArabic ? "جاري تحميل بيانات العقد..." : "Loading contract details...",
    loadError: isArabic
      ? "تعذر تحميل بيانات العقد."
      : "Failed to load contract details.",
    updatedNow: isArabic ? "تم تحديث بيانات العقد" : "Contract data refreshed",
    updateSuccess: isArabic
      ? "تم حفظ تعديلات العقد بنجاح"
      : "Contract changes saved successfully",
    updateError: isArabic
      ? "تعذر حفظ تعديلات العقد"
      : "Failed to save contract changes",
    terminateConfirm: isArabic
      ? "هل أنت متأكد من إنهاء هذا العقد؟ سيتم تغيير حالته إلى منهى ولن يتم حذفه نهائيًا."
      : "Are you sure you want to terminate this contract? Its status will be changed to terminated and it will not be permanently deleted.",
    terminateSuccess: isArabic
      ? "تم إنهاء العقد بنجاح"
      : "Contract terminated successfully",
    terminateError: isArabic ? "تعذر إنهاء العقد" : "Failed to terminate contract",
    statusSuccess: isArabic ? "تم تحديث حالة العقد" : "Contract status updated",
    statusError: isArabic ? "تعذر تحديث حالة العقد" : "Failed to update contract status",

    required: isArabic ? "هذا الحقل مطلوب" : "This field is required",
    invalidPercent: isArabic
      ? "النسبة يجب أن تكون بين 0 و 100"
      : "Percentage must be between 0 and 100",
    invalidDateRange: isArabic
      ? "تاريخ النهاية يجب أن يكون بعد تاريخ البداية"
      : "End date must be after start date",

    days: isArabic ? "يوم" : "days",
    expiredSince: isArabic ? "منتهي منذ" : "Expired since",
  };
}

function statusLabel(status: ContractStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<ContractStatus, string> = {
    DRAFT: t.draft,
    ACTIVE: t.active,
    EXPIRED: t.expired,
    TERMINATED: t.terminated,
    SUSPENDED: t.suspended,
    UNKNOWN: t.unknown,
  };

  return labels[status] || t.unknown;
}

function pricingModelLabel(pricingModel: PricingModel, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<PricingModel, string> = {
    FIXED: t.fixed,
    PERCENTAGE: t.percentage,
    CUSTOM: t.custom,
    FREE: t.free,
    UNKNOWN: t.unknown,
  };

  return labels[pricingModel] || t.unknown;
}

function statusBadgeClass(status: ContractStatus) {
  if (status === "ACTIVE") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "DRAFT") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  if (status === "EXPIRED" || status === "TERMINATED") {
    return "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }

  if (status === "SUSPENDED") {
    return "border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  }

  return "border-muted bg-muted/40 text-muted-foreground";
}

/* ============================================================
   🧾 Small Components
============================================================ */

function SarAmount({ amount }: { amount: number | string | null | undefined }) {
  if (amount === null || amount === undefined || amount === "") {
    return <span>-</span>;
  }

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

function PercentValue({ value }: { value: number | string | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
      <Percent className="h-3.5 w-3.5 text-muted-foreground" />
      {formatPercent(value)}
    </span>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="mt-1 text-xs font-medium text-destructive">{message}</p>;
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

/* ============================================================
   🧾 Page
============================================================ */

export default function SystemContractDetailPage() {
  const params = useParams();
  const router = useRouter();

  const contractId = String(params?.id || "");

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [contract, setContract] = useState<Contract | null>(null);
  const [formData, setFormData] = useState<ContractFormData | null>(null);
  const [errors, setErrors] = useState<ContractFormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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

  function contractToFormData(item: Contract): ContractFormData {
    return {
      contractNumber: item.contractNumber || "",
      title: item.title || "",
      status: toEditableStatus(item.status),
      pricingModel: toEditablePricingModel(item.pricingModel),
      startDate: item.startDate || "",
      endDate: item.endDate || "",
      signedAt: item.signedAt || "",
      providerContactName: item.providerContactName || "",
      providerContactPhone: item.providerContactPhone || "",
      providerContactEmail: item.providerContactEmail || "",
      discountPercentage: item.discountPercentage ? String(item.discountPercentage) : "",
      systemCommissionPercentage: item.systemCommissionPercentage
        ? String(item.systemCommissionPercentage)
        : "",
      termsAndConditions: item.termsAndConditions || "",
      notes: item.notes || "",
    };
  }

  async function loadContract(options?: { silent?: boolean }) {
    if (!contractId) return;

    try {
      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const response = await fetch(`/api/contracts/${contractId}/`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || "Failed to load contract.");
      }

      const item = normalizeContract(payload);
      setContract(item);
      setFormData(contractToFormData(item));

      if (options?.silent) {
        toast.success(t.updatedNow);
      }
    } catch (error) {
      console.error("Load contract error:", error);
      toast.error(t.loadError);
      setContract(null);
      setFormData(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadContract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  const remainingDays = useMemo(() => {
    if (!contract?.endDate) return null;
    return daysUntil(contract.endDate);
  }, [contract?.endDate]);

  const remainingLabel =
    remainingDays === null
      ? t.notSet
      : remainingDays >= 0
        ? `${formatEnglishNumber(remainingDays)} ${t.days}`
        : `${t.expiredSince} ${formatEnglishNumber(Math.abs(remainingDays))} ${t.days}`;

  function updateField<K extends keyof ContractFormData>(
    key: K,
    value: ContractFormData[K]
  ) {
    setFormData((current) => {
      if (!current) return current;

      return {
        ...current,
        [key]: value,
      };
    });

    setErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
  }

  function validateForm() {
    if (!formData) return false;

    const nextErrors: ContractFormErrors = {};

    if (!formData.contractNumber.trim()) {
      nextErrors.contractNumber = t.required;
    }

    if (!formData.title.trim()) {
      nextErrors.title = t.required;
    }

    if (formData.status !== "DRAFT") {
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

    const discount = Number(formData.discountPercentage || 0);
    const commission = Number(formData.systemCommissionPercentage || 0);

    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      nextErrors.discountPercentage = t.invalidPercent;
    }

    if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
      nextErrors.systemCommissionPercentage = t.invalidPercent;
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  function buildUpdatePayload() {
    if (!formData || !contract) return {};

    return {
      provider_id: contract.providerId,
      contract_number: formData.contractNumber.trim(),
      title: formData.title.trim(),
      status: formData.status,
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
    };
  }

  async function handleSave() {
    if (!validateForm()) return;

    try {
      setIsSaving(true);

      const response = await fetch(`/api/contracts/${contractId}/`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify(buildUpdatePayload()),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        const serverMessage =
          payload?.message ||
          payload?.errors?.join?.(", ") ||
          payload?.errors ||
          t.updateError;

        throw new Error(String(serverMessage));
      }

      const item = normalizeContract(payload);
      setContract(item);
      setFormData(contractToFormData(item));
      setIsEditing(false);

      toast.success(t.updateSuccess);
      router.refresh();
    } catch (error) {
      console.error("Update contract error:", error);
      toast.error(error instanceof Error ? error.message : t.updateError);
    } finally {
      setIsSaving(false);
    }
  }

  async function updateContractStatus(action: "activate" | "suspend") {
    try {
      setIsUpdatingStatus(true);

      const response = await fetch(`/api/contracts/${contractId}/${action}/`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || t.statusError);
      }

      const item = normalizeContract(payload);
      setContract(item);
      setFormData(contractToFormData(item));
      setIsEditing(false);

      toast.success(t.statusSuccess);
      router.refresh();
    } catch (error) {
      console.error("Update contract status error:", error);
      toast.error(error instanceof Error ? error.message : t.statusError);
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleTerminate() {
    const confirmed = window.confirm(t.terminateConfirm);
    if (!confirmed) return;

    try {
      setIsTerminating(true);

      const response = await fetch(`/api/contracts/${contractId}/terminate/`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || t.terminateError);
      }

      const item = normalizeContract(payload);
      setContract(item);
      setFormData(contractToFormData(item));
      setIsEditing(false);

      toast.success(t.terminateSuccess);
      router.refresh();
    } catch (error) {
      console.error("Terminate contract error:", error);
      toast.error(error instanceof Error ? error.message : t.terminateError);
    } finally {
      setIsTerminating(false);
    }
  }

  function cancelEditing() {
    if (contract) {
      setFormData(contractToFormData(contract));
    }

    setErrors({});
    setIsEditing(false);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4">
          <div className="flex items-center gap-3 rounded-3xl border border-white/20 bg-white/80 px-6 py-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{t.loading}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!contract || !formData) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
            <CardContent className="flex min-h-80 flex-col items-center justify-center gap-4 text-center">
              <FileSignature className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">{t.loadError}</p>
              <Link href="/system/contracts/list">
                <Button className="rounded-2xl">
                  <ArrowLeft className="me-2 h-4 w-4" />
                  {t.list}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/80 p-6 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-sky-500/10" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/system/contracts/list">
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
                  className={`rounded-full ${statusBadgeClass(contract.status)}`}
                >
                  {statusLabel(contract.status, locale)}
                </Badge>
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {contract.title}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                  {contract.contractNumber} · {contract.providerName}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="rounded-2xl bg-white/70 dark:bg-white/5"
                onClick={() => loadContract({ silent: true })}
                disabled={isRefreshing || isSaving || isTerminating || isUpdatingStatus}
              >
                {isRefreshing ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="me-2 h-4 w-4" />
                )}
                {t.refresh}
              </Button>

              {contract.status !== "ACTIVE" ? (
                <Button
                  variant="outline"
                  className="rounded-2xl bg-white/70 dark:bg-white/5"
                  onClick={() => updateContractStatus("activate")}
                  disabled={isUpdatingStatus || isSaving || isTerminating}
                >
                  {isUpdatingStatus ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="me-2 h-4 w-4" />
                  )}
                  {t.activate}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="rounded-2xl bg-white/70 dark:bg-white/5"
                  onClick={() => updateContractStatus("suspend")}
                  disabled={isUpdatingStatus || isSaving || isTerminating}
                >
                  {isUpdatingStatus ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="me-2 h-4 w-4" />
                  )}
                  {t.suspend}
                </Button>
              )}

              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    className="rounded-2xl bg-white/70 dark:bg-white/5"
                    onClick={cancelEditing}
                    disabled={isSaving}
                  >
                    <X className="me-2 h-4 w-4" />
                    {t.cancelEdit}
                  </Button>

                  <Button
                    className="rounded-2xl shadow-lg"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="me-2 h-4 w-4" />
                    )}
                    {t.saveChanges}
                  </Button>
                </>
              ) : (
                <Button
                  className="rounded-2xl shadow-lg"
                  onClick={() => setIsEditing(true)}
                  disabled={isTerminating}
                >
                  <Edit3 className="me-2 h-4 w-4" />
                  {t.edit}
                </Button>
              )}

              <Button
                variant="destructive"
                className="rounded-2xl"
                onClick={handleTerminate}
                disabled={isTerminating || isSaving || contract.status === "TERMINATED"}
              >
                {isTerminating ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="me-2 h-4 w-4" />
                )}
                {t.terminate}
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t.discountPercentage}
                  </p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">
                    {formatPercent(contract.discountPercentage)}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Percent className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t.systemCommissionPercentage}
                  </p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">
                    {formatPercent(contract.systemCommissionPercentage)}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t.remainingDays}</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    {remainingLabel}
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
                  <p className="text-sm text-muted-foreground">{t.productsInfo}</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">
                    {formatEnglishNumber(contract.productsCount)}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
                  <Package className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-6">
            {/* Overview */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-primary" />
                  {t.overview}
                </CardTitle>
                <CardDescription>{t.overviewDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                {isEditing ? (
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="contractNumber">{t.contractNumber}</Label>
                      <Input
                        id="contractNumber"
                        value={formData.contractNumber}
                        onChange={(event) =>
                          updateField("contractNumber", event.target.value)
                        }
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
                            event.target.value as EditablePricingModel
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
                          updateField(
                            "status",
                            event.target.value as EditableContractStatus
                          )
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
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <InfoRow label={t.contractNumber} value={contract.contractNumber} />
                    <InfoRow label={t.contractTitle} value={contract.title} />
                    <InfoRow
                      label={t.pricingModel}
                      value={pricingModelLabel(contract.pricingModel, locale)}
                    />
                    <InfoRow
                      label={t.status}
                      value={
                        <Badge
                          variant="outline"
                          className={`rounded-full ${statusBadgeClass(contract.status)}`}
                        >
                          {statusLabel(contract.status, locale)}
                        </Badge>
                      }
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Duration */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarRange className="h-5 w-5 text-primary" />
                  {t.durationInfo}
                </CardTitle>
                <CardDescription>{t.durationDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                {isEditing ? (
                  <div className="grid gap-5 md:grid-cols-3">
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
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    <InfoRow label={t.startDate} value={formatDate(contract.startDate, locale)} />
                    <InfoRow label={t.endDate} value={formatDate(contract.endDate, locale)} />
                    <InfoRow label={t.signedAt} value={formatDate(contract.signedAt, locale)} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Financial */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  {t.financialInfo}
                </CardTitle>
                <CardDescription>{t.financialDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                {isEditing ? (
                  <div className="grid gap-5 md:grid-cols-2">
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
                          className="rounded-2xl bg-white/80 ps-9 dark:bg-white/5"
                        />
                        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          %
                        </span>
                      </div>
                      <FieldError message={errors.systemCommissionPercentage} />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <InfoRow
                      label={t.discountPercentage}
                      value={<PercentValue value={contract.discountPercentage} />}
                    />
                    <InfoRow
                      label={t.systemCommissionPercentage}
                      value={<PercentValue value={contract.systemCommissionPercentage} />}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="h-5 w-5 text-primary" />
                  {t.contactInfo}
                </CardTitle>
                <CardDescription>{t.contactDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                {isEditing ? (
                  <div className="grid gap-5 md:grid-cols-3">
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
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    <InfoRow
                      label={t.providerContactName}
                      value={contract.providerContactName || t.notSet}
                    />
                    <InfoRow
                      label={t.providerContactPhone}
                      value={contract.providerContactPhone || t.notSet}
                    />
                    <InfoRow
                      label={t.providerContactEmail}
                      value={contract.providerContactEmail || t.notSet}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Terms */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  {t.termsInfo}
                </CardTitle>
              </CardHeader>

              <CardContent>
                {isEditing ? (
                  <div className="grid gap-5">
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
                        className="min-h-32 rounded-2xl bg-white/80 dark:bg-white/5"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">{t.notes}</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(event) => updateField("notes", event.target.value)}
                        className="min-h-28 rounded-2xl bg-white/80 dark:bg-white/5"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    <InfoRow
                      label={t.termsAndConditions}
                      value={contract.termsAndConditions || t.notSet}
                    />
                    <InfoRow label={t.notes} value={contract.notes || t.notSet} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Products */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {t.productsInfo}
                </CardTitle>
                <CardDescription>{t.productsInfoDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                {contract.contractProducts.length === 0 ? (
                  <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-center text-muted-foreground">
                    <FileText className="h-10 w-10 opacity-60" />
                    <p>{t.noProducts}</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/70 dark:border-white/10 dark:bg-white/5">
                    <Table>
                      <TableBody>
                        {contract.contractProducts.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <p className="font-semibold">{item.productName}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {item.productCode || item.productType || "-"}
                                </p>
                              </div>
                            </TableCell>

                            <TableCell>
                              <p className="text-xs text-muted-foreground">
                                {t.discount}
                              </p>
                              <p className="font-semibold">
                                {formatPercent(item.discountPercentage)}
                              </p>
                            </TableCell>

                            <TableCell>
                              <p className="text-xs text-muted-foreground">
                                {t.specialPrice}
                              </p>
                              <SarAmount amount={item.specialPrice} />
                            </TableCell>

                            <TableCell>
                              <p className="text-xs text-muted-foreground">
                                {t.effectivePrice}
                              </p>
                              <SarAmount amount={item.productEffectivePrice} />
                            </TableCell>

                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`rounded-full ${
                                  item.isActive
                                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                {item.isActive ? t.active : t.suspended}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Side */}
          <div className="space-y-6">
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {t.providerInfo}
                </CardTitle>
                <CardDescription>{t.providerInfoDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <InfoRow label={t.provider} value={contract.providerName || t.notSet} />
                <InfoRow
                  label={t.providerCode}
                  value={contract.providerCode || t.notSet}
                />
                <InfoRow
                  label={t.providerType}
                  value={contract.providerType || t.notSet}
                />
                <InfoRow
                  label={t.providerStatus}
                  value={contract.providerStatus || t.notSet}
                />

                {contract.providerId ? (
                  <Link href={`/system/providers/${contract.providerId}`}>
                    <Button variant="outline" className="w-full rounded-2xl">
                      <Building2 className="me-2 h-4 w-4" />
                      {isArabic ? "عرض مقدم الخدمة" : "View Provider"}
                    </Button>
                  </Link>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {isArabic ? "تتبع السجل" : "Record Tracking"}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <InfoRow label={t.createdAt} value={formatDateTime(contract.createdAt, locale)} />
                <InfoRow label={t.updatedAt} value={formatDateTime(contract.updatedAt, locale)} />
                <InfoRow label={t.remainingDays} value={remainingLabel} />
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-3xl border-white/20 bg-primary text-primary-foreground shadow-lg dark:border-white/10">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                    <BadgeCheck className="h-6 w-6" />
                  </div>

                  <div>
                    <h3 className="font-bold">
                      {isArabic ? "عقد مربوط بالنظام" : "System-linked Contract"}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-primary-foreground/80">
                      {isArabic
                        ? "هذه الصفحة تعرض العقد حسب Backend الجديد مع دعم نسبة الخصم، نسبة النظام، والمنتجات المشمولة."
                        : "This page displays the contract using the new backend fields with discount, system commission, and covered products."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}