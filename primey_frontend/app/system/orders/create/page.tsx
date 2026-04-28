"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, ElementType, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Calculator,
  CheckCircle2,
  CreditCard,
  FileSignature,
  FileText,
  Handshake,
  Loader2,
  Package,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  UserRound,
  UsersRound,
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

import { API_PATHS, apiGet, apiPost } from "@/lib/api";

/* ============================================================
   📂 app/system/orders/create/page.tsx
   🧠 Primey Care | Create Order Page
   ------------------------------------------------------------
   ✅ ربط حقيقي مع /api/orders/
   ✅ اختيار العميل
   ✅ اختيار المنتج / البرنامج / الخدمة
   ✅ اختيار المركز / مقدم الخدمة
   ✅ اختيار العقد
   ✅ اختيار المندوب
   ✅ استخدام UI الداخلي فقط
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ الأرقام دائمًا بالإنجليزية
   ✅ استخدام /currency/sar.svg
   ✅ بدون hardcoded localhost
   ✅ استخدام sonner
============================================================ */

type AppLocale = "ar" | "en";

type OrderStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "processing"
  | "completed"
  | "cancelled"
  | "refunded";

type PaymentStatus =
  | "unpaid"
  | "partially_paid"
  | "paid"
  | "failed"
  | "refunded";

type FulfillmentStatus =
  | "not_started"
  | "in_progress"
  | "issued"
  | "delivered"
  | "failed";

type OrderSource =
  | "website"
  | "whatsapp"
  | "agent"
  | "admin"
  | "mobile_app"
  | "other";

type CustomerOption = {
  id: number | string;
  name: string;
  phone: string;
  email: string;
  status: string;
};

type ProductOption = {
  id: number | string;
  name: string;
  code: string;
  productType: string;
  status: string;
  currencyCode: string;
  price: number;
  salePrice: number;
  effectivePrice: number;
};

type ProviderOption = {
  id: number | string;
  name: string;
  code: string;
  city: string;
  status: string;
};

type ContractOption = {
  id: number | string;
  title: string;
  contractNumber: string;
  providerId: string;
  providerName: string;
  status: string;
};

type AgentOption = {
  id: number | string;
  name: string;
  code: string;
  phone: string;
  status: string;
};

type OrderFormData = {
  customerId: string;
  productId: string;
  providerId: string;
  contractId: string;
  agentId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  source: OrderSource;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
  amountPaid: string;
  issueReference: string;
  customerNotes: string;
  internalNotes: string;
  cancellationReason: string;
};

type OrderFormErrors = Partial<Record<keyof OrderFormData, string>>;

type ApiListResponse = {
  ok?: boolean;
  message?: string;
  results?: unknown[];
  data?: unknown[] | Record<string, unknown>;
  items?: unknown[];
  customers?: unknown[];
  products?: unknown[];
  providers?: unknown[];
  contracts?: unknown[];
  agents?: unknown[];
};

type OrderCreateResponse = {
  ok?: boolean;
  message?: string;
  data?: {
    id?: number | string;
    order_number?: string;
  };
};

/* ============================================================
   🌐 Locale
============================================================ */

function readLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const savedLocale = window.localStorage.getItem("primey-locale");
    if (savedLocale === "en") return "en";
    if (savedLocale === "ar") return "ar";

    return document.documentElement.lang === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

function applyDocumentLocale(locale: AppLocale) {
  if (typeof document === "undefined") return;

  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  document.body.dir = locale === "ar" ? "rtl" : "ltr";
}

/* ============================================================
   🔁 Normalizers
============================================================ */

function normalizeApiList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  const record = payload as ApiListResponse;

  if (Array.isArray(record.results)) return record.results;
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.customers)) return record.customers;
  if (Array.isArray(record.products)) return record.products;
  if (Array.isArray(record.providers)) return record.providers;
  if (Array.isArray(record.contracts)) return record.contracts;
  if (Array.isArray(record.agents)) return record.agents;

  if (record.data && typeof record.data === "object") {
    const nested = record.data as ApiListResponse;

    if (Array.isArray(nested.results)) return nested.results;
    if (Array.isArray(nested.items)) return nested.items;
    if (Array.isArray(nested.customers)) return nested.customers;
    if (Array.isArray(nested.products)) return nested.products;
    if (Array.isArray(nested.providers)) return nested.providers;
    if (Array.isArray(nested.contracts)) return nested.contracts;
    if (Array.isArray(nested.agents)) return nested.agents;
  }

  return [];
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCustomer(item: unknown): CustomerOption {
  const obj = (item || {}) as Record<string, unknown>;

  return {
    id: (obj.id ?? "") as number | string,
    name: String(
      obj.display_name ??
        obj.full_name ??
        obj.name ??
        obj.customer_name ??
        obj.customer_code ??
        "-",
    ),
    phone: String(obj.phone_number ?? obj.whatsapp_number ?? obj.phone ?? obj.mobile ?? ""),
    email: String(obj.email ?? ""),
    status: String(obj.status ?? ""),
  };
}

