"use client";

/* ============================================================
   📂 app/system/orders/create/page.tsx
   🧠 Primey Care | Create Order
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ مبني بنفس نمط إنشاء المراكز/العملاء المعتمد
   ✅ Full Width Layout
   ✅ Main Form + Sidebar Summary
   ✅ حماية زر الإنشاء وطلبات البيانات حسب الصلاحيات
   ✅ fallback آمن لـ system_admin / superadmin
   ✅ Error Alert داخلي
   ✅ Field-level validation
   ✅ beforeunload protection
   ✅ حفظ واستعادة مسودة محلية
   ✅ تعطيل الحقول أثناء الحفظ
   ✅ تنظيف البيانات قبل الإرسال
   ✅ استخدام /currency/sar.svg
   ✅ استخدام toast من sonner
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ بدون localhost hardcoded
   ✅ الأرقام بالإنجليزية
============================================================ */

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  Layers3,
  Loader2,
  Package,
  RefreshCcw,
  RotateCcw,
  Save,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  Trash2,
  UserRound,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/AuthProvider";
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
import { Textarea } from "@/components/ui/textarea";

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";
type AuthRecord = Record<string, unknown>;

type OrderStatus = "pending" | "confirmed" | "processing" | "completed";
type PaymentStatus = "unpaid" | "partial" | "paid";
type FulfillmentStatus = "not_started" | "in_progress" | "fulfilled";

type OptionItem = {
  id: string;
  label: string;
  subtitle?: string;
  raw?: Record<string, unknown>;
};

type OrderFormData = {
  customer_id: string;
  product_id: string;
  provider_id: string;
  agent_id: string;
  contract_id: string;

  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;

  quantity: string;
  unit_price: string;
  discount_amount: string;
  tax_amount: string;
  total_amount: string;
  paid_amount: string;
  agent_commission: string;

  preferred_date: string;
  notes: string;
  internal_notes: string;

  create_invoice: boolean;
  notify_customer: boolean;
};

type OrderFormErrors = Partial<Record<keyof OrderFormData, string>>;

type CreateOrderApiResponse = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[] | string>;
  id?: number | string;
  order?: {
    id?: number | string;
  };
  data?: {
    id?: number | string;
    order?: {
      id?: number | string;
    };
  };
};

type ApiListResponse = {
  ok?: boolean;
  message?: string;
  results?: unknown[];
  items?: unknown[];
  data?:
    | unknown[]
    | {
        results?: unknown[];
        items?: unknown[];
        customers?: unknown[];
        products?: unknown[];
        providers?: unknown[];
        agents?: unknown[];
        contracts?: unknown[];
      };
  customers?: unknown[];
  products?: unknown[];
  providers?: unknown[];
  agents?: unknown[];
  contracts?: unknown[];
};

const SAR_ICON_PATH = "/currency/sar.svg";
const DRAFT_STORAGE_KEY = "primey-care-order-create-draft";

/* ============================================================
   Locale Helpers
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

/* ============================================================
   API Helpers
============================================================ */

function apiUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  if (!base) return path;

  return `${base.replace(/\/$/, "")}${path}`;
}

function readCookie(name: string) {
  if (typeof document === "undefined") return "";

  const match = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.split("=")[1] || "") : "";
}

/* ============================================================
   Permission Helpers
============================================================ */

function asRecord(value: unknown): AuthRecord {
  return value && typeof value === "object" ? (value as AuthRecord) : {};
}

function getNestedRecord(source: AuthRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (value && typeof value === "object") {
      return value as AuthRecord;
    }
  }

  return {};
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => {
          if (!value) return [];

          if (typeof value === "string") return [value];

          if (Array.isArray(value)) {
            return value.flatMap((item) => {
              if (typeof item === "string") return [item];

              if (item && typeof item === "object") {
                const obj = item as AuthRecord;

                return [
                  obj.code,
                  obj.codename,
                  obj.permission,
                  obj.name,
                  obj.role,
                ].filter(Boolean) as string[];
              }

              return [];
            });
          }

          if (value && typeof value === "object") {
            const obj = value as AuthRecord;

            return [
              obj.code,
              obj.codename,
              obj.permission,
              obj.name,
              obj.role,
            ].filter(Boolean) as string[];
          }

          return [];
        })
        .map((item) => String(item).trim())
        .filter(Boolean),
    ),
  );
}

function getAuthUser(authValue: unknown): AuthRecord {
  const auth = asRecord(authValue);

  return getNestedRecord(auth, [
    "user",
    "currentUser",
    "profile",
    "account",
    "session",
    "data",
  ]);
}

function getAuthRoles(authValue: unknown): string[] {
  const auth = asRecord(authValue);
  const user = getAuthUser(authValue);

  return uniqueStrings([
    auth.role,
    auth.roles,
    auth.user_role,
    auth.userType,
    auth.user_type,
    auth.workspace,
    auth.workspaces,
    auth.type,
    user.role,
    user.roles,
    user.user_role,
    user.userType,
    user.user_type,
    user.workspace,
    user.workspaces,
    user.type,
  ]).map((item) => item.toLowerCase());
}

function getAuthPermissionCodes(authValue: unknown): string[] {
  const auth = asRecord(authValue);
  const user = getAuthUser(authValue);

  const authPermissions = asRecord(auth.permissions);
  const userPermissions = asRecord(user.permissions);
  const authProfilePermissions = asRecord(auth.profile_permissions);
  const userProfilePermissions = asRecord(user.profile_permissions);

  return uniqueStrings([
    auth.permission_codes,
    auth.permissions,
    auth.codes,
    auth.profile_permissions,
    authPermissions.codes,
    authProfilePermissions.codes,
    user.permission_codes,
    user.permissions,
    user.codes,
    user.profile_permissions,
    userPermissions.codes,
    userProfilePermissions.codes,
  ]);
}

