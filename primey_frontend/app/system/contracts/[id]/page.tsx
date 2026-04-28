"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  HandCoins,
  Landmark,
  Loader2,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
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
   ✅ صفحة تفاصيل العقد بنفس نمط المراكز / العملاء / المندوبين / المنتجات
   ✅ ربط حقيقي مع /api/contracts/<id>/
   ✅ عرض + تعديل سريع + حذف
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ الأرقام دائمًا إنجليزية
   ✅ استخدام UI الداخلي فقط
   ✅ استخدام sonner
   ✅ استخدام رمز SAR الرسمي
   ✅ بدون hardcoded localhost
============================================================ */

type AppLocale = "ar" | "en";

type ContractStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "DRAFT"
  | "PENDING"
  | "EXPIRED"
  | "TERMINATED"
  | "CANCELLED"
  | "SUSPENDED"
  | "UNKNOWN";

type ContractType =
  | "GENERAL"
  | "MEDICAL"
  | "SERVICE"
  | "PARTNERSHIP"
  | "DISCOUNT"
  | "SUPPLY"
  | "OTHER"
  | "UNKNOWN";

type ContractProduct = {
  id: number | string;
  productId: number | string | null;
  productName: string;
  serviceName: string;
  discountRate: number;
  commissionRate: number;
  price: number;
  status: string;
};

type Contract = {
  id: number | string;
  contractNumber: string;
  title: string;
  providerName: string;
  providerId: number | string | null;
  contractType: ContractType;
  status: ContractStatus;
  startDate: string;
  endDate: string;
  contractValue: number;
  commissionRate: number;
  currency: string;
  paymentTerms: string;
  renewalTerms: string;
  terminationTerms: string;
  notes: string;
  productsCount: number;
  contractProducts: ContractProduct[];
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type ContractFormData = {
  contractNumber: string;
  title: string;
  contractType: ContractType;
  status: ContractStatus;
  startDate: string;
  endDate: string;
  contractValue: string;
  commissionRate: string;
  currency: string;
  paymentTerms: string;
  renewalTerms: string;
  terminationTerms: string;
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
  return value.replace(/[^\d.]/g, "");
}

function normalizePercentInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
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

  if (status === "ACTIVE") return "ACTIVE";
  if (status === "INACTIVE") return "INACTIVE";
  if (status === "DRAFT") return "DRAFT";
  if (status === "PENDING") return "PENDING";
  if (status === "EXPIRED") return "EXPIRED";
  if (status === "TERMINATED") return "TERMINATED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "SUSPENDED") return "SUSPENDED";

  if (value === true) return "ACTIVE";
  if (value === false) return "INACTIVE";

  return "UNKNOWN";
}

function normalizeContractType(value: unknown): ContractType {
  const contractType = String(value || "").toUpperCase();

  if (contractType === "GENERAL") return "GENERAL";
  if (contractType === "MEDICAL") return "MEDICAL";
  if (contractType === "SERVICE") return "SERVICE";
  if (contractType === "PARTNERSHIP") return "PARTNERSHIP";
  if (contractType === "DISCOUNT") return "DISCOUNT";
  if (contractType === "SUPPLY") return "SUPPLY";
  if (contractType === "OTHER") return "OTHER";

  return "UNKNOWN";
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
      obj.product_name ??
        obj.name ??
        readNestedName(obj.product) ??
        "-"
    ),
    serviceName: String(
      obj.service_name ??
        obj.service ??
        obj.item_name ??
        obj.title ??
        "-"
    ),
    discountRate: Number(obj.discount_rate ?? obj.discountRate ?? 0),
    commissionRate: Number(obj.commission_rate ?? obj.commissionRate ?? 0),
    price: Number(obj.price ?? obj.amount ?? obj.value ?? 0),
    status: String(obj.status ?? ""),
  };
}

function unwrapContractPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;

  const obj = payload as Record<string, unknown>;

  if (obj.data && typeof obj.data === "object") return obj.data;
  if (obj.contract && typeof obj.contract === "object") return obj.contract;
  if (obj.result && typeof obj.result === "object") return obj.result;

  return payload;
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

  return {
    id: (obj.id ?? "-") as number | string,
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
    providerName: String(
      obj.provider_name ??
        obj.center_name ??
        obj.providerName ??
        readNestedName(obj.provider) ??
        "-"
    ),
    providerId:
      (obj.provider_id as number | string | undefined) ??
      (providerObj?.id as number | string | undefined) ??
      null,
    contractType: normalizeContractType(
      obj.contract_type ?? obj.contractType ?? obj.type
    ),
    status: normalizeStatus(obj.status ?? obj.is_active),
    startDate: String(obj.start_date ?? obj.startDate ?? ""),
    endDate: String(obj.end_date ?? obj.endDate ?? ""),
    contractValue: Number(
      obj.contract_value ??
        obj.contractValue ??
        obj.total_value ??
        obj.value ??
        obj.amount ??
        0
    ),
    commissionRate: Number(
      obj.commission_rate ?? obj.commissionRate ?? obj.rate ?? 0
    ),
    currency: String(obj.currency ?? "SAR"),
    paymentTerms: String(obj.payment_terms ?? obj.paymentTerms ?? ""),
    renewalTerms: String(obj.renewal_terms ?? obj.renewalTerms ?? ""),
    terminationTerms: String(obj.termination_terms ?? obj.terminationTerms ?? ""),
    notes: String(obj.notes ?? obj.description ?? ""),
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
      ? "عرض بيانات العقد، مقدم الخدمة، المدة، القيمة، الشروط، والخدمات المرتبطة."
      : "View contract data, provider, duration, value, terms, and linked services.",

    back: isArabic ? "رجوع" : "Back",
    list: isArabic ? "قائمة العقود" : "Contracts List",
    refresh: isArabic ? "تحديث" : "Refresh",
    edit: isArabic ? "تعديل" : "Edit",
    cancelEdit: isArabic ? "إلغاء التعديل" : "Cancel Edit",
    saveChanges: isArabic ? "حفظ التعديلات" : "Save Changes",
    delete: isArabic ? "حذف العقد" : "Delete Contract",

    overview: isArabic ? "نظرة عامة" : "Overview",
    overviewDesc: isArabic
      ? "البيانات الأساسية والحالة التشغيلية للعقد."
      : "Basic information and operational status of the contract.",

    providerInfo: isArabic ? "مقدم الخدمة" : "Provider",
    providerInfoDesc: isArabic
      ? "معلومات مقدم الخدمة المرتبط بالعقد."
      : "Provider information linked to this contract.",

    durationInfo: isArabic ? "مدة العقد" : "Contract Duration",
    financialInfo: isArabic ? "البيانات المالية" : "Financial Information",
    termsInfo: isArabic ? "الشروط والملاحظات" : "Terms & Notes",
    productsInfo: isArabic ? "الخدمات / المنتجات المرتبطة" : "Linked Services / Products",
    productsInfoDesc: isArabic
      ? "قائمة الخدمات أو المنتجات المرتبطة بهذا العقد إن وجدت."
      : "Services or products linked to this contract if available.",

    contractNumber: isArabic ? "رقم العقد" : "Contract Number",
    contractTitle: isArabic ? "اسم العقد" : "Contract Title",
    contractType: isArabic ? "نوع العقد" : "Contract Type",
    status: isArabic ? "الحالة" : "Status",
    provider: isArabic ? "مقدم الخدمة" : "Provider",
    startDate: isArabic ? "تاريخ البداية" : "Start Date",
    endDate: isArabic ? "تاريخ النهاية" : "End Date",
    remainingDays: isArabic ? "الأيام المتبقية" : "Remaining Days",
    contractValue: isArabic ? "قيمة العقد" : "Contract Value",
    commissionRate: isArabic ? "نسبة العمولة" : "Commission Rate",
    commissionPreview: isArabic ? "العمولة التقديرية" : "Estimated Commission",
    currency: isArabic ? "العملة" : "Currency",
    paymentTerms: isArabic ? "شروط الدفع" : "Payment Terms",
    renewalTerms: isArabic ? "شروط التجديد" : "Renewal Terms",
    terminationTerms: isArabic ? "شروط الإنهاء" : "Termination Terms",
    notes: isArabic ? "ملاحظات داخلية" : "Internal Notes",
    createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
    updatedAt: isArabic ? "آخر تحديث" : "Updated At",

    product: isArabic ? "المنتج / الخدمة" : "Product / Service",
    discount: isArabic ? "الخصم" : "Discount",
    commission: isArabic ? "العمولة" : "Commission",
    price: isArabic ? "السعر" : "Price",

    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    draft: isArabic ? "مسودة" : "Draft",
    pending: isArabic ? "معلق" : "Pending",
    expired: isArabic ? "منتهي" : "Expired",
    terminated: isArabic ? "منهى" : "Terminated",
    cancelled: isArabic ? "ملغي" : "Cancelled",
    suspended: isArabic ? "موقوف" : "Suspended",
    unknown: isArabic ? "غير معروف" : "Unknown",

    general: isArabic ? "عام" : "General",
    medical: isArabic ? "طبي" : "Medical",
    service: isArabic ? "خدمة" : "Service",
    partnership: isArabic ? "شراكة" : "Partnership",
    discountType: isArabic ? "خصومات" : "Discount",
    supply: isArabic ? "توريد" : "Supply",
    other: isArabic ? "أخرى" : "Other",

    sar: isArabic ? "ريال سعودي" : "Saudi Riyal",
    notSet: isArabic ? "غير محدد" : "Not set",
    noProducts: isArabic
      ? "لا توجد خدمات أو منتجات مرتبطة بهذا العقد."
      : "No services or products are linked to this contract.",

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
    deleteConfirm: isArabic
      ? "هل أنت متأكد من حذف هذا العقد؟ لا يمكن التراجع عن هذه العملية."
      : "Are you sure you want to delete this contract? This action cannot be undone.",
    deleteSuccess: isArabic ? "تم حذف العقد بنجاح" : "Contract deleted successfully",
    deleteError: isArabic ? "تعذر حذف العقد" : "Failed to delete contract",

    required: isArabic ? "هذا الحقل مطلوب" : "This field is required",
    invalidNumber: isArabic ? "القيمة الرقمية غير صحيحة" : "Invalid numeric value",
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
    ACTIVE: t.active,
    INACTIVE: t.inactive,
    DRAFT: t.draft,
    PENDING: t.pending,
    EXPIRED: t.expired,
    TERMINATED: t.terminated,
    CANCELLED: t.cancelled,
    SUSPENDED: t.suspended,
    UNKNOWN: t.unknown,
  };

  return labels[status] || t.unknown;
}