function normalizeProduct(item: unknown): ProductOption {
  const obj = (item || {}) as Record<string, unknown>;

  const price = toNumber(obj.price);
  const salePrice = toNumber(obj.sale_price);
  const effectivePrice = toNumber(obj.effective_price || salePrice || price);

  return {
    id: (obj.id ?? "") as number | string,
    name: String(obj.name ?? obj.title ?? "-"),
    code: String(obj.code ?? obj.product_code ?? ""),
    productType: String(obj.product_type ?? obj.type ?? ""),
    status: String(obj.status ?? ""),
    currencyCode: String(obj.currency_code ?? "SAR"),
    price,
    salePrice,
    effectivePrice,
  };
}

function normalizeProvider(item: unknown): ProviderOption {
  const obj = (item || {}) as Record<string, unknown>;

  return {
    id: (obj.id ?? "") as number | string,
    name: String(
      obj.name ??
        obj.display_name ??
        obj.provider_name ??
        obj.center_name ??
        obj.legal_name ??
        "-",
    ),
    code: String(obj.code ?? obj.provider_code ?? obj.center_code ?? ""),
    city: String(obj.city ?? obj.city_name ?? ""),
    status: String(obj.status ?? ""),
  };
}

function normalizeContract(item: unknown): ContractOption {
  const obj = (item || {}) as Record<string, unknown>;
  const provider = (obj.provider || {}) as Record<string, unknown>;

  return {
    id: (obj.id ?? "") as number | string,
    title: String(obj.title ?? obj.name ?? obj.contract_name ?? "-"),
    contractNumber: String(obj.contract_number ?? obj.number ?? obj.code ?? ""),
    providerId: String(obj.provider_id ?? provider.id ?? ""),
    providerName: String(
      obj.provider_name ??
        provider.name ??
        provider.display_name ??
        provider.provider_name ??
        "",
    ),
    status: String(obj.status ?? ""),
  };
}

function normalizeAgent(item: unknown): AgentOption {
  const obj = (item || {}) as Record<string, unknown>;

  return {
    id: (obj.id ?? "") as number | string,
    name: String(
      obj.display_name ??
        obj.full_name ??
        obj.name ??
        obj.agent_name ??
        obj.agent_code ??
        "-",
    ),
    code: String(obj.agent_code ?? obj.code ?? ""),
    phone: String(obj.phone_number ?? obj.phone ?? obj.mobile ?? ""),
    status: String(obj.status ?? ""),
  };
}

