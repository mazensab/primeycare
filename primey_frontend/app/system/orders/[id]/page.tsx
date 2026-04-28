"use client";

import Image from "next/image";
import Link from "next/link";
import type { ChangeEvent, ElementType, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileSignature,
  FileText,
  Handshake,
  Loader2,
  Package,
  Pencil,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  Save,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UserRound,
  UsersRound,
  Wallet,
  XCircle,
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

import { API_PATHS, apiGet, apiPatch, apiPost } from "@/lib/api";

/* ============================================================
   📂 app/system/orders/[id]/page.tsx
   🧠 Primey Care | Order Detail Page
   ------------------------------------------------------------
   ✅ صفحة تفاصيل الطلب بنفس نمط صفحات التفاصيل
   ✅ ربط حقيقي مع /api/orders/<id>/
   ✅ يدعم المرحلة 8:
      - Customer
      - Product / Program / Service
      - Provider / Center
      - Contract
      - Agent
      - Invoice عبر Invoice.order
   ✅ Lifecycle Actions:
      - confirm
      - processing
      - complete
      - cancel
      - refund
   ✅ تحديث الملاحظات والمدفوع وحالة التنفيذ
   ✅ إلغاء آمن للطلب بدل الحذف النهائي
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
  | "refunded"
  | "UNKNOWN";

type PaymentStatus =
  | "unpaid"
  | "partially_paid"
  | "paid"
  | "failed"
  | "refunded"
  | "UNKNOWN";

type FulfillmentStatus =
  | "not_started"
  | "in_progress"
  | "issued"
  | "delivered"
  | "failed"
  | "UNKNOWN";

type OrderSource =
  | "website"
  | "whatsapp"
  | "agent"
  | "admin"
  | "mobile_app"
  | "other"
  | "UNKNOWN";

type LifecycleAction =
  | "confirm"
  | "processing"
  | "complete"
  | "cancel"
  | "refund";

type StatusHistory = {
  id: number | string;
  fromStatus: string;
  toStatus: string;
  note: string;
  changedByName: string;
  createdAt: string;
};

type OrderDetail = {
  id: number | string;
  orderNumber: string;

  customerId: number | string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerStatus: string;

  productId: number | string;
  productName: string;
  productCode: string;
  productType: string;
  productStatus: string;

  providerId: number | string | null;
  providerName: string;
  providerCode: string;
  providerStatus: string;

  contractId: number | string | null;
  contractTitle: string;
  contractNumber: string;
  contractStatus: string;

  agentId: number | string | null;
  agentName: string;
  agentCode: string;
  agentPhone: string;
  agentStatus: string;

  invoiceId: number | string | null;
  invoiceNumber: string;
  invoiceStatus: string;
  invoiceTotalAmount: number;
  hasInvoice: boolean;

  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  source: OrderSource;

  currencyCode: string;
  unitPrice: number;
  quantity: number;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  remainingAmount: number;
  isPaid: boolean;

  issueReference: string;
  issuedAt: string;

  customerNotes: string;
  internalNotes: string;
  cancellationReason: string;

  createdAt: string;
  updatedAt: string;

  statusHistory: StatusHistory[];
  raw: Record<string, unknown>;
};

type OrderDetailApiResponse = {
  ok?: boolean;
  message?: string;
  data?: Record<string, unknown>;
};

type EditFormData = {
  status: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  amountPaid: string;
  issueReference: string;
  customerNotes: string;
  internalNotes: string;
  cancellationReason: string;
  statusNote: string;
};

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

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function safeText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function normalizeOrderStatus(value: unknown): OrderStatus {
  const status = String(value || "").toLowerCase();

  if (status === "draft") return "draft";
  if (status === "pending") return "pending";
  if (status === "confirmed") return "confirmed";
  if (status === "processing") return "processing";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "refunded") return "refunded";

  return "UNKNOWN";
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  const status = String(value || "").toLowerCase();

  if (status === "unpaid") return "unpaid";
  if (status === "partially_paid") return "partially_paid";
  if (status === "paid") return "paid";
  if (status === "failed") return "failed";
  if (status === "refunded") return "refunded";

  return "UNKNOWN";
}

function normalizeFulfillmentStatus(value: unknown): FulfillmentStatus {
  const status = String(value || "").toLowerCase();

  if (status === "not_started") return "not_started";
  if (status === "in_progress") return "in_progress";
  if (status === "issued") return "issued";
  if (status === "delivered") return "delivered";
  if (status === "failed") return "failed";

  return "UNKNOWN";
}

function normalizeSource(value: unknown): OrderSource {
  const source = String(value || "").toLowerCase();

  if (source === "website") return "website";
  if (source === "whatsapp") return "whatsapp";
  if (source === "agent") return "agent";
  if (source === "admin") return "admin";
  if (source === "mobile_app") return "mobile_app";
  if (source === "other") return "other";

  return "UNKNOWN";
}

function normalizeHistory(item: unknown): StatusHistory {
  const obj = safeRecord(item);

  return {
    id: (obj.id ?? `${Date.now()}-${Math.random()}`) as number | string,
    fromStatus: safeText(obj.from_status),
    toStatus: safeText(obj.to_status),
    note: safeText(obj.note),
    changedByName: safeText(obj.changed_by_name),
    createdAt: safeText(obj.created_at),
  };
}

function normalizeOrderDetail(payload: unknown): OrderDetail {
  const obj = safeRecord(payload);

  const customer = safeRecord(obj.customer);
  const product = safeRecord(obj.product);
  const provider = safeRecord(obj.provider);
  const contract = safeRecord(obj.contract);
  const agent = safeRecord(obj.agent);
  const invoice = safeRecord(obj.invoice);

  const statusHistory = Array.isArray(obj.status_history)
    ? obj.status_history.map(normalizeHistory)
    : [];

  const invoiceId = obj.invoice_id ?? invoice.id ?? null;

  return {
    id: (obj.id ?? "-") as number | string,
    orderNumber: safeText(obj.order_number),

    customerId: (obj.customer_id ?? customer.id ?? "") as number | string,
    customerName: safeText(
      customer.display_name ??
        customer.full_name ??
        customer.name ??
        obj.customer_name,
      "-",
    ),
    customerPhone: safeText(
      customer.phone_number ??
        customer.whatsapp_number ??
        customer.phone ??
        obj.customer_phone,
    ),
    customerEmail: safeText(customer.email ?? obj.customer_email),
    customerStatus: safeText(customer.status),

    productId: (obj.product_id ?? product.id ?? "") as number | string,
    productName: safeText(obj.product_name ?? product.name, "-"),
    productCode: safeText(product.code ?? obj.product_code),
    productType: safeText(obj.product_type ?? product.product_type),
    productStatus: safeText(product.status),

    providerId: (obj.provider_id ?? provider.id ?? null) as number | string | null,
    providerName: safeText(
      provider.name ??
        provider.display_name ??
        provider.provider_name ??
        provider.center_name,
      "-",
    ),
    providerCode: safeText(provider.code ?? provider.provider_code),
    providerStatus: safeText(provider.status),

    contractId: (obj.contract_id ?? contract.id ?? null) as number | string | null,
    contractTitle: safeText(contract.title ?? contract.name, "-"),
    contractNumber: safeText(contract.contract_number ?? contract.number),
    contractStatus: safeText(contract.status),

    agentId: (obj.agent_id ?? agent.id ?? null) as number | string | null,
    agentName: safeText(
      agent.name ??
        agent.display_name ??
        agent.full_name ??
        agent.agent_name,
      "-",
    ),
    agentCode: safeText(agent.agent_code ?? agent.code),
    agentPhone: safeText(agent.phone_number ?? agent.phone),
    agentStatus: safeText(agent.status),

    invoiceId: invoiceId as number | string | null,
    invoiceNumber: safeText(invoice.invoice_number ?? invoice.number),
    invoiceStatus: safeText(invoice.status),
    invoiceTotalAmount: toNumber(invoice.total_amount),
    hasInvoice: Boolean(obj.has_invoice || invoiceId),

    status: normalizeOrderStatus(obj.status),
    paymentStatus: normalizePaymentStatus(obj.payment_status),
    fulfillmentStatus: normalizeFulfillmentStatus(obj.fulfillment_status),
    source: normalizeSource(obj.source),

    currencyCode: safeText(obj.currency_code ?? product.currency_code, "SAR"),
    unitPrice: toNumber(obj.unit_price),
    quantity: toNumber(obj.quantity || 1),
    subtotalAmount: toNumber(obj.subtotal_amount),
    discountAmount: toNumber(obj.discount_amount),
    taxAmount: toNumber(obj.tax_amount),
    totalAmount: toNumber(obj.total_amount),
    amountPaid: toNumber(obj.amount_paid),
    remainingAmount: toNumber(obj.remaining_amount),
    isPaid: Boolean(obj.is_paid),

    issueReference: safeText(obj.issue_reference),
    issuedAt: safeText(obj.issued_at),

    customerNotes: safeText(obj.customer_notes),
    internalNotes: safeText(obj.internal_notes),
    cancellationReason: safeText(obj.cancellation_reason),

    createdAt: safeText(obj.created_at),
    updatedAt: safeText(obj.updated_at),

    statusHistory,
    raw: obj,
  };
}

/* ============================================================
   📚 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "تفاصيل الطلب" : "Order Details",
    pageSubtitle: isArabic
      ? "عرض تفاصيل الطلب، العميل، المنتج، المركز، العقد، المندوب، الفاتورة، المبالغ وسجل التغييرات."
      : "View order details, customer, product, provider, contract, agent, invoice, amounts and history.",

    back: isArabic ? "رجوع" : "Back",
    list: isArabic ? "قائمة الطلبات" : "Orders List",
    create: isArabic ? "إنشاء طلب" : "Create Order",
    refresh: isArabic ? "تحديث" : "Refresh",
    edit: isArabic ? "تعديل الطلب" : "Edit Order",
    cancelEdit: isArabic ? "إلغاء التعديل" : "Cancel Edit",
    save: isArabic ? "حفظ التعديلات" : "Save Changes",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    cancelOrder: isArabic ? "إلغاء الطلب" : "Cancel Order",
    cancelling: isArabic ? "جاري الإلغاء..." : "Cancelling...",

    confirm: isArabic ? "تأكيد" : "Confirm",
    processing: isArabic ? "بدء المعالجة" : "Start Processing",
    complete: isArabic ? "إكمال" : "Complete",
    refund: isArabic ? "استرداد" : "Refund",
    applying: isArabic ? "جاري التنفيذ..." : "Applying...",

    heroBadge1: isArabic ? "وحدة الطلبات" : "Orders Module",
    heroBadge2: isArabic ? "تفاصيل" : "Detail",

    overview: isArabic ? "نظرة عامة" : "Overview",
    customerInfo: isArabic ? "بيانات العميل" : "Customer Info",
    productInfo: isArabic ? "بيانات المنتج" : "Product Info",
    lifecycleInfo: isArabic ? "الربط التشغيلي" : "Operational Links",
    financialInfo: isArabic ? "الملخص المالي" : "Financial Summary",
    operationalInfo: isArabic ? "الحالة التشغيلية" : "Operational Status",
    notesInfo: isArabic ? "الملاحظات" : "Notes",
    editInfo: isArabic ? "تحديث الطلب" : "Update Order",
    historyInfo: isArabic ? "سجل تغييرات الحالة" : "Status History",

    orderNumber: isArabic ? "رقم الطلب" : "Order Number",
    customer: isArabic ? "العميل" : "Customer",
    phone: isArabic ? "الجوال" : "Phone",
    email: isArabic ? "البريد" : "Email",
    product: isArabic ? "المنتج" : "Product",
    code: isArabic ? "الكود" : "Code",
    type: isArabic ? "النوع" : "Type",

    provider: isArabic ? "المركز / مقدم الخدمة" : "Provider / Center",
    contract: isArabic ? "العقد" : "Contract",
    agent: isArabic ? "المندوب" : "Agent",
    invoice: isArabic ? "الفاتورة" : "Invoice",
    invoiceNumber: isArabic ? "رقم الفاتورة" : "Invoice Number",

    source: isArabic ? "مصدر الطلب" : "Order Source",
    status: isArabic ? "حالة الطلب" : "Order Status",
    paymentStatus: isArabic ? "حالة الدفع" : "Payment Status",
    fulfillmentStatus: isArabic ? "حالة التنفيذ" : "Fulfillment Status",

    quantity: isArabic ? "الكمية" : "Quantity",
    unitPrice: isArabic ? "سعر الوحدة" : "Unit Price",
    subtotalAmount: isArabic ? "الإجمالي قبل الخصم" : "Subtotal",
    discountAmount: isArabic ? "الخصم" : "Discount",
    taxAmount: isArabic ? "الضريبة" : "Tax",
    totalAmount: isArabic ? "الإجمالي النهائي" : "Total",
    amountPaid: isArabic ? "المبلغ المدفوع" : "Amount Paid",
    remainingAmount: isArabic ? "المتبقي" : "Remaining",

    issueReference: isArabic ? "مرجع الإصدار" : "Issue Reference",
    issuedAt: isArabic ? "تاريخ الإصدار" : "Issued At",
    createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
    updatedAt: isArabic ? "آخر تحديث" : "Updated At",
    customerNotes: isArabic ? "ملاحظات العميل" : "Customer Notes",
    internalNotes: isArabic ? "ملاحظات داخلية" : "Internal Notes",
    cancellationReason: isArabic ? "سبب الإلغاء" : "Cancellation Reason",
    statusNote: isArabic ? "ملاحظة تغيير الحالة" : "Status Change Note",

    empty: isArabic ? "لا يوجد" : "None",
    notLinked: isArabic ? "غير مرتبط" : "Not linked",
    noHistory: isArabic ? "لا يوجد سجل تغييرات بعد." : "No status history yet.",

    loading: isArabic ? "جاري تحميل تفاصيل الطلب..." : "Loading order details...",
    loadError: isArabic ? "تعذر تحميل تفاصيل الطلب." : "Unable to load order details.",
    updateSuccess: isArabic ? "تم تحديث الطلب بنجاح." : "Order updated successfully.",
    updateError: isArabic ? "تعذر تحديث الطلب." : "Unable to update order.",
    lifecycleSuccess: isArabic ? "تم تنفيذ الإجراء بنجاح." : "Lifecycle action completed.",
    lifecycleError: isArabic ? "تعذر تنفيذ الإجراء." : "Unable to apply lifecycle action.",
    cancelConfirm: isArabic
      ? "هل أنت متأكد من إلغاء هذا الطلب؟ سيتم إلغاؤه بشكل آمن وليس حذفه من قاعدة البيانات."
      : "Are you sure you want to cancel this order? It will be safely cancelled, not deleted from the database.",
    cancelSuccess: isArabic ? "تم إلغاء الطلب بنجاح." : "Order cancelled successfully.",
    cancelError: isArabic ? "تعذر إلغاء الطلب." : "Unable to cancel order.",

    statusLabels: {
      draft: isArabic ? "مسودة" : "Draft",
      pending: isArabic ? "قيد الانتظار" : "Pending",
      confirmed: isArabic ? "مؤكد" : "Confirmed",
      processing: isArabic ? "قيد المعالجة" : "Processing",
      completed: isArabic ? "مكتمل" : "Completed",
      cancelled: isArabic ? "ملغي" : "Cancelled",
      refunded: isArabic ? "مسترد" : "Refunded",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<OrderStatus, string>,

    paymentLabels: {
      unpaid: isArabic ? "غير مدفوع" : "Unpaid",
      partially_paid: isArabic ? "مدفوع جزئيًا" : "Partially Paid",
      paid: isArabic ? "مدفوع" : "Paid",
      failed: isArabic ? "فشل الدفع" : "Failed",
      refunded: isArabic ? "مسترد" : "Refunded",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<PaymentStatus, string>,

    fulfillmentLabels: {
      not_started: isArabic ? "لم يبدأ" : "Not Started",
      in_progress: isArabic ? "قيد التنفيذ" : "In Progress",
      issued: isArabic ? "مصدر" : "Issued",
      delivered: isArabic ? "تم التسليم" : "Delivered",
      failed: isArabic ? "فشل التنفيذ" : "Failed",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<FulfillmentStatus, string>,

    sourceLabels: {
      website: isArabic ? "الموقع" : "Website",
      whatsapp: isArabic ? "واتساب" : "WhatsApp",
      agent: isArabic ? "مندوب" : "Agent",
      admin: isArabic ? "النظام" : "Admin",
      mobile_app: isArabic ? "تطبيق الجوال" : "Mobile App",
      other: isArabic ? "أخرى" : "Other",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<OrderSource, string>,
  };
}

/* ============================================================
   🎨 UI Helpers
============================================================ */

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string, locale: AppLocale) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