function typeLabel(type: ContractType, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<ContractType, string> = {
    GENERAL: t.general,
    MEDICAL: t.medical,
    SERVICE: t.service,
    PARTNERSHIP: t.partnership,
    DISCOUNT: t.discountType,
    SUPPLY: t.supply,
    OTHER: t.other,
    UNKNOWN: t.unknown,
  };

  return labels[type] || t.unknown;
}

function statusBadgeClass(status: ContractStatus) {
  if (status === "ACTIVE") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "DRAFT" || status === "PENDING") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  if (status === "EXPIRED" || status === "TERMINATED" || status === "CANCELLED") {
    return "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }

  if (status === "SUSPENDED" || status === "INACTIVE") {
    return "border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300";
  }

  return "border-muted bg-muted/40 text-muted-foreground";
}

/* ============================================================
   🧾 Small Components
============================================================ */

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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="mt-1 text-xs font-medium text-destructive">{message}</p>;
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
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
  const [isDeleting, setIsDeleting] = useState(false);

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
      contractType: item.contractType === "UNKNOWN" ? "GENERAL" : item.contractType,
      status: item.status === "UNKNOWN" ? "DRAFT" : item.status,
      startDate: item.startDate || "",
      endDate: item.endDate || "",
      contractValue: item.contractValue ? String(item.contractValue) : "",
      commissionRate: item.commissionRate ? String(item.commissionRate) : "",
      currency: item.currency || "SAR",
      paymentTerms: item.paymentTerms || "",
      renewalTerms: item.renewalTerms || "",
      terminationTerms: item.terminationTerms || "",
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

  const commissionPreview = useMemo(() => {
    if (!contract) return 0;
    return (Number(contract.contractValue || 0) * Number(contract.commissionRate || 0)) / 100;
  }, [contract]);

  const editCommissionPreview = useMemo(() => {
    if (!formData) return 0;

    const amount = Number(formData.contractValue || 0);
    const rate = Number(formData.commissionRate || 0);

    if (!Number.isFinite(amount) || !Number.isFinite(rate)) return 0;

    return (amount * rate) / 100;
  }, [formData]);

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

    if (formData.contractValue && !Number.isFinite(Number(formData.contractValue))) {
      nextErrors.contractValue = t.invalidNumber;
    }

    if (formData.commissionRate && !Number.isFinite(Number(formData.commissionRate))) {
      nextErrors.commissionRate = t.invalidNumber;
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  function buildUpdatePayload() {
    if (!formData) return {};

    return {
      contract_number: formData.contractNumber.trim(),
      title: formData.title.trim(),
      name: formData.title.trim(),
      contract_type: formData.contractType,
      type: formData.contractType,
      status: formData.status,
      start_date: formData.startDate || null,
      end_date: formData.endDate || null,
      contract_value: formData.contractValue ? Number(formData.contractValue) : 0,
      value: formData.contractValue ? Number(formData.contractValue) : 0,
      commission_rate: formData.commissionRate ? Number(formData.commissionRate) : 0,
      currency: formData.currency || "SAR",
      payment_terms: formData.paymentTerms.trim(),
      renewal_terms: formData.renewalTerms.trim(),
      termination_terms: formData.terminationTerms.trim(),
      notes: formData.notes.trim(),
      description: formData.notes.trim(),
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

  async function handleDelete() {
    const confirmed = window.confirm(t.deleteConfirm);
    if (!confirmed) return;

    try {
      setIsDeleting(true);

      const response = await fetch(`/api/contracts/${contractId}/`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || t.deleteError);
      }

      toast.success(t.deleteSuccess);
      router.push("/system/contracts/list");
      router.refresh();
    } catch (error) {
      console.error("Delete contract error:", error);
      toast.error(error instanceof Error ? error.message : t.deleteError);
    } finally {
      setIsDeleting(false);
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

  const remainingLabel =
    remainingDays === null
      ? t.notSet
      : remainingDays >= 0
        ? `${formatEnglishNumber(remainingDays)} ${t.days}`
        : `${t.expiredSince} ${formatEnglishNumber(Math.abs(remainingDays))} ${t.days}`;

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
                disabled={isRefreshing || isSaving || isDeleting}
              >
                {isRefreshing ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="me-2 h-4 w-4" />
                )}
                {t.refresh}
              </Button>

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
                  disabled={isDeleting}
                >
                  <Edit3 className="me-2 h-4 w-4" />
                  {t.edit}
                </Button>
              )}

              <Button
                variant="destructive"
                className="rounded-2xl"
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
              >
                {isDeleting ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="me-2 h-4 w-4" />
                )}
                {t.delete}
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
                  <p className="text-sm text-muted-foreground">{t.contractValue}</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    <SarAmount amount={contract.contractValue} />
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t.commissionRate}</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">
                    {formatPercent(contract.commissionRate)}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                  <HandCoins className="h-5 w-5" />
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
                  <Sparkles className="h-5 w-5" />
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
                      <Label htmlFor="contractType">{t.contractType}</Label>
                      <select
                        id="contractType"
                        value={formData.contractType}
                        onChange={(event) =>
                          updateField("contractType", event.target.value as ContractType)
                        }
                        className="h-10 w-full rounded-2xl border border-input bg-white/80 px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring dark:bg-white/5"
                      >
                        <option value="GENERAL">{t.general}</option>
                        <option value="MEDICAL">{t.medical}</option>
                        <option value="SERVICE">{t.service}</option>
                        <option value="PARTNERSHIP">{t.partnership}</option>
                        <option value="DISCOUNT">{t.discountType}</option>
                        <option value="SUPPLY">{t.supply}</option>
                        <option value="OTHER">{t.other}</option>
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
                        <option value="PENDING">{t.pending}</option>
                        <option value="INACTIVE">{t.inactive}</option>
                        <option value="SUSPENDED">{t.suspended}</option>
                        <option value="EXPIRED">{t.expired}</option>
                        <option value="TERMINATED">{t.terminated}</option>
                        <option value="CANCELLED">{t.cancelled}</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <InfoRow label={t.contractNumber} value={contract.contractNumber} />
                    <InfoRow label={t.contractTitle} value={contract.title} />
                    <InfoRow
                      label={t.contractType}
                      value={typeLabel(contract.contractType, locale)}
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

            {/* Duration + Financial */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarRange className="h-5 w-5 text-primary" />
                    {t.durationInfo}
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  {isEditing ? (
                    <div className="grid gap-5">
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
                          onChange={(event) =>
                            updateField("endDate", event.target.value)
                          }
                          className="rounded-2xl bg-white/80 dark:bg-white/5"
                        />
                        <FieldError message={errors.endDate} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      <InfoRow label={t.startDate} value={formatDate(contract.startDate, locale)} />
                      <InfoRow label={t.endDate} value={formatDate(contract.endDate, locale)} />
                      <InfoRow label={t.remainingDays} value={remainingLabel} />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    {t.financialInfo}
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  {isEditing ? (
                    <div className="grid gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="contractValue">{t.contractValue}</Label>
                        <div className="relative">
                          <Image
                            src={SAR_ICON}
                            alt="SAR"
                            width={16}
                            height={16}
                            className="absolute start-3 top-1/2 -translate-y-1/2 opacity-70"
                          />
                          <Input
                            id="contractValue"
                            inputMode="decimal"
                            value={formData.contractValue}
                            onChange={(event) =>
                              updateField(
                                "contractValue",
                                normalizeNumberInput(event.target.value)
                              )
                            }
                            className="rounded-2xl bg-white/80 ps-9 dark:bg-white/5"
                          />
                        </div>
                        <FieldError message={errors.contractValue} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="commissionRate">{t.commissionRate}</Label>
                        <div className="relative">
                          <HandCoins className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="commissionRate"
                            inputMode="decimal"
                            value={formData.commissionRate}
                            onChange={(event) =>
                              updateField(
                                "commissionRate",
                                normalizePercentInput(event.target.value)
                              )
                            }
                            className="rounded-2xl bg-white/80 ps-9 dark:bg-white/5"
                          />
                          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            %
                          </span>
                        </div>
                        <FieldError message={errors.commissionRate} />
                      </div>

                      <InfoRow
                        label={t.commissionPreview}
                        value={<SarAmount amount={editCommissionPreview} />}
                      />
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      <InfoRow
                        label={t.contractValue}
                        value={<SarAmount amount={contract.contractValue} />}
                      />
                      <InfoRow
                        label={t.commissionRate}
                        value={formatPercent(contract.commissionRate)}
                      />
                      <InfoRow
                        label={t.commissionPreview}
                        value={<SarAmount amount={commissionPreview} />}
                      />
                      <InfoRow label={t.currency} value={contract.currency || "SAR"} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Terms */}
            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-primary" />
                  {t.termsInfo}
                </CardTitle>
              </CardHeader>

              <CardContent>
                {isEditing ? (
                  <div className="grid gap-5">
                    <div className="grid gap-5 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="paymentTerms">{t.paymentTerms}</Label>
                        <Textarea
                          id="paymentTerms"
                          value={formData.paymentTerms}
                          onChange={(event) =>
                            updateField("paymentTerms", event.target.value)
                          }
                          className="min-h-28 rounded-2xl bg-white/80 dark:bg-white/5"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="renewalTerms">{t.renewalTerms}</Label>
                        <Textarea
                          id="renewalTerms"
                          value={formData.renewalTerms}
                          onChange={(event) =>
                            updateField("renewalTerms", event.target.value)
                          }
                          className="min-h-28 rounded-2xl bg-white/80 dark:bg-white/5"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="terminationTerms">{t.terminationTerms}</Label>
                        <Textarea
                          id="terminationTerms"
                          value={formData.terminationTerms}
                          onChange={(event) =>
                            updateField("terminationTerms", event.target.value)
                          }
                          className="min-h-28 rounded-2xl bg-white/80 dark:bg-white/5"
                        />
                      </div>
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
                    <InfoRow label={t.paymentTerms} value={contract.paymentTerms || t.notSet} />
                    <InfoRow label={t.renewalTerms} value={contract.renewalTerms || t.notSet} />
                    <InfoRow
                      label={t.terminationTerms}
                      value={contract.terminationTerms || t.notSet}
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
                                <p className="font-semibold">
                                  {item.productName || item.serviceName}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {item.serviceName}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-xs text-muted-foreground">{t.discount}</p>
                              <p className="font-semibold">{formatPercent(item.discountRate)}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-xs text-muted-foreground">{t.commission}</p>
                              <p className="font-semibold">{formatPercent(item.commissionRate)}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-xs text-muted-foreground">{t.price}</p>
                              <SarAmount amount={item.price} />
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
                <InfoRow label={t.contractNumber} value={contract.contractNumber} />
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
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/20 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  {isArabic ? "سجل النظام" : "System Record"}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <InfoRow label={t.createdAt} value={formatDateTime(contract.createdAt, locale)} />
                <InfoRow label={t.updatedAt} value={formatDateTime(contract.updatedAt, locale)} />
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-3xl border-white/20 bg-primary text-primary-foreground shadow-lg dark:border-white/10">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>

                  <div>
                    <h3 className="font-bold">
                      {isArabic ? "تفاصيل عقد مرتبطة" : "Connected Contract Details"}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-primary-foreground/80">
                      {isArabic
                        ? "هذه الصفحة مرتبطة مباشرة بواجهة العقود الرسمية وتدعم العرض والتعديل والحذف."
                        : "This page is directly connected to the official contracts API and supports view, edit, and delete."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2">
              <Link href="/system/contracts/list">
                <Button variant="outline" className="w-full justify-start rounded-2xl">
                  <ArrowLeft className="me-2 h-4 w-4" />
                  {t.list}
                </Button>
              </Link>

              <Link href="/system/contracts/reports">
                <Button variant="outline" className="w-full justify-start rounded-2xl">
                  <BadgeCheck className="me-2 h-4 w-4" />
                  {isArabic ? "تقارير العقود" : "Contracts Reports"}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}