function isAuthResolving(authValue: unknown) {
  const auth = asRecord(authValue);

  return Boolean(
    auth.isLoading ||
      auth.loading ||
      auth.isInitializing ||
      auth.initializing ||
      auth.pending,
  );
}

function isSystemAdmin(authValue: unknown) {
  const auth = asRecord(authValue);
  const user = getAuthUser(authValue);
  const roles = getAuthRoles(authValue);

  return (
    Boolean(auth.is_superuser) ||
    Boolean(auth.isSuperuser) ||
    Boolean(auth.is_system_admin) ||
    Boolean(auth.isSystemAdmin) ||
    Boolean(user.is_superuser) ||
    Boolean(user.isSuperuser) ||
    Boolean(user.is_system_admin) ||
    Boolean(user.isSystemAdmin) ||
    roles.some((role) =>
      [
        "system_admin",
        "superuser",
        "super_admin",
        "superadmin",
        "admin",
        "administrator",
      ].includes(role),
    )
  );
}

function hasKnownPermissionSignal(authValue: unknown) {
  return (
    getAuthRoles(authValue).length > 0 ||
    getAuthPermissionCodes(authValue).length > 0
  );
}

function hasPermissionCode(authValue: unknown, codes: string[]) {
  const permissions = getAuthPermissionCodes(authValue);

  if (permissions.length === 0) return undefined;

  return codes.some((code) => permissions.includes(code));
}

function hasSafePermission(
  authValue: unknown,
  codes: string[],
  mode: "view" | "action",
) {
  if (isSystemAdmin(authValue)) return true;

  const explicitPermission = hasPermissionCode(authValue, codes);

  if (typeof explicitPermission === "boolean") {
    return explicitPermission;
  }

  const roles = getAuthRoles(authValue);

  if (roles.length > 0) {
    if (mode === "view") {
      return roles.some((role) =>
        [
          "system_admin",
          "superuser",
          "super_admin",
          "support",
          "accountant",
          "viewer",
        ].includes(role),
      );
    }

    return roles.some((role) =>
      ["system_admin", "superuser", "super_admin"].includes(role),
    );
  }

  if (!hasKnownPermissionSignal(authValue)) {
    return true;
  }

  return mode === "view";
}

/* ============================================================
   Data Helpers
============================================================ */

function getValue(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return "";
}

function extractList(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  const response = payload as ApiListResponse;

  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response.items)) return response.items;

  for (const key of keys) {
    const value = (response as Record<string, unknown>)[key];

    if (Array.isArray(value)) return value;
  }

  if (Array.isArray(response.data)) return response.data;

  if (response.data && typeof response.data === "object") {
    const dataObj = response.data as Record<string, unknown>;

    if (Array.isArray(dataObj.results)) return dataObj.results;
    if (Array.isArray(dataObj.items)) return dataObj.items;

    for (const key of keys) {
      const value = dataObj[key];

      if (Array.isArray(value)) return value;
    }
  }

  return [];
}

function normalizeOption(item: unknown, fallbackPrefix: string): OptionItem {
  const obj = (item || {}) as Record<string, unknown>;
  const id = String(getValue(obj, ["id", "uuid", "pk"]));

  const label = String(
    getValue(obj, [
      "name",
      "full_name",
      "title",
      "label",
      "code",
      "order_number",
      "invoice_number",
      "contract_number",
    ]) || (id ? `${fallbackPrefix}-${id}` : "-"),
  );

  const subtitle = String(
    getValue(obj, [
      "code",
      "phone",
      "mobile",
      "email",
      "city",
      "category_name",
      "product_type",
      "status",
      "contract_number",
    ]) || "",
  );

  return {
    id,
    label,
    subtitle,
    raw: obj,
  };
}

function toNumber(value: string | number) {
  const parsed = Number(String(value || "").replace(/,/g, ""));

  return Number.isFinite(parsed) ? parsed : 0;
}

function isValidNumber(value: string) {
  if (!value.trim()) return true;

  const parsed = Number(value.replace(/,/g, ""));

  return Number.isFinite(parsed);
}

function normalizeNumberString(value: string, fallback = "0.00") {
  const clean = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  const parsed = Number(clean);

  if (!Number.isFinite(parsed)) return fallback;

  return parsed.toFixed(2);
}

function generateOrderNumber() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
  ].join("");

  return `ORD-${stamp}`;
}

function hasFormChanges(formData: OrderFormData) {
  return JSON.stringify(formData) !== JSON.stringify(initialFormData);
}

function normalizePayload(formData: OrderFormData) {
  const quantity = Math.max(1, Math.floor(toNumber(formData.quantity) || 1));
  const unitPrice = toNumber(formData.unit_price);
  const discountAmount = toNumber(formData.discount_amount);
  const taxAmount = toNumber(formData.tax_amount);
  const totalAmount =
    toNumber(formData.total_amount) ||
    Math.max(quantity * unitPrice - discountAmount + taxAmount, 0);
  const paidAmount = Math.min(toNumber(formData.paid_amount), totalAmount);

  return {
    customer_id: formData.customer_id || null,
    product_id: formData.product_id || null,
    provider_id: formData.provider_id || null,
    center_id: formData.provider_id || null,
    agent_id: formData.agent_id || null,
    contract_id: formData.contract_id || null,

    order_number: formData.order_number.trim() || generateOrderNumber(),
    status: formData.status,
    payment_status: formData.payment_status,
    fulfillment_status: formData.fulfillment_status,

    quantity,
    unit_price: unitPrice.toFixed(2),
    discount_amount: discountAmount.toFixed(2),
    tax_amount: taxAmount.toFixed(2),
    total_amount: totalAmount.toFixed(2),
    paid_amount: paidAmount.toFixed(2),
    agent_commission: toNumber(formData.agent_commission).toFixed(2),

    preferred_date: formData.preferred_date || null,
    notes: formData.notes.trim(),
    internal_notes: formData.internal_notes.trim(),

    create_invoice: formData.create_invoice,
    notify_customer: formData.notify_customer,
  };
}