function SectionIcon({ icon: Icon }: { icon: ElementType }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
      <Icon className="h-5 w-5" />
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b py-3 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-end text-sm font-medium">{value || "-"}</span>
    </div>
  );
}

function statusBadge(status: OrderStatus, locale: AppLocale) {
  const t = dictionary(locale);
  const label = t.statusLabels[status];

  if (status === "completed" || status === "confirmed") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "pending" || status === "processing") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "cancelled" || status === "refunded") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {label}
    </Badge>
  );
}

function paymentBadge(status: PaymentStatus, locale: AppLocale) {
  const t = dictionary(locale);
  const label = t.paymentLabels[status];

  if (status === "paid") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "partially_paid") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "failed" || status === "refunded") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {label}
    </Badge>
  );
}

function fulfillmentBadge(status: FulfillmentStatus, locale: AppLocale) {
  const t = dictionary(locale);
  const label = t.fulfillmentLabels[status];

  if (status === "issued" || status === "delivered") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "in_progress") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
        {label}
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {label}
    </Badge>
  );
}

/* ============================================================
   ✅ Page
============================================================ */

export default function SystemOrderDetailPage() {
  const params = useParams();

  const rawId = params?.id;
  const orderId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [formData, setFormData] = useState<EditFormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [runningAction, setRunningAction] = useState<LifecycleAction | null>(
    null,
  );

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  function fillForm(nextOrder: OrderDetail) {
    setFormData({
      status: nextOrder.status,
      fulfillmentStatus: nextOrder.fulfillmentStatus,
      amountPaid: nextOrder.amountPaid.toFixed(2),
      issueReference: nextOrder.issueReference,
      customerNotes: nextOrder.customerNotes,
      internalNotes: nextOrder.internalNotes,
      cancellationReason: nextOrder.cancellationReason,
      statusNote: "",
    });
  }

  function updateField<K extends keyof EditFormData>(
    key: K,
    value: EditFormData[K],
  ) {
    setFormData((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current,
    );
  }

  function handleInputChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    const { name, value } = event.target;
    updateField(name as keyof EditFormData, value as never);
  }

  async function loadOrder(showToast = false) {
    if (!orderId) return;

    try {
      setIsLoading(true);

      const result = await apiGet<OrderDetailApiResponse>(
        API_PATHS.orders.detail(orderId),
      );

      if (!result.ok) {
        throw new Error(result.message || t.loadError);
      }

      const payload = result.data?.data || result.data;
      const normalized = normalizeOrderDetail(payload);

      setOrder(normalized);
      fillForm(normalized);

      if (showToast) {
        toast.success(t.refresh);
      }
    } catch (error) {
      console.error("Failed to load order detail:", error);
      toast.error(t.loadError);
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!orderId || !formData) return;

    if (formData.status === "cancelled" && !formData.cancellationReason.trim()) {
      toast.error(t.cancellationReason);
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        status: formData.status,
        fulfillment_status: formData.fulfillmentStatus,
        amount_paid: toNumber(formData.amountPaid).toFixed(2),
        issue_reference: formData.issueReference.trim(),
        customer_notes: formData.customerNotes.trim(),
        internal_notes: formData.internalNotes.trim(),
        cancellation_reason: formData.cancellationReason.trim(),
        status_note: formData.statusNote.trim(),
      };

      const result = await apiPatch<OrderDetailApiResponse>(
        API_PATHS.orders.detail(orderId),
        payload,
      );

      if (!result.ok) {
        throw new Error(result.message || t.updateError);
      }

      const payloadData = result.data?.data || result.data;
      const normalized = normalizeOrderDetail(payloadData);

      setOrder(normalized);
      fillForm(normalized);
      setIsEditing(false);

      toast.success(t.updateSuccess);
    } catch (error) {
      console.error("Update order error:", error);
      toast.error(error instanceof Error ? error.message : t.updateError);
    } finally {
      setIsSaving(false);
    }
  }

  async function runLifecycleAction(action: LifecycleAction) {
    if (!orderId) return;

    const reason =
      action === "cancel"
        ? window.prompt(t.cancellationReason, order?.cancellationReason || "")
        : "";

    if (action === "cancel" && !reason?.trim()) {
      toast.error(t.cancellationReason);
      return;
    }

    try {
      setRunningAction(action);

      const result = await apiPost<OrderDetailApiResponse>(
        `/api/orders/${orderId}/status/`,
        {
          action,
          reason: reason?.trim() || "",
          status_note: reason?.trim() || "",
        },
      );

      if (!result.ok) {
        throw new Error(result.message || t.lifecycleError);
      }

      const payloadData = result.data?.data || result.data;
      const normalized = normalizeOrderDetail(payloadData);

      setOrder(normalized);
      fillForm(normalized);
      toast.success(t.lifecycleSuccess);
    } catch (error) {
      console.error("Order lifecycle action error:", error);
      toast.error(error instanceof Error ? error.message : t.lifecycleError);
    } finally {
      setRunningAction(null);
    }
  }

  async function handleCancelOrder() {
    if (!orderId) return;

    const confirmed = window.confirm(t.cancelConfirm);
    if (!confirmed) return;

    const reason = window.prompt(t.cancellationReason, "");
    if (!reason?.trim()) {
      toast.error(t.cancellationReason);
      return;
    }

    try {
      setIsCancelling(true);

      const result = await apiPost<OrderDetailApiResponse>(
        `/api/orders/${orderId}/status/`,
        {
          action: "cancel",
          reason: reason.trim(),
          cancellation_reason: reason.trim(),
          status_note: reason.trim(),
        },
      );

      if (!result.ok) {
        throw new Error(result.message || t.cancelError);
      }

      const payloadData = result.data?.data || result.data;

      if (payloadData) {
        const normalized = normalizeOrderDetail(payloadData);
        setOrder(normalized);
        fillForm(normalized);
      }

      toast.success(t.cancelSuccess);
    } catch (error) {
      console.error("Cancel order error:", error);
      toast.error(error instanceof Error ? error.message : t.cancelError);
    } finally {
      setIsCancelling(false);
    }
  }

  function cancelEdit() {
    if (order) {
      fillForm(order);
    }

    setIsEditing(false);
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
    loadOrder(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, locale]);

  if (isLoading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Card className="w-full max-w-md rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>

            <div>
              <h2 className="font-bold">{t.loading}</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {t.pageSubtitle}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order || !formData) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Card className="w-full max-w-md rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-bold">{t.loadError}</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {t.pageSubtitle}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => loadOrder(false)}
              >
                <RefreshCcw className="h-4 w-4" />
                {t.refresh}
              </Button>

              <Button asChild className="rounded-xl">
                <Link href="/system/orders/list">
                  <ShoppingBag className="h-4 w-4" />
                  {t.list}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const disableActions =
    isSaving ||
    isCancelling ||
    runningAction !== null ||
    order.status === "cancelled";

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
              <Link href="/system/orders/list">
                <ArrowLeft className="h-4 w-4" />
                {t.back}
              </Link>
            </Button>

            <Badge variant="secondary" className="rounded-full">
              <ShoppingBag className="h-3.5 w-3.5" />
              {t.heroBadge1}
            </Badge>

            <Badge variant="outline" className="rounded-full">
              <BadgeCheck className="h-3.5 w-3.5" />
              {t.heroBadge2}
            </Badge>
          </div>

          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.pageTitle} — {order.orderNumber || `#${order.id}`}
          </h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-6">
            {t.pageSubtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadOrder(true)}
            disabled={isSaving || isCancelling || runningAction !== null}
          >
            <RefreshCcw className="h-4 w-4" />
            {t.refresh}
          </Button>

          <Button
            asChild
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl sm:w-auto"
          >
            <Link href="/system/orders/create">
              <ShoppingBag className="h-4 w-4" />
              {t.create}
            </Link>
          </Button>

          {isEditing ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              onClick={cancelEdit}
              disabled={isSaving}
            >
              <RotateCcw className="h-4 w-4" />
              {t.cancelEdit}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              onClick={() => setIsEditing(true)}
              disabled={isCancelling || runningAction !== null}
            >
              <Pencil className="h-4 w-4" />
              {t.edit}
            </Button>
          )}

          {isEditing ? (
            <Button
              type="submit"
              className="h-10 rounded-xl"
              disabled={isSaving || isCancelling || runningAction !== null}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? t.saving : t.save}
            </Button>
          ) : null}

          <Button
            type="button"
            variant="destructive"
            className="h-10 rounded-xl"
            onClick={handleCancelOrder}
            disabled={disableActions}
          >
            {isCancelling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {isCancelling ? t.cancelling : t.cancelOrder}
          </Button>
        </div>
      </div>

      {/* Top Summary */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-muted-foreground text-sm">{t.totalAmount}</p>
              <div className="mt-2 text-2xl font-bold">
                <CurrencyAmount value={order.totalAmount} />
              </div>
            </div>
            <SectionIcon icon={Wallet} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-muted-foreground text-sm">{t.amountPaid}</p>
              <div className="mt-2 text-2xl font-bold">
                <CurrencyAmount value={order.amountPaid} />
              </div>
            </div>
            <SectionIcon icon={CreditCard} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-muted-foreground text-sm">
                {t.remainingAmount}
              </p>
              <div className="mt-2 text-2xl font-bold">
                <CurrencyAmount value={order.remainingAmount} />
              </div>
            </div>
            <SectionIcon icon={Activity} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-muted-foreground text-sm">{t.quantity}</p>
              <div className="mt-2 text-2xl font-bold">
                {formatNumber(order.quantity)}
              </div>
            </div>
            <SectionIcon icon={Package} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-4">
          {/* Overview */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <SectionIcon icon={ShieldCheck} />
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.overview}
                  </CardTitle>
                  <CardDescription>
                    {order.orderNumber || `#${order.id}`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border bg-background p-4">
                <p className="text-muted-foreground mb-2 text-sm">
                  {t.status}
                </p>
                {statusBadge(order.status, locale)}
              </div>

              <div className="rounded-xl border bg-background p-4">
                <p className="text-muted-foreground mb-2 text-sm">
                  {t.paymentStatus}
                </p>
                {paymentBadge(order.paymentStatus, locale)}
              </div>

              <div className="rounded-xl border bg-background p-4">
                <p className="text-muted-foreground mb-2 text-sm">
                  {t.fulfillmentStatus}
                </p>
                {fulfillmentBadge(order.fulfillmentStatus, locale)}
              </div>
            </CardContent>
          </Card>

          {/* Customer + Product */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <SectionIcon icon={UserRound} />
                  <div>
                    <CardTitle className="text-base font-bold">
                      {t.customerInfo}
                    </CardTitle>
                    <CardDescription>{t.customer}</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <InfoRow label={t.customer} value={order.customerName} />
                <InfoRow label={t.phone} value={order.customerPhone || t.empty} />
                <InfoRow label={t.email} value={order.customerEmail || t.empty} />
                <InfoRow label={t.status} value={order.customerStatus || t.empty} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <SectionIcon icon={Package} />
                  <div>
                    <CardTitle className="text-base font-bold">
                      {t.productInfo}
                    </CardTitle>
                    <CardDescription>{t.product}</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <InfoRow label={t.product} value={order.productName} />
                <InfoRow label={t.code} value={order.productCode || t.empty} />
                <InfoRow label={t.type} value={order.productType || t.empty} />
                <InfoRow label={t.status} value={order.productStatus || t.empty} />
              </CardContent>
            </Card>
          </div>

          {/* Lifecycle Links */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <SectionIcon icon={Handshake} />
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.lifecycleInfo}
                  </CardTitle>
                  <CardDescription>
                    {t.provider} / {t.contract} / {t.agent} / {t.invoice}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border bg-background p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold">{t.provider}</p>
                </div>
                <InfoRow
                  label={t.provider}
                  value={
                    order.providerName === "-" ? t.notLinked : order.providerName
                  }
                />
                <InfoRow label={t.code} value={order.providerCode || t.empty} />
                <InfoRow label={t.status} value={order.providerStatus || t.empty} />
              </div>

              <div className="rounded-xl border bg-background p-4">
                <div className="mb-3 flex items-center gap-2">
                  <FileSignature className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold">{t.contract}</p>
                </div>
                <InfoRow
                  label={t.contract}
                  value={
                    order.contractTitle === "-" ? t.notLinked : order.contractTitle
                  }
                />
                <InfoRow label={t.code} value={order.contractNumber || t.empty} />
                <InfoRow label={t.status} value={order.contractStatus || t.empty} />
              </div>

              <div className="rounded-xl border bg-background p-4">
                <div className="mb-3 flex items-center gap-2">
                  <UsersRound className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold">{t.agent}</p>
                </div>
                <InfoRow
                  label={t.agent}
                  value={order.agentName === "-" ? t.notLinked : order.agentName}
                />
                <InfoRow label={t.code} value={order.agentCode || t.empty} />
                <InfoRow label={t.phone} value={order.agentPhone || t.empty} />
              </div>

              <div className="rounded-xl border bg-background p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold">{t.invoice}</p>
                </div>
                <InfoRow
                  label={t.invoiceNumber}
                  value={
                    order.hasInvoice
                      ? order.invoiceNumber || `#${order.invoiceId}`
                      : t.notLinked
                  }
                />
                <InfoRow label={t.status} value={order.invoiceStatus || t.empty} />
                <InfoRow
                  label={t.totalAmount}
                  value={
                    order.hasInvoice ? (
                      <CurrencyAmount value={order.invoiceTotalAmount} />
                    ) : (
                      t.empty
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Financial */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <SectionIcon icon={Wallet} />
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.financialInfo}
                  </CardTitle>
                  <CardDescription>{t.totalAmount}</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <InfoRow
                label={t.unitPrice}
                value={<CurrencyAmount value={order.unitPrice} />}
              />
              <InfoRow label={t.quantity} value={formatNumber(order.quantity)} />
              <InfoRow
                label={t.subtotalAmount}
                value={<CurrencyAmount value={order.subtotalAmount} />}
              />
              <InfoRow
                label={t.discountAmount}
                value={<CurrencyAmount value={order.discountAmount} />}
              />
              <InfoRow
                label={t.taxAmount}
                value={<CurrencyAmount value={order.taxAmount} />}
              />
              <InfoRow
                label={t.totalAmount}
                value={<CurrencyAmount value={order.totalAmount} />}
              />
              <InfoRow
                label={t.amountPaid}
                value={<CurrencyAmount value={order.amountPaid} />}
              />
              <InfoRow
                label={t.remainingAmount}
                value={<CurrencyAmount value={order.remainingAmount} />}
              />
            </CardContent>
          </Card>

          {/* Edit */}
          {isEditing ? (
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <SectionIcon icon={Pencil} />
                  <div>
                    <CardTitle className="text-base font-bold">
                      {t.editInfo}
                    </CardTitle>
                    <CardDescription>{t.save}</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="status">{t.status}</Label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {(Object.keys(t.statusLabels) as OrderStatus[])
                      .filter((item) => item !== "UNKNOWN")
                      .map((status) => (
                        <option key={status} value={status}>
                          {t.statusLabels[status]}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fulfillmentStatus">
                    {t.fulfillmentStatus}
                  </Label>
                  <select
                    id="fulfillmentStatus"
                    name="fulfillmentStatus"
                    value={formData.fulfillmentStatus}
                    onChange={handleInputChange}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {(Object.keys(t.fulfillmentLabels) as FulfillmentStatus[])
                      .filter((item) => item !== "UNKNOWN")
                      .map((status) => (
                        <option key={status} value={status}>
                          {t.fulfillmentLabels[status]}
                        </option>
                      ))}
                  </select>
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
                </div>

                <div className="space-y-2 xl:col-span-3">
                  <Label htmlFor="issueReference">{t.issueReference}</Label>
                  <Input
                    id="issueReference"
                    name="issueReference"
                    value={formData.issueReference}
                    onChange={handleInputChange}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerNotes">{t.customerNotes}</Label>
                  <Textarea
                    id="customerNotes"
                    name="customerNotes"
                    value={formData.customerNotes}
                    onChange={handleInputChange}
                    className="min-h-28 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="internalNotes">{t.internalNotes}</Label>
                  <Textarea
                    id="internalNotes"
                    name="internalNotes"
                    value={formData.internalNotes}
                    onChange={handleInputChange}
                    className="min-h-28 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cancellationReason">
                    {t.cancellationReason}
                  </Label>
                  <Textarea
                    id="cancellationReason"
                    name="cancellationReason"
                    value={formData.cancellationReason}
                    onChange={handleInputChange}
                    className="min-h-28 rounded-xl"
                  />
                </div>

                <div className="space-y-2 xl:col-span-3">
                  <Label htmlFor="statusNote">{t.statusNote}</Label>
                  <Input
                    id="statusNote"
                    name="statusNote"
                    value={formData.statusNote}
                    onChange={handleInputChange}
                    className="rounded-xl"
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Notes */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <SectionIcon icon={FileText} />
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.notesInfo}
                  </CardTitle>
                  <CardDescription>{t.customerNotes}</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border bg-background p-4">
                <p className="font-semibold">{t.customerNotes}</p>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {order.customerNotes || t.empty}
                </p>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <p className="font-semibold">{t.internalNotes}</p>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {order.internalNotes || t.empty}
                </p>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <p className="font-semibold">{t.cancellationReason}</p>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {order.cancellationReason || t.empty}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Operational */}
          <Card className="sticky top-4 rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <SectionIcon icon={Truck} />
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.operationalInfo}
                  </CardTitle>
                  <CardDescription>
                    {t.sourceLabels[order.source]}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {statusBadge(order.status, locale)}
                {paymentBadge(order.paymentStatus, locale)}
                {fulfillmentBadge(order.fulfillmentStatus, locale)}
                <Badge variant="secondary" className="rounded-full">
                  {t.sourceLabels[order.source]}
                </Badge>
              </div>

              <div className="grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-start rounded-xl"
                  disabled={disableActions || order.status !== "pending"}
                  onClick={() => runLifecycleAction("confirm")}
                >
                  {runningAction === "confirm" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BadgeCheck className="h-4 w-4" />
                  )}
                  {t.confirm}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-start rounded-xl"
                  disabled={disableActions || order.status !== "confirmed"}
                  onClick={() => runLifecycleAction("processing")}
                >
                  {runningAction === "processing" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Truck className="h-4 w-4" />
                  )}
                  {t.processing}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-start rounded-xl"
                  disabled={
                    disableActions ||
                    !["confirmed", "processing"].includes(order.status)
                  }
                  onClick={() => runLifecycleAction("complete")}
                >
                  {runningAction === "complete" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {t.complete}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-start rounded-xl"
                  disabled={disableActions || order.status !== "completed"}
                  onClick={() => runLifecycleAction("refund")}
                >
                  {runningAction === "refund" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  {t.refund}
                </Button>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <InfoRow
                  label={t.issueReference}
                  value={order.issueReference || t.empty}
                />
                <InfoRow
                  label={t.issuedAt}
                  value={formatDate(order.issuedAt, locale)}
                />
                <InfoRow
                  label={t.createdAt}
                  value={formatDate(order.createdAt, locale)}
                />
                <InfoRow
                  label={t.updatedAt}
                  value={formatDate(order.updatedAt, locale)}
                />
              </div>

              <div className="rounded-xl border bg-background p-4">
                <p className="mb-3 font-semibold">{t.financialInfo}</p>

                <InfoRow
                  label={t.totalAmount}
                  value={<CurrencyAmount value={order.totalAmount} />}
                />
                <InfoRow
                  label={t.amountPaid}
                  value={<CurrencyAmount value={order.amountPaid} />}
                />
                <InfoRow
                  label={t.remainingAmount}
                  value={<CurrencyAmount value={order.remainingAmount} />}
                />
              </div>
            </CardContent>
          </Card>

          {/* History */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <SectionIcon icon={CalendarClock} />
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.historyInfo}
                  </CardTitle>
                  <CardDescription>{t.status}</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {order.statusHistory.length === 0 ? (
                <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                  {t.noHistory}
                </div>
              ) : (
                <div className="space-y-3">
                  {order.statusHistory.map((history) => (
                    <div
                      key={history.id}
                      className="rounded-xl border bg-background p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full">
                          {history.fromStatus || t.empty}
                        </Badge>
                        <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="secondary" className="rounded-full">
                          {history.toStatus || t.empty}
                        </Badge>
                      </div>

                      <p className="text-muted-foreground mt-3 text-sm">
                        {history.note || t.empty}
                      </p>

                      <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{history.changedByName || t.empty}</span>
                        <span>•</span>
                        <span>{formatDate(history.createdAt, locale)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}