/* ============================================================
   📚 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "إنشاء طلب جديد" : "Create New Order",
    pageSubtitle: isArabic
      ? "إنشاء طلب كامل وربط العميل بالمنتج والمركز والعقد والمندوب ضمن دورة الطلب التشغيلية."
      : "Create a full order and link customer, product, provider, contract and agent within the order lifecycle.",

    back: isArabic ? "رجوع" : "Back",
    save: isArabic ? "حفظ الطلب" : "Save Order",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    loading: isArabic ? "جاري التحميل..." : "Loading...",
    reset: isArabic ? "إعادة تعيين" : "Reset",
    ordersList: isArabic ? "قائمة الطلبات" : "Orders List",

    heroBadge1: isArabic ? "وحدة الطلبات" : "Orders Module",
    heroBadge2: isArabic ? "إنشاء" : "Create",

    customerProductSection: isArabic
      ? "بيانات العميل والمنتج"
      : "Customer and Product",
    customerProductDesc: isArabic
      ? "اختر العميل والمنتج أو البرنامج أو الخدمة المرتبطة بهذا الطلب."
      : "Select the customer and the product, program or service linked to this order.",

    lifecycleSection: isArabic
      ? "الربط التشغيلي للطلب"
      : "Order Operational Links",
    lifecycleDesc: isArabic
      ? "اربط الطلب بالمركز أو مقدم الخدمة والعقد والمندوب عند الحاجة."
      : "Link the order to provider, contract and agent when needed.",

    orderStatusSection: isArabic ? "حالة الطلب" : "Order Status",
    orderStatusDesc: isArabic
      ? "حدد مصدر الطلب وحالات الطلب والدفع والتنفيذ."
      : "Set order source, order status, payment and fulfillment status.",

    amountsSection: isArabic ? "المبالغ والحسابات" : "Amounts and Calculation",
    amountsDesc: isArabic
      ? "يتم احتساب الإجمالي تلقائيًا بناءً على الكمية والسعر والخصم والضريبة."
      : "Total is calculated automatically based on quantity, price, discount and tax.",

    notesSection: isArabic ? "الملاحظات" : "Notes",
    notesDesc: isArabic
      ? "أضف ملاحظات العميل والملاحظات الداخلية عند الحاجة."
      : "Add customer notes and internal notes when needed.",

    summarySection: isArabic ? "ملخص الطلب" : "Order Summary",
    summaryDesc: isArabic
      ? "مراجعة سريعة قبل حفظ الطلب."
      : "Quick review before saving the order.",

    customer: isArabic ? "العميل" : "Customer",
    product: isArabic ? "المنتج / البرنامج / الخدمة" : "Product / Program / Service",
    provider: isArabic ? "المركز / مقدم الخدمة" : "Provider / Center",
    contract: isArabic ? "العقد" : "Contract",
    agent: isArabic ? "المندوب" : "Agent",

    selectCustomer: isArabic ? "اختر العميل" : "Select customer",
    selectProduct: isArabic ? "اختر المنتج" : "Select product",
    selectProvider: isArabic ? "اختر المركز / مقدم الخدمة" : "Select provider / center",
    selectContract: isArabic ? "اختر العقد" : "Select contract",
    selectAgent: isArabic ? "اختر المندوب" : "Select agent",

    noCustomers: isArabic ? "لا يوجد عملاء" : "No customers",
    noProducts: isArabic ? "لا توجد منتجات" : "No products",
    noProviders: isArabic ? "لا توجد مراكز" : "No providers",
    noContracts: isArabic ? "لا توجد عقود" : "No contracts",
    noAgents: isArabic ? "لا يوجد مندوبون" : "No agents",

    source: isArabic ? "مصدر الطلب" : "Order Source",
    status: isArabic ? "حالة الطلب" : "Order Status",
    paymentStatus: isArabic ? "حالة الدفع" : "Payment Status",
    fulfillmentStatus: isArabic ? "حالة التنفيذ" : "Fulfillment Status",

    quantity: isArabic ? "الكمية" : "Quantity",
    unitPrice: isArabic ? "سعر الوحدة" : "Unit Price",
    discountAmount: isArabic ? "الخصم" : "Discount",
    taxAmount: isArabic ? "الضريبة" : "Tax",
    amountPaid: isArabic ? "المبلغ المدفوع" : "Amount Paid",
    subtotalAmount: isArabic ? "الإجمالي قبل الخصم" : "Subtotal",
    totalAmount: isArabic ? "الإجمالي النهائي" : "Total",
    remainingAmount: isArabic ? "المتبقي" : "Remaining",

    issueReference: isArabic ? "مرجع الإصدار" : "Issue Reference",
    customerNotes: isArabic ? "ملاحظات العميل" : "Customer Notes",
    internalNotes: isArabic ? "ملاحظات داخلية" : "Internal Notes",
    cancellationReason: isArabic ? "سبب الإلغاء" : "Cancellation Reason",

    optional: isArabic ? "اختياري" : "Optional",

    validationCustomer: isArabic ? "اختر العميل." : "Select a customer.",
    validationProduct: isArabic ? "اختر المنتج." : "Select a product.",
    validationQuantity: isArabic
      ? "الكمية يجب أن تكون أكبر من صفر."
      : "Quantity must be greater than zero.",
    validationUnitPrice: isArabic
      ? "سعر الوحدة لا يمكن أن يكون أقل من صفر."
      : "Unit price cannot be negative.",
    validationDiscount: isArabic
      ? "الخصم لا يمكن أن يكون أقل من صفر."
      : "Discount cannot be negative.",
    validationTax: isArabic
      ? "الضريبة لا يمكن أن تكون أقل من صفر."
      : "Tax cannot be negative.",
    validationPaid: isArabic
      ? "المبلغ المدفوع لا يمكن أن يكون أقل من صفر."
      : "Amount paid cannot be negative.",
    validationDiscountMax: isArabic
      ? "الخصم لا يمكن أن يتجاوز الإجمالي قبل الخصم."
      : "Discount cannot exceed subtotal.",
    validationCancellation: isArabic
      ? "سبب الإلغاء مطلوب عند اختيار حالة ملغي."
      : "Cancellation reason is required when status is cancelled.",

    loadCustomersError: isArabic
      ? "تعذر تحميل العملاء."
      : "Unable to load customers.",
    loadProductsError: isArabic
      ? "تعذر تحميل المنتجات."
      : "Unable to load products.",
    loadProvidersError: isArabic
      ? "تعذر تحميل المراكز / مقدمي الخدمة."
      : "Unable to load providers.",
    loadContractsError: isArabic
      ? "تعذر تحميل العقود."
      : "Unable to load contracts.",
    loadAgentsError: isArabic
      ? "تعذر تحميل المندوبين."
      : "Unable to load agents.",

    createSuccess: isArabic
      ? "تم إنشاء الطلب بنجاح."
      : "Order created successfully.",
    createError: isArabic ? "تعذر إنشاء الطلب." : "Unable to create order.",

    previewCustomer: isArabic ? "العميل المختار" : "Selected Customer",
    previewProduct: isArabic ? "المنتج المختار" : "Selected Product",
    previewProvider: isArabic ? "المركز / مقدم الخدمة" : "Provider / Center",
    previewContract: isArabic ? "العقد" : "Contract",
    previewAgent: isArabic ? "المندوب" : "Agent",
    previewFinancial: isArabic ? "الملخص المالي" : "Financial Summary",
    previewOperational: isArabic ? "الملخص التشغيلي" : "Operational Summary",

    statusLabels: {
      draft: isArabic ? "مسودة" : "Draft",
      pending: isArabic ? "قيد الانتظار" : "Pending",
      confirmed: isArabic ? "مؤكد" : "Confirmed",
      processing: isArabic ? "قيد المعالجة" : "Processing",
      completed: isArabic ? "مكتمل" : "Completed",
      cancelled: isArabic ? "ملغي" : "Cancelled",
      refunded: isArabic ? "مسترد" : "Refunded",
    } satisfies Record<OrderStatus, string>,

    paymentLabels: {
      unpaid: isArabic ? "غير مدفوع" : "Unpaid",
      partially_paid: isArabic ? "مدفوع جزئيًا" : "Partially Paid",
      paid: isArabic ? "مدفوع" : "Paid",
      failed: isArabic ? "فشل الدفع" : "Failed",
      refunded: isArabic ? "مسترد" : "Refunded",
    } satisfies Record<PaymentStatus, string>,

    fulfillmentLabels: {
      not_started: isArabic ? "لم يبدأ" : "Not Started",
      in_progress: isArabic ? "قيد التنفيذ" : "In Progress",
      issued: isArabic ? "مصدر" : "Issued",
      delivered: isArabic ? "تم التسليم" : "Delivered",
      failed: isArabic ? "فشل التنفيذ" : "Failed",
    } satisfies Record<FulfillmentStatus, string>,

    sourceLabels: {
      website: isArabic ? "الموقع" : "Website",
      whatsapp: isArabic ? "واتساب" : "WhatsApp",
      agent: isArabic ? "مندوب" : "Agent",
      admin: isArabic ? "النظام" : "Admin",
      mobile_app: isArabic ? "تطبيق الجوال" : "Mobile App",
      other: isArabic ? "أخرى" : "Other",
    } satisfies Record<OrderSource, string>,
  };
}

/* ============================================================
   🎨 UI Helpers
============================================================ */

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function CurrencyAmount({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold" dir="ltr">
      <span>{formatMoney(value)}</span>
      <Image
        src="/currency/sar.svg"
        alt="SAR"
        width={14}
        height={14}
        className="opacity-80"
      />
    </span>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

function SectionIcon({ icon: Icon }: { icon: ElementType }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
      <Icon className="h-5 w-5" />
    </div>
  );
}

function optionLabel(main: string, extra?: string) {
  if (!extra) return main;
  return `${main} - ${extra}`;
}

/* ============================================================
   ✅ Page
============================================================ */

export default function SystemOrdersCreatePage() {
  const router = useRouter();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<OrderFormErrors>({});

  const [formData, setFormData] = useState<OrderFormData>({
    customerId: "",
    productId: "",
    providerId: "",
    contractId: "",
    agentId: "",
    status: "pending",
    paymentStatus: "unpaid",
    fulfillmentStatus: "not_started",
    source: "admin",
    quantity: "1",
    unitPrice: "0.00",
    discountAmount: "0.00",
    taxAmount: "0.00",
    amountPaid: "0.00",
    issueReference: "",
    customerNotes: "",
    internalNotes: "",
    cancellationReason: "",
  });

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const selectedCustomer = useMemo(() => {
    return customers.find((item) => String(item.id) === formData.customerId);
  }, [customers, formData.customerId]);

  const selectedProduct = useMemo(() => {
    return products.find((item) => String(item.id) === formData.productId);
  }, [products, formData.productId]);

  const selectedProvider = useMemo(() => {
    return providers.find((item) => String(item.id) === formData.providerId);
  }, [providers, formData.providerId]);

  const filteredContracts = useMemo(() => {
    if (!formData.providerId) return contracts;

    return contracts.filter((item) => {
      if (!item.providerId) return true;
      return String(item.providerId) === String(formData.providerId);
    });
  }, [contracts, formData.providerId]);

  const selectedContract = useMemo(() => {
    return contracts.find((item) => String(item.id) === formData.contractId);
  }, [contracts, formData.contractId]);

  const selectedAgent = useMemo(() => {
    return agents.find((item) => String(item.id) === formData.agentId);
  }, [agents, formData.agentId]);

  const calculations = useMemo(() => {
    const quantity = Math.max(toNumber(formData.quantity), 0);
    const unitPrice = Math.max(toNumber(formData.unitPrice), 0);
    const discount = Math.max(toNumber(formData.discountAmount), 0);
    const tax = Math.max(toNumber(formData.taxAmount), 0);
    const paid = Math.max(toNumber(formData.amountPaid), 0);

    const subtotal = quantity * unitPrice;
    const total = Math.max(subtotal - discount + tax, 0);
    const remaining = Math.max(total - paid, 0);

    return {
      quantity,
      unitPrice,
      discount,
      tax,
      paid,
      subtotal,
      total,
      remaining,
    };
  }, [
    formData.quantity,
    formData.unitPrice,
    formData.discountAmount,
    formData.taxAmount,
    formData.amountPaid,
  ]);

  function updateField<K extends keyof OrderFormData>(
    key: K,
    value: OrderFormData[K],
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

  function handleInputChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    const { name, value } = event.target;
    updateField(name as keyof OrderFormData, value as never);
  }

  function validateForm() {
    const nextErrors: OrderFormErrors = {};

    const quantity = toNumber(formData.quantity);
    const unitPrice = toNumber(formData.unitPrice);
    const discount = toNumber(formData.discountAmount);
    const tax = toNumber(formData.taxAmount);
    const paid = toNumber(formData.amountPaid);
    const subtotal = quantity * unitPrice;

    if (!formData.customerId) {
      nextErrors.customerId = t.validationCustomer;
    }

    if (!formData.productId) {
      nextErrors.productId = t.validationProduct;
    }

    if (quantity <= 0) {
      nextErrors.quantity = t.validationQuantity;
    }

    if (unitPrice < 0) {
      nextErrors.unitPrice = t.validationUnitPrice;
    }

    if (discount < 0) {
      nextErrors.discountAmount = t.validationDiscount;
    }

    if (tax < 0) {
      nextErrors.taxAmount = t.validationTax;
    }

    if (paid < 0) {
      nextErrors.amountPaid = t.validationPaid;
    }

    if (subtotal > 0 && discount > subtotal) {
      nextErrors.discountAmount = t.validationDiscountMax;
    }

    if (formData.status === "cancelled" && !formData.cancellationReason.trim()) {
      nextErrors.cancellationReason = t.validationCancellation;
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  function resetForm() {
    setFormData({
      customerId: "",
      productId: "",
      providerId: "",
      contractId: "",
      agentId: "",
      status: "pending",
      paymentStatus: "unpaid",
      fulfillmentStatus: "not_started",
      source: "admin",
      quantity: "1",
      unitPrice: "0.00",
      discountAmount: "0.00",
      taxAmount: "0.00",
      amountPaid: "0.00",
      issueReference: "",
      customerNotes: "",
      internalNotes: "",
      cancellationReason: "",
    });

    setErrors({});
  }

  async function loadCollection<T>(
    path: string,
    normalize: (item: unknown) => T,
    onError: string,
  ): Promise<T[]> {
    try {
      const result = await apiGet<ApiListResponse>(path, {
        page_size: 100,
      });

      if (!result.ok) {
        toast.error(onError);
        return [];
      }

      return normalizeApiList(result.data).map(normalize);
    } catch (error) {
      console.error(`Failed to load collection from ${path}:`, error);
      toast.error(onError);
      return [];
    }
  }

  async function loadOptions() {
    try {
      setIsLoadingOptions(true);

      const [
        customersData,
        productsData,
        providersData,
        contractsData,
        agentsData,
      ] = await Promise.all([
        loadCollection<CustomerOption>(
          API_PATHS.customers.list,
          normalizeCustomer,
          t.loadCustomersError,
        ),
        loadCollection<ProductOption>(
          API_PATHS.products.list,
          normalizeProduct,
          t.loadProductsError,
        ),
        loadCollection<ProviderOption>(
          "/api/providers/",
          normalizeProvider,
          t.loadProvidersError,
        ),
        loadCollection<ContractOption>(
          "/api/contracts/",
          normalizeContract,
          t.loadContractsError,
        ),
        loadCollection<AgentOption>(
          "/api/agents/",
          normalizeAgent,
          t.loadAgentsError,
        ),
      ]);

      setCustomers(customersData);
      setProducts(productsData);
      setProviders(providersData);
      setContracts(contractsData);
      setAgents(agentsData);
    } finally {
      setIsLoadingOptions(false);
    }
  }

  function extractCreatedOrderId(result: {
    data?: OrderCreateResponse | OrderCreateResponse["data"];
  }) {
    const data = result.data;

    if (!data) return null;

    if ("id" in data && data.id) return data.id;

    if ("data" in data && data.data?.id) return data.data.id;

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);

      const payload: Record<string, string | number> = {
        customer_id: formData.customerId,
        product_id: formData.productId,
        status: formData.status,
        payment_status: formData.paymentStatus,
        fulfillment_status: formData.fulfillmentStatus,
        source: formData.source,
        quantity: calculations.quantity,
        unit_price: calculations.unitPrice.toFixed(2),
        discount_amount: calculations.discount.toFixed(2),
        tax_amount: calculations.tax.toFixed(2),
        amount_paid: calculations.paid.toFixed(2),
        issue_reference: formData.issueReference.trim(),
        customer_notes: formData.customerNotes.trim(),
        internal_notes: formData.internalNotes.trim(),
        cancellation_reason: formData.cancellationReason.trim(),
      };

      if (formData.providerId) {
        payload.provider_id = formData.providerId;
      }

      if (formData.contractId) {
        payload.contract_id = formData.contractId;
      }

      if (formData.agentId) {
        payload.agent_id = formData.agentId;
      }

      const result = await apiPost<OrderCreateResponse>(
        API_PATHS.orders.list,
        payload,
      );

      if (!result.ok) {
        throw new Error(result.message || t.createError);
      }

      toast.success(t.createSuccess);

      const createdId = extractCreatedOrderId(result);

      if (createdId) {
        router.push(`/system/orders/${createdId}`);
        return;
      }

      router.push("/system/orders/list");
    } catch (error) {
      console.error("Create order error:", error);
      toast.error(error instanceof Error ? error.message : t.createError);
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readLocale();

      applyDocumentLocale(nextLocale);
      setLocale(nextLocale);
    };

    const syncAfterPaint = () => {
      syncLocale();

      window.setTimeout(() => {
        syncLocale();
      }, 0);
    };

    syncAfterPaint();

    window.addEventListener("primey-locale-changed", syncAfterPaint);
    window.addEventListener("storage", syncAfterPaint);

    return () => {
      window.removeEventListener("primey-locale-changed", syncAfterPaint);
      window.removeEventListener("storage", syncAfterPaint);
    };
  }, []);

  useEffect(() => {
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    if (!selectedProduct) return;

    setFormData((current) => {
      if (toNumber(current.unitPrice) > 0) return current;

      return {
        ...current,
        unitPrice: selectedProduct.effectivePrice.toFixed(2),
      };
    });
  }, [selectedProduct]);

  useEffect(() => {
    if (!formData.providerId || !formData.contractId) return;

    const isSelectedContractAvailable = filteredContracts.some(
      (contract) => String(contract.id) === formData.contractId,
    );

    if (!isSelectedContractAvailable) {
      setFormData((current) => ({
        ...current,
        contractId: "",
      }));
    }
  }, [filteredContracts, formData.contractId, formData.providerId]);

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      dir={isArabic ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Button
              asChild
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-xl"
            >
              <Link href="/system/orders">
                <ArrowLeft className="h-4 w-4" />
                {t.back}
              </Link>
            </Button>

            <Badge variant="secondary" className="rounded-full">
              <Sparkles className="h-3.5 w-3.5" />
              {t.heroBadge1}
            </Badge>

            <Badge variant="outline" className="rounded-full">
              <BadgeCheck className="h-3.5 w-3.5" />
              {t.heroBadge2}
            </Badge>
          </div>

          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.pageTitle}
          </h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-6">
            {t.pageSubtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            asChild
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl sm:w-auto"
          >
            <Link href="/system/orders/list">
              <ShoppingBag className="h-4 w-4" />
              {t.ordersList}
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            onClick={resetForm}
            disabled={isSubmitting}
          >
            <RotateCcw className="h-4 w-4" />
            {t.reset}
          </Button>

          <Button
            type="submit"
            className="h-10 rounded-xl"
            disabled={isSubmitting || isLoadingOptions}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSubmitting ? t.saving : t.save}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-4">
          {/* Customer + Product */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <SectionIcon icon={UserRound} />
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.customerProductSection}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t.customerProductDesc}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerId">{t.customer}</Label>
                <select
                  id="customerId"
                  name="customerId"
                  value={formData.customerId}
                  onChange={handleInputChange}
                  disabled={isLoadingOptions}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    {isLoadingOptions ? t.loading : t.selectCustomer}
                  </option>

                  {customers.map((customer) => (
                    <option key={customer.id} value={String(customer.id)}>
                      {optionLabel(
                        customer.name,
                        customer.phone || customer.email,
                      )}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.customerId} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="productId">{t.product}</Label>
                <select
                  id="productId"
                  name="productId"
                  value={formData.productId}
                  onChange={(event) => {
                    const productId = event.target.value;
                    const product = products.find(
                      (item) => String(item.id) === productId,
                    );

                    setFormData((current) => ({
                      ...current,
                      productId,
                      unitPrice: product
                        ? product.effectivePrice.toFixed(2)
                        : current.unitPrice,
                    }));

                    setErrors((current) => ({
                      ...current,
                      productId: undefined,
                    }));
                  }}
                  disabled={isLoadingOptions}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    {isLoadingOptions ? t.loading : t.selectProduct}
                  </option>

                  {products.map((product) => (
                    <option key={product.id} value={String(product.id)}>
                      {optionLabel(
                        product.name,
                        product.code || product.productType,
                      )}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.productId} />
              </div>
            </CardContent>
          </Card>

          {/* Lifecycle Links */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <SectionIcon icon={Handshake} />
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.lifecycleSection}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t.lifecycleDesc}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="providerId">
                  {t.provider}{" "}
                  <span className="text-muted-foreground">({t.optional})</span>
                </Label>
                <select
                  id="providerId"
                  name="providerId"
                  value={formData.providerId}
                  onChange={(event) => {
                    const providerId = event.target.value;

                    setFormData((current) => ({
                      ...current,
                      providerId,
                      contractId: "",
                    }));
                  }}
                  disabled={isLoadingOptions}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    {isLoadingOptions ? t.loading : t.selectProvider}
                  </option>

                  {providers.map((provider) => (
                    <option key={provider.id} value={String(provider.id)}>
                      {optionLabel(provider.name, provider.code || provider.city)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractId">
                  {t.contract}{" "}
                  <span className="text-muted-foreground">({t.optional})</span>
                </Label>
                <select
                  id="contractId"
                  name="contractId"
                  value={formData.contractId}
                  onChange={handleInputChange}
                  disabled={isLoadingOptions}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    {isLoadingOptions ? t.loading : t.selectContract}
                  </option>

                  {filteredContracts.map((contract) => (
                    <option key={contract.id} value={String(contract.id)}>
                      {optionLabel(
                        contract.title,
                        contract.contractNumber || contract.providerName,
                      )}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agentId">
                  {t.agent}{" "}
                  <span className="text-muted-foreground">({t.optional})</span>
                </Label>
                <select
                  id="agentId"
                  name="agentId"
                  value={formData.agentId}
                  onChange={(event) => {
                    const agentId = event.target.value;

                    setFormData((current) => ({
                      ...current,
                      agentId,
                      source: agentId ? "agent" : current.source,
                    }));
                  }}
                  disabled={isLoadingOptions}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    {isLoadingOptions ? t.loading : t.selectAgent}
                  </option>

                  {agents.map((agent) => (
                    <option key={agent.id} value={String(agent.id)}>
                      {optionLabel(agent.name, agent.code || agent.phone)}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <SectionIcon icon={ShieldCheck} />
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.orderStatusSection}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t.orderStatusDesc}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="source">{t.source}</Label>
                <select
                  id="source"
                  name="source"
                  value={formData.source}
                  onChange={handleInputChange}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {(Object.keys(t.sourceLabels) as OrderSource[]).map(
                    (source) => (
                      <option key={source} value={source}>
                        {t.sourceLabels[source]}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">{t.status}</Label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {(Object.keys(t.statusLabels) as OrderStatus[]).map(
                    (status) => (
                      <option key={status} value={status}>
                        {t.statusLabels[status]}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentStatus">{t.paymentStatus}</Label>
                <select
                  id="paymentStatus"
                  name="paymentStatus"
                  value={formData.paymentStatus}
                  onChange={handleInputChange}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {(Object.keys(t.paymentLabels) as PaymentStatus[]).map(
                    (status) => (
                      <option key={status} value={status}>
                        {t.paymentLabels[status]}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fulfillmentStatus">{t.fulfillmentStatus}</Label>
                <select
                  id="fulfillmentStatus"
                  name="fulfillmentStatus"
                  value={formData.fulfillmentStatus}
                  onChange={handleInputChange}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {(
                    Object.keys(t.fulfillmentLabels) as FulfillmentStatus[]
                  ).map((status) => (
                    <option key={status} value={status}>
                      {t.fulfillmentLabels[status]}
                    </option>
                  ))}
                </select>
              </div>

              {formData.status === "cancelled" ? (
                <div className="space-y-2 md:col-span-2 xl:col-span-4">
                  <Label htmlFor="cancellationReason">
                    {t.cancellationReason}
                  </Label>
                  <Textarea
                    id="cancellationReason"
                    name="cancellationReason"
                    value={formData.cancellationReason}
                    onChange={handleInputChange}
                    className="min-h-24 rounded-xl"
                  />
                  <FieldError message={errors.cancellationReason} />
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Amounts */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <SectionIcon icon={Calculator} />
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.amountsSection}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t.amountsDesc}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="quantity">{t.quantity}</Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  className="rounded-xl"
                />
                <FieldError message={errors.quantity} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitPrice">{t.unitPrice}</Label>
                <Input
                  id="unitPrice"
                  name="unitPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.unitPrice}
                  onChange={handleInputChange}
                  className="rounded-xl"
                />
                <FieldError message={errors.unitPrice} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discountAmount">{t.discountAmount}</Label>
                <Input
                  id="discountAmount"
                  name="discountAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.discountAmount}
                  onChange={handleInputChange}
                  className="rounded-xl"
                />
                <FieldError message={errors.discountAmount} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxAmount">{t.taxAmount}</Label>
                <Input
                  id="taxAmount"
                  name="taxAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.taxAmount}
                  onChange={handleInputChange}
                  className="rounded-xl"
                />
                <FieldError message={errors.taxAmount} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amountPaid">{t.amountPaid}</Label>
                <Input
                  id="amountPaid"
                  name="amountPaid"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amountPaid}
                  onChange={handleInputChange}
                  className="rounded-xl"
                />
                <FieldError message={errors.amountPaid} />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <SectionIcon icon={FileText} />
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.notesSection}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t.notesDesc}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="issueReference">
                  {t.issueReference}{" "}
                  <span className="text-muted-foreground">({t.optional})</span>
                </Label>
                <Input
                  id="issueReference"
                  name="issueReference"
                  value={formData.issueReference}
                  onChange={handleInputChange}
                  className="rounded-xl"
                />
              </div>

              <div className="hidden md:block" />

              <div className="space-y-2">
                <Label htmlFor="customerNotes">
                  {t.customerNotes}{" "}
                  <span className="text-muted-foreground">({t.optional})</span>
                </Label>
                <Textarea
                  id="customerNotes"
                  name="customerNotes"
                  value={formData.customerNotes}
                  onChange={handleInputChange}
                  className="min-h-28 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="internalNotes">
                  {t.internalNotes}{" "}
                  <span className="text-muted-foreground">({t.optional})</span>
                </Label>
                <Textarea
                  id="internalNotes"
                  name="internalNotes"
                  value={formData.internalNotes}
                  onChange={handleInputChange}
                  className="min-h-28 rounded-xl"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <Card className="sticky top-4 rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <SectionIcon icon={ShoppingBag} />
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.summarySection}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t.summaryDesc}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-background p-4">
                <div className="mb-3 flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold">{t.previewCustomer}</p>
                </div>

                <p className="text-sm font-medium">
                  {selectedCustomer?.name || t.selectCustomer}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedCustomer?.phone || selectedCustomer?.email || "-"}
                </p>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold">{t.previewProduct}</p>
                </div>

                <p className="text-sm font-medium">
                  {selectedProduct?.name || t.selectProduct}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedProduct?.code || selectedProduct?.productType || "-"}
                </p>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold">{t.previewProvider}</p>
                </div>

                <p className="text-sm font-medium">
                  {selectedProvider?.name || t.selectProvider}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedProvider?.code || selectedProvider?.city || "-"}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-xl border bg-background p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <FileSignature className="h-4 w-4 text-muted-foreground" />
                    <p className="font-semibold">{t.previewContract}</p>
                  </div>

                  <p className="text-sm font-medium">
                    {selectedContract?.title || t.selectContract}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedContract?.contractNumber ||
                      selectedContract?.providerName ||
                      "-"}
                  </p>
                </div>

                <div className="rounded-xl border bg-background p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <UsersRound className="h-4 w-4 text-muted-foreground" />
                    <p className="font-semibold">{t.previewAgent}</p>
                  </div>

                  <p className="text-sm font-medium">
                    {selectedAgent?.name || t.selectAgent}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedAgent?.code || selectedAgent?.phone || "-"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold">{t.previewFinancial}</p>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t.subtotalAmount}
                    </span>
                    <CurrencyAmount value={calculations.subtotal} />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t.discountAmount}
                    </span>
                    <CurrencyAmount value={calculations.discount} />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t.taxAmount}</span>
                    <CurrencyAmount value={calculations.tax} />
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{t.totalAmount}</span>
                      <CurrencyAmount value={calculations.total} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t.amountPaid}
                    </span>
                    <CurrencyAmount value={calculations.paid} />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t.remainingAmount}
                    </span>
                    <CurrencyAmount value={calculations.remaining} />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold">{t.previewOperational}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="rounded-full">
                    <BriefcaseBusiness className="h-3.5 w-3.5" />
                    {t.sourceLabels[formData.source]}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    {t.statusLabels[formData.status]}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    <CreditCard className="h-3.5 w-3.5" />
                    {t.paymentLabels[formData.paymentStatus]}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t.fulfillmentLabels[formData.fulfillmentStatus]}
                  </Badge>
                </div>
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-xl"
                disabled={isSubmitting || isLoadingOptions}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {isSubmitting ? t.saving : t.save}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}