function resolveCreatedId(result: CreateOrderApiResponse) {
  return (
    result.order?.id ||
    result.data?.order?.id ||
    result.data?.id ||
    result.id ||
    null
  );
}

function mapApiFieldErrors(
  errors: CreateOrderApiResponse["errors"],
): OrderFormErrors {
  const nextErrors: OrderFormErrors = {};

  if (!errors) return nextErrors;

  Object.entries(errors).forEach(([key, value]) => {
    const message = Array.isArray(value) ? value[0] : value;

    if (!message) return;

    if (key in initialFormData) {
      nextErrors[key as keyof OrderFormData] = String(message);
    }
  });

  return nextErrors;
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "إنشاء طلب جديد" : "Create New Order",
    subtitle: isArabic
      ? "إنشاء طلب وربطه بالعميل والمنتج والمركز والمندوب والعقد مع تجهيز الفاتورة عند الحاجة."
      : "Create an order and link it with customer, product, provider, agent, and contract with invoice preparation when needed.",

    back: isArabic ? "العودة للطلبات" : "Back to Orders",
    ordersList: isArabic ? "قائمة الطلبات" : "Orders List",
    create: isArabic ? "إنشاء الطلب" : "Create Order",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    saveDraft: isArabic ? "حفظ كمسودة محلية" : "Save Local Draft",
    restoreDraft: isArabic ? "استعادة المسودة" : "Restore Draft",
    clearForm: isArabic ? "تفريغ النموذج" : "Clear Form",
    refreshOptions: isArabic ? "تحديث الخيارات" : "Refresh Options",

    basicInfo: isArabic ? "بيانات الطلب" : "Order Information",
    basicDesc: isArabic
      ? "رقم الطلب والحالات الأساسية."
      : "Order number and core statuses.",

    partiesInfo: isArabic ? "الأطراف والربط" : "Parties & Links",
    partiesDesc: isArabic
      ? "اختيار العميل والمنتج والمركز والمندوب والعقد."
      : "Select customer, product, provider, agent, and contract.",

    financialInfo: isArabic ? "البيانات المالية" : "Financial Details",
    financialDesc: isArabic
      ? "الكمية والسعر والخصم والضريبة والإجمالي والمدفوع."
      : "Quantity, price, discount, tax, total, and paid amount.",

    scheduleInfo: isArabic ? "التاريخ والملاحظات" : "Date & Notes",
    scheduleDesc: isArabic
      ? "التاريخ المفضل والملاحظات العامة والداخلية."
      : "Preferred date, public notes, and internal notes.",

    actionsInfo: isArabic ? "إعدادات بعد الإنشاء" : "Post-create Options",
    actionsDesc: isArabic
      ? "تحديد إنشاء الفاتورة وإشعار العميل بعد حفظ الطلب."
      : "Choose invoice creation and customer notification after saving.",

    summaryTitle: isArabic ? "ملخص الطلب" : "Order Summary",
    summaryDesc: isArabic
      ? "مراجعة سريعة للطلب قبل الحفظ."
      : "Quick review before saving.",

    stepsTitle: isArabic ? "إرشادات قبل الحفظ" : "Before Saving",
    stepsDesc: isArabic
      ? "نقاط مهمة تساعدك على إنشاء طلب صحيح."
      : "Important points to help you create a correct order.",

    formErrorTitle: isArabic ? "تعذر حفظ البيانات" : "Unable to save data",

    accessDeniedTitle: isArabic ? "غير مصرح بإنشاء طلب" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية إنشاء الطلبات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to create orders. Contact your system administrator if you need access.",

    optionLoadError: isArabic
      ? "تعذر تحميل بعض خيارات النموذج."
      : "Unable to load some form options.",

    labels: {
      orderNumber: isArabic ? "رقم الطلب" : "Order Number",
      customer: isArabic ? "العميل" : "Customer",
      product: isArabic ? "المنتج" : "Product",
      provider: isArabic ? "المركز / مقدم الخدمة" : "Provider / Center",
      agent: isArabic ? "المندوب" : "Agent",
      contract: isArabic ? "العقد" : "Contract",
      status: isArabic ? "حالة الطلب" : "Order Status",
      paymentStatus: isArabic ? "حالة الدفع" : "Payment Status",
      fulfillmentStatus: isArabic ? "حالة التنفيذ" : "Fulfillment Status",
      quantity: isArabic ? "الكمية" : "Quantity",
      unitPrice: isArabic ? "سعر الوحدة" : "Unit Price",
      discountAmount: isArabic ? "الخصم" : "Discount",
      taxAmount: isArabic ? "الضريبة" : "Tax",
      totalAmount: isArabic ? "إجمالي الطلب" : "Total Amount",
      paidAmount: isArabic ? "المدفوع" : "Paid Amount",
      remainingAmount: isArabic ? "المتبقي" : "Remaining",
      agentCommission: isArabic ? "عمولة المندوب" : "Agent Commission",
      preferredDate: isArabic ? "التاريخ المفضل" : "Preferred Date",
      notes: isArabic ? "ملاحظات الطلب" : "Order Notes",
      internalNotes: isArabic ? "ملاحظات داخلية" : "Internal Notes",
      createInvoice: isArabic ? "إنشاء فاتورة بعد حفظ الطلب" : "Create invoice after saving",
      notifyCustomer: isArabic ? "إشعار العميل بعد إنشاء الطلب" : "Notify customer after creating order",
    },

    placeholders: {
      orderNumber: isArabic ? "يتم توليده تلقائيًا عند تركه فارغًا" : "Auto-generated if left empty",
      quantity: isArabic ? "مثال: 1" : "Example: 1",
      unitPrice: isArabic ? "مثال: 199" : "Example: 199",
      discountAmount: isArabic ? "مثال: 0" : "Example: 0",
      taxAmount: isArabic ? "مثال: 0" : "Example: 0",
      totalAmount: isArabic ? "يحسب تلقائيًا عند تركه فارغًا" : "Auto-calculated if left empty",
      paidAmount: isArabic ? "مثال: 0" : "Example: 0",
      agentCommission: isArabic ? "مثال: 0" : "Example: 0",
      notes: isArabic ? "ملاحظات تظهر على الطلب..." : "Notes visible on order...",
      internalNotes: isArabic ? "ملاحظات داخلية لفريق التشغيل..." : "Internal notes for operations team...",
    },

    orderStatuses: {
      pending: isArabic ? "معلق" : "Pending",
      confirmed: isArabic ? "مؤكد" : "Confirmed",
      processing: isArabic ? "قيد التنفيذ" : "Processing",
      completed: isArabic ? "مكتمل" : "Completed",
    } satisfies Record<OrderStatus, string>,

    paymentStatuses: {
      unpaid: isArabic ? "غير مدفوع" : "Unpaid",
      partial: isArabic ? "مدفوع جزئيًا" : "Partial",
      paid: isArabic ? "مدفوع" : "Paid",
    } satisfies Record<PaymentStatus, string>,

    fulfillmentStatuses: {
      not_started: isArabic ? "لم يبدأ" : "Not Started",
      in_progress: isArabic ? "قيد التنفيذ" : "In Progress",
      fulfilled: isArabic ? "منفذ" : "Fulfilled",
    } satisfies Record<FulfillmentStatus, string>,

    validation: {
      customer: isArabic ? "اختيار العميل مطلوب." : "Customer is required.",
      product: isArabic ? "اختيار المنتج مطلوب." : "Product is required.",
      provider: isArabic ? "اختيار المركز مطلوب." : "Provider is required.",
      number: isArabic ? "القيمة يجب أن تكون رقمًا صحيحًا." : "Value must be a valid number.",
      total: isArabic ? "الإجمالي لا يمكن أن يكون أقل من صفر." : "Total cannot be negative.",
      paidGreater: isArabic
        ? "المبلغ المدفوع لا يجب أن يكون أكبر من إجمالي الطلب."
        : "Paid amount must not be greater than total amount.",
    },

    success: isArabic ? "تم إنشاء الطلب بنجاح." : "Order created successfully.",
    draftSaved: isArabic ? "تم حفظ المسودة محليًا." : "Draft saved locally.",
    draftRestored: isArabic ? "تمت استعادة المسودة." : "Draft restored.",
    noDraft: isArabic ? "لا توجد مسودة محفوظة." : "No saved draft found.",
    formCleared: isArabic ? "تم تفريغ النموذج." : "Form cleared.",
    apiError: isArabic
      ? "تعذر إنشاء الطلب. تحقق من البيانات وحاول مرة أخرى."
      : "Unable to create order. Please check the data and try again.",
    validationToast: isArabic
      ? "يرجى تصحيح الحقول المطلوبة قبل المتابعة."
      : "Please fix the required fields before continuing.",
    confirmLeave: isArabic
      ? "لديك بيانات غير محفوظة. هل تريد المغادرة؟"
      : "You have unsaved changes. Do you want to leave?",
    confirmClear: isArabic
      ? "سيتم تفريغ النموذج الحالي. هل تريد المتابعة؟"
      : "The current form will be cleared. Do you want to continue?",

    selectPlaceholder: isArabic ? "اختر..." : "Select...",
    noOptions: isArabic ? "لا توجد خيارات متاحة" : "No options available",

    completion: isArabic ? "نسبة الاكتمال" : "Completion",
    ready: isArabic ? "جاهز للحفظ" : "Ready to save",
    missingData: isArabic ? "ينقصه بيانات أساسية" : "Missing required data",
    calculatedTotal: isArabic ? "الإجمالي المحسوب" : "Calculated Total",

    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",

    quickNotes: [
      isArabic
        ? "تأكد من اختيار العميل والمنتج والمركز قبل الحفظ."
        : "Make sure customer, product, and provider are selected before saving.",
      isArabic
        ? "يمكن ترك رقم الطلب فارغًا ليتم توليده تلقائيًا."
        : "You can leave order number empty to auto-generate it.",
      isArabic
        ? "الإجمالي يحسب من الكمية والسعر والخصم والضريبة عند تركه فارغًا."
        : "Total is calculated from quantity, price, discount, and tax when left empty.",
      isArabic
        ? "إنشاء الفاتورة بعد الحفظ يعتمد على دعم الباك إند لهذا الخيار."
        : "Invoice creation after saving depends on backend support for this option.",
    ],
  };
}

/* ============================================================
   Defaults
============================================================ */

const initialFormData: OrderFormData = {
  customer_id: "",
  product_id: "",
  provider_id: "",
  agent_id: "",
  contract_id: "",

  order_number: "",
  status: "pending",
  payment_status: "unpaid",
  fulfillment_status: "not_started",

  quantity: "1",
  unit_price: "",
  discount_amount: "0.00",
  tax_amount: "0.00",
  total_amount: "",
  paid_amount: "0.00",
  agent_commission: "0.00",

  preferred_date: "",
  notes: "",
  internal_notes: "",

  create_invoice: true,
  notify_customer: false,
};

/* ============================================================
   UI Helpers
============================================================ */

function formatNumber(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatMoney(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0.00";

  return numericValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function SarAmount({ value }: { value: number | string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span>{formatMoney(value)}</span>
      <Image
        src={SAR_ICON_PATH}
        alt=""
        width={14}
        height={14}
        className="h-3.5 w-3.5"
      />
    </span>
  );
}

function FieldBlock({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label}
        {required ? <span className="ms-1 text-destructive">*</span> : null}
      </Label>

      {children}

      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

function ToggleBox({
  checked,
  disabled,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-background p-4">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(Boolean(value))}
      />

      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </label>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-background p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-1 truncate text-sm font-semibold">{value || "-"}</div>
      </div>
    </div>
  );
}

function SelectField({
  value,
  disabled,
  options,
  placeholder,
  noOptions,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  options: OptionItem[];
  placeholder: string;
  noOptions: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{options.length ? placeholder : noOptions}</option>

      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.subtitle ? `${item.label} - ${item.subtitle}` : item.label}
        </option>
      ))}
    </select>
  );
}

/* ============================================================
   Page
============================================================ */

export default function SystemCreateOrderPage() {
  const router = useRouter();
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [formData, setFormData] = useState<OrderFormData>(initialFormData);
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  const [customers, setCustomers] = useState<OptionItem[]>([]);
  const [products, setProducts] = useState<OptionItem[]>([]);
  const [providers, setProviders] = useState<OptionItem[]>([]);
  const [agents, setAgents] = useState<OptionItem[]>([]);
  const [contracts, setContracts] = useState<OptionItem[]>([]);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canCreateOrders = hasSafePermission(
    auth,
    ["orders.create"],
    "action",
  );

  const canViewOrders = hasSafePermission(
    auth,
    ["orders.view", "orders.list"],
    "view",
  );

  const canViewCustomers = hasSafePermission(
    auth,
    ["customers.view", "customers.list"],
    "view",
  );

  const canViewProducts = hasSafePermission(
    auth,
    ["products.view", "products.list"],
    "view",
  );

  const canViewProviders = hasSafePermission(
    auth,
    ["providers.view", "providers.list", "centers.view", "centers.list"],
    "view",
  );

  const canViewAgents = hasSafePermission(
    auth,
    ["agents.view", "agents.list"],
    "view",
  );

  const canViewContracts = hasSafePermission(
    auth,
    ["contracts.view", "contracts.list"],
    "view",
  );

  const isDirty = useMemo(() => hasFormChanges(formData), [formData]);

  const calculatedTotal = useMemo(() => {
    const quantity = Math.max(1, toNumber(formData.quantity) || 1);
    const unitPrice = toNumber(formData.unit_price);
    const discount = toNumber(formData.discount_amount);
    const tax = toNumber(formData.tax_amount);

    return Math.max(quantity * unitPrice - discount + tax, 0);
  }, [
    formData.discount_amount,
    formData.quantity,
    formData.tax_amount,
    formData.unit_price,
  ]);

  const finalTotal = useMemo(
    () => toNumber(formData.total_amount) || calculatedTotal,
    [calculatedTotal, formData.total_amount],
  );

  const remainingAmount = useMemo(
    () => Math.max(finalTotal - toNumber(formData.paid_amount), 0),
    [finalTotal, formData.paid_amount],
  );

  const selectedCustomer = useMemo(
    () => customers.find((item) => item.id === formData.customer_id),
    [customers, formData.customer_id],
  );

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === formData.product_id),
    [products, formData.product_id],
  );

  const selectedProvider = useMemo(
    () => providers.find((item) => item.id === formData.provider_id),
    [providers, formData.provider_id],
  );

  const selectedAgent = useMemo(
    () => agents.find((item) => item.id === formData.agent_id),
    [agents, formData.agent_id],
  );

  const selectedContract = useMemo(
    () => contracts.find((item) => item.id === formData.contract_id),
    [contracts, formData.contract_id],
  );

  const completedFields = useMemo(() => {
    const keys: Array<keyof OrderFormData> = [
      "customer_id",
      "product_id",
      "provider_id",
      "status",
      "payment_status",
      "fulfillment_status",
      "quantity",
      "unit_price",
      "discount_amount",
      "tax_amount",
      "paid_amount",
    ];

    return keys.filter((key) => String(formData[key] || "").trim().length > 0)
      .length;
  }, [formData]);

  const progressPercent = Math.round((completedFields / 11) * 100);

  const isReadyToSave =
    formData.customer_id.trim().length > 0 &&
    formData.product_id.trim().length > 0 &&
    formData.provider_id.trim().length > 0 &&
    isValidNumber(formData.quantity) &&
    isValidNumber(formData.unit_price);

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

    if (submitError) {
      setSubmitError("");
    }
  }

  function validateForm() {
    const nextErrors: OrderFormErrors = {};
    const total = toNumber(formData.total_amount) || calculatedTotal;
    const paid = toNumber(formData.paid_amount);

    if (!formData.customer_id) {
      nextErrors.customer_id = t.validation.customer;
    }

    if (!formData.product_id) {
      nextErrors.product_id = t.validation.product;
    }

    if (!formData.provider_id) {
      nextErrors.provider_id = t.validation.provider;
    }

    const numericFields: Array<keyof OrderFormData> = [
      "quantity",
      "unit_price",
      "discount_amount",
      "tax_amount",
      "total_amount",
      "paid_amount",
      "agent_commission",
    ];

    numericFields.forEach((key) => {
      if (!isValidNumber(String(formData[key] || ""))) {
        nextErrors[key] = t.validation.number;
      }
    });

    if (total < 0) {
      nextErrors.total_amount = t.validation.total;
    }

    if (paid > total) {
      nextErrors.paid_amount = t.validation.paidGreater;
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  const loadOptions = useCallback(
    async (showToast = false) => {
      if (!canCreateOrders) return;

      try {
        setIsLoadingOptions(true);
        setOptionsError("");

        const requests: Array<Promise<void>> = [];

        if (canViewCustomers) {
          requests.push(
            fetch(apiUrl("/api/customers/?page_size=200"), {
              credentials: "include",
              headers: { Accept: "application/json" },
            })
              .then((response) => response.json())
              .then((payload) => {
                setCustomers(
                  extractList(payload, ["customers"]).map((item) =>
                    normalizeOption(item, "CUS"),
                  ),
                );
              }),
          );
        }

        if (canViewProducts) {
          requests.push(
            fetch(apiUrl("/api/products/?page_size=200"), {
              credentials: "include",
              headers: { Accept: "application/json" },
            })
              .then((response) => response.json())
              .then((payload) => {
                setProducts(
                  extractList(payload, ["products"]).map((item) =>
                    normalizeOption(item, "PRD"),
                  ),
                );
              }),
          );
        }

        if (canViewProviders) {
          requests.push(
            fetch(apiUrl("/api/providers/?page_size=200"), {
              credentials: "include",
              headers: { Accept: "application/json" },
            })
              .then((response) => response.json())
              .then((payload) => {
                setProviders(
                  extractList(payload, ["providers", "centers"]).map((item) =>
                    normalizeOption(item, "PRV"),
                  ),
                );
              }),
          );
        }

        if (canViewAgents) {
          requests.push(
            fetch(apiUrl("/api/agents/?page_size=200"), {
              credentials: "include",
              headers: { Accept: "application/json" },
            })
              .then((response) => response.json())
              .then((payload) => {
                setAgents(
                  extractList(payload, ["agents"]).map((item) =>
                    normalizeOption(item, "AGT"),
                  ),
                );
              }),
          );
        }

        if (canViewContracts) {
          requests.push(
            fetch(apiUrl("/api/contracts/?page_size=200"), {
              credentials: "include",
              headers: { Accept: "application/json" },
            })
              .then((response) => response.json())
              .then((payload) => {
                setContracts(
                  extractList(payload, ["contracts"]).map((item) =>
                    normalizeOption(item, "CTR"),
                  ),
                );
              }),
          );
        }

        await Promise.all(requests);

        if (showToast) {
          toast.success(t.refreshOptions);
        }
      } catch (error) {
        console.error("Load order form options error:", error);
        setOptionsError(t.optionLoadError);
        toast.error(t.optionLoadError);
      } finally {
        setIsLoadingOptions(false);
      }
    },
    [
      canCreateOrders,
      canViewAgents,
      canViewContracts,
      canViewCustomers,
      canViewProducts,
      canViewProviders,
      t.optionLoadError,
      t.refreshOptions,
    ],
  );

  async function submitForm() {
    setSubmitError("");

    if (!validateForm()) {
      toast.error(t.validationToast);
      return;
    }

    try {
      setIsSubmitting(true);

      const csrfToken = readCookie("csrftoken");

      const response = await fetch(apiUrl("/api/orders/create/"), {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
        body: JSON.stringify(normalizePayload(formData)),
      });

      const result = (await response.json().catch(() => null)) as
        | CreateOrderApiResponse
        | null;

      if (!response.ok || result?.ok === false) {
        const apiErrors = mapApiFieldErrors(result?.errors);
        const message = result?.message || t.apiError;

        setErrors((current) => ({
          ...current,
          ...apiErrors,
        }));

        setSubmitError(message);
        toast.error(message);
        return;
      }

      const createdId = result ? resolveCreatedId(result) : null;

      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      toast.success(t.success);

      if (createdId) {
        router.push(`/system/orders/${createdId}`);
        return;
      }

      router.push("/system/orders/list");
    } catch (error) {
      console.error("Create order error:", error);
      setSubmitError(t.apiError);
      toast.error(t.apiError);
    } finally {
      setIsSubmitting(false);
    }
  }

  function saveDraft() {
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
      toast.success(t.draftSaved);
    } catch (error) {
      console.error("Save order draft error:", error);
      toast.error(t.apiError);
    }
  }

  function restoreDraft() {
    try {
      const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);

      if (!rawDraft) {
        toast.error(t.noDraft);
        return;
      }

      const parsed = JSON.parse(rawDraft) as OrderFormData;

      setFormData({
        ...initialFormData,
        ...parsed,
      });

      setErrors({});
      setSubmitError("");
      toast.success(t.draftRestored);
    } catch (error) {
      console.error("Restore order draft error:", error);
      toast.error(t.apiError);
    }
  }

  function clearForm() {
    if (isDirty && !window.confirm(t.confirmClear)) return;

    setFormData(initialFormData);
    setErrors({});
    setSubmitError("");
    toast.success(t.formCleared);
  }

  function confirmNavigate(path: string) {
    if (isSubmitting) return;

    if (isDirty && !window.confirm(t.confirmLeave)) {
      return;
    }

    router.push(path);
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
    if (authResolving) return;
    loadOptions(false);
  }, [authResolving, loadOptions]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty || isSubmitting) return;

      event.preventDefault();
      event.returnValue = t.confirmLeave;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty, isSubmitting, t.confirmLeave]);

  if (!authResolving && !canCreateOrders) {
    return (
      <div className="w-full space-y-4" dir={isArabic ? "rtl" : "ltr"}>
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5" />
            </div>

            <div>
              <p className="font-semibold text-destructive">
                {t.accessDeniedTitle}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.accessDeniedText}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4" dir={isArabic ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.title}
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl sm:w-auto"
            disabled={isSubmitting}
            onClick={() => confirmNavigate("/system/orders")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.back}</span>
          </Button>

          {canViewOrders ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
              disabled={isSubmitting}
              onClick={() => confirmNavigate("/system/orders/list")}
            >
              <ClipboardList className="h-4 w-4" />
              <span>{t.ordersList}</span>
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl sm:w-auto"
            disabled={isSubmitting || isLoadingOptions}
            onClick={() => loadOptions(true)}
          >
            {isLoadingOptions ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refreshOptions}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl sm:w-auto"
            disabled={isSubmitting}
            onClick={saveDraft}
          >
            <Save className="h-4 w-4" />
            <span>{t.saveDraft}</span>
          </Button>

          <Button
            type="button"
            className="h-10 w-full rounded-xl sm:w-auto"
            disabled={isSubmitting}
            onClick={submitForm}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span>{isSubmitting ? t.saving : t.create}</span>
          </Button>
        </div>
      </div>

      {/* Errors */}
      {submitError ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5 text-destructive">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">{t.formErrorTitle}</p>
              <p className="mt-1 text-sm">{submitError}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {optionsError ? (
        <Card className="rounded-2xl border border-orange-200 bg-orange-50 shadow-sm dark:border-orange-900/40 dark:bg-orange-950/20">
          <CardContent className="flex items-start gap-3 p-5 text-orange-700 dark:text-orange-300">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">{optionsError}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main Form */}
        <div className="space-y-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <ShoppingCart className="h-4 w-4" />
                {t.basicInfo}
              </CardTitle>
              <CardDescription>{t.basicDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock label={t.labels.orderNumber} error={errors.order_number}>
                <Input
                  value={formData.order_number}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.orderNumber}
                  className="h-10 rounded-xl"
                  dir="ltr"
                  onChange={(event) =>
                    updateField("order_number", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.labels.status} error={errors.status}>
                <select
                  value={formData.status}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) =>
                    updateField("status", event.target.value as OrderStatus)
                  }
                >
                  {Object.entries(t.orderStatuses).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock
                label={t.labels.paymentStatus}
                error={errors.payment_status}
              >
                <select
                  value={formData.payment_status}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) =>
                    updateField(
                      "payment_status",
                      event.target.value as PaymentStatus,
                    )
                  }
                >
                  {Object.entries(t.paymentStatuses).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock
                label={t.labels.fulfillmentStatus}
                error={errors.fulfillment_status}
              >
                <select
                  value={formData.fulfillment_status}
                  disabled={isSubmitting}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) =>
                    updateField(
                      "fulfillment_status",
                      event.target.value as FulfillmentStatus,
                    )
                  }
                >
                  {Object.entries(t.fulfillmentStatuses).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Layers3 className="h-4 w-4" />
                {t.partiesInfo}
              </CardTitle>
              <CardDescription>{t.partiesDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <FieldBlock label={t.labels.customer} error={errors.customer_id} required>
                <SelectField
                  value={formData.customer_id}
                  disabled={isSubmitting || isLoadingOptions}
                  options={customers}
                  placeholder={t.selectPlaceholder}
                  noOptions={t.noOptions}
                  onChange={(value) => updateField("customer_id", value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.product} error={errors.product_id} required>
                <SelectField
                  value={formData.product_id}
                  disabled={isSubmitting || isLoadingOptions}
                  options={products}
                  placeholder={t.selectPlaceholder}
                  noOptions={t.noOptions}
                  onChange={(value) => {
                    const selected = products.find((item) => item.id === value);
                    const price = selected?.raw
                      ? getValue(selected.raw, [
                          "effective_price",
                          "sale_price",
                          "price",
                          "base_price",
                        ])
                      : "";

                    updateField("product_id", value);

                    if (price && !formData.unit_price) {
                      updateField("unit_price", normalizeNumberString(String(price)));
                    }
                  }}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.provider} error={errors.provider_id} required>
                <SelectField
                  value={formData.provider_id}
                  disabled={isSubmitting || isLoadingOptions}
                  options={providers}
                  placeholder={t.selectPlaceholder}
                  noOptions={t.noOptions}
                  onChange={(value) => updateField("provider_id", value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.agent} error={errors.agent_id}>
                <SelectField
                  value={formData.agent_id}
                  disabled={isSubmitting || isLoadingOptions}
                  options={agents}
                  placeholder={t.selectPlaceholder}
                  noOptions={t.noOptions}
                  onChange={(value) => updateField("agent_id", value)}
                />
              </FieldBlock>

              <FieldBlock label={t.labels.contract} error={errors.contract_id}>
                <SelectField
                  value={formData.contract_id}
                  disabled={isSubmitting || isLoadingOptions}
                  options={contracts}
                  placeholder={t.selectPlaceholder}
                  noOptions={t.noOptions}
                  onChange={(value) => updateField("contract_id", value)}
                />
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Wallet className="h-4 w-4" />
                {t.financialInfo}
              </CardTitle>
              <CardDescription>{t.financialDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FieldBlock label={t.labels.quantity} error={errors.quantity}>
                <Input
                  value={formData.quantity}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.quantity}
                  className="h-10 rounded-xl"
                  onChange={(event) => updateField("quantity", event.target.value)}
                />
              </FieldBlock>

              <MoneyField
                label={t.labels.unitPrice}
                value={formData.unit_price}
                error={errors.unit_price}
                placeholder={t.placeholders.unitPrice}
                disabled={isSubmitting}
                isArabic={isArabic}
                onChange={(value) => updateField("unit_price", value)}
              />

              <MoneyField
                label={t.labels.discountAmount}
                value={formData.discount_amount}
                error={errors.discount_amount}
                placeholder={t.placeholders.discountAmount}
                disabled={isSubmitting}
                isArabic={isArabic}
                onChange={(value) => updateField("discount_amount", value)}
              />

              <MoneyField
                label={t.labels.taxAmount}
                value={formData.tax_amount}
                error={errors.tax_amount}
                placeholder={t.placeholders.taxAmount}
                disabled={isSubmitting}
                isArabic={isArabic}
                onChange={(value) => updateField("tax_amount", value)}
              />

              <MoneyField
                label={t.labels.totalAmount}
                value={formData.total_amount}
                error={errors.total_amount}
                placeholder={t.placeholders.totalAmount}
                disabled={isSubmitting}
                isArabic={isArabic}
                onChange={(value) => updateField("total_amount", value)}
              />

              <MoneyField
                label={t.labels.paidAmount}
                value={formData.paid_amount}
                error={errors.paid_amount}
                placeholder={t.placeholders.paidAmount}
                disabled={isSubmitting}
                isArabic={isArabic}
                onChange={(value) => updateField("paid_amount", value)}
              />

              <MoneyField
                label={t.labels.agentCommission}
                value={formData.agent_commission}
                error={errors.agent_commission}
                placeholder={t.placeholders.agentCommission}
                disabled={isSubmitting}
                isArabic={isArabic}
                onChange={(value) => updateField("agent_commission", value)}
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <CalendarDays className="h-4 w-4" />
                {t.scheduleInfo}
              </CardTitle>
              <CardDescription>{t.scheduleDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4">
              <FieldBlock
                label={t.labels.preferredDate}
                error={errors.preferred_date}
              >
                <Input
                  type="date"
                  value={formData.preferred_date}
                  disabled={isSubmitting}
                  className="h-10 rounded-xl"
                  onChange={(event) =>
                    updateField("preferred_date", event.target.value)
                  }
                />
              </FieldBlock>

              <FieldBlock label={t.labels.notes} error={errors.notes}>
                <Textarea
                  value={formData.notes}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.notes}
                  className="min-h-28 rounded-xl"
                  onChange={(event) => updateField("notes", event.target.value)}
                />
              </FieldBlock>

              <FieldBlock
                label={t.labels.internalNotes}
                error={errors.internal_notes}
              >
                <Textarea
                  value={formData.internal_notes}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.internalNotes}
                  className="min-h-28 rounded-xl"
                  onChange={(event) =>
                    updateField("internal_notes", event.target.value)
                  }
                />
              </FieldBlock>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <ShieldCheck className="h-4 w-4" />
                {t.actionsInfo}
              </CardTitle>
              <CardDescription>{t.actionsDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <ToggleBox
                checked={formData.create_invoice}
                disabled={isSubmitting}
                title={t.labels.createInvoice}
                description={t.labels.createInvoice}
                onChange={(value) => updateField("create_invoice", value)}
              />

              <ToggleBox
                checked={formData.notify_customer}
                disabled={isSubmitting}
                title={t.labels.notifyCustomer}
                description={t.labels.notifyCustomer}
                onChange={(value) => updateField("notify_customer", value)}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Summary */}
        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {t.summaryTitle}
              </CardTitle>
              <CardDescription>{t.summaryDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t.completion}
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      {formatNumber(progressPercent)}%
                    </p>
                  </div>

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                    <BadgeCheck className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="mt-3">
                  {isReadyToSave ? (
                    <Badge className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t.ready}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-full">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {t.missingData}
                    </Badge>
                  )}
                </div>
              </div>

              <SummaryItem
                icon={ShoppingCart}
                label={t.labels.orderNumber}
                value={formData.order_number || generateOrderNumber()}
              />

              <SummaryItem
                icon={UserRound}
                label={t.labels.customer}
                value={selectedCustomer?.label || "-"}
              />

              <SummaryItem
                icon={Package}
                label={t.labels.product}
                value={selectedProduct?.label || "-"}
              />

              <SummaryItem
                icon={Stethoscope}
                label={t.labels.provider}
                value={selectedProvider?.label || "-"}
              />

              <SummaryItem
                icon={Users}
                label={t.labels.agent}
                value={selectedAgent?.label || "-"}
              />

              <SummaryItem
                icon={FileText}
                label={t.labels.contract}
                value={selectedContract?.label || "-"}
              />

              <div className="rounded-xl border bg-background p-4">
                <p className="text-xs text-muted-foreground">
                  {t.calculatedTotal}
                </p>
                <p className="mt-1 text-lg font-bold">
                  <SarAmount value={finalTotal} />
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t.labels.remainingAmount}: {formatMoney(remainingAmount)}
                </p>
              </div>

              <div className="grid gap-2">
                <Button
                  type="button"
                  className="h-10 rounded-xl"
                  disabled={isSubmitting}
                  onClick={submitForm}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {isSubmitting ? t.saving : t.create}
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl"
                    disabled={isSubmitting}
                    onClick={restoreDraft}
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t.restoreDraft}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl"
                    disabled={isSubmitting}
                    onClick={clearForm}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t.clearForm}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {t.stepsTitle}
              </CardTitle>
              <CardDescription>{t.stepsDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {t.quickNotes.map((item, index) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-xl border bg-background p-3"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {index + 1}
                  </div>

                  <p className="text-sm leading-6 text-muted-foreground">
                    {item}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* ============================================================
   Small Components
============================================================ */

function MoneyField({
  label,
  value,
  error,
  placeholder,
  disabled,
  isArabic,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  placeholder: string;
  disabled?: boolean;
  isArabic: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <FieldBlock label={label} error={error}>
      <div className="relative">
        <Input
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          className={`h-10 rounded-xl ${isArabic ? "pl-10" : "pr-10"}`}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            if (value.trim()) {
              onChange(normalizeNumberString(value));
            }
          }}
        />
        <Image
          src={SAR_ICON_PATH}
          alt=""
          width={16}
          height={16}
          className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
            isArabic ? "left-3" : "right-3"
          }`}
        />
      </div>
    </FieldBlock>
  );
}