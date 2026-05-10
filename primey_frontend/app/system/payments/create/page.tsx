"use client";

/* ============================================================
   📂 app/system/payments/create/page.tsx
   🧠 Primey Care | Create Payment

   ✅ المسار:
      app/system/payments/create/page.tsx

   ✅ العمل:
      صفحة تسجيل دفعة داخل النظام.
      تدعم إنشاء دفعة من فاتورة أو طلب أو عميل أو تسجيل يدوي.

   ✅ الإصدار:
      Phase 17 UX Refinement + Phase 2 Permissions

   ✅ يعتمد على:
      - /api/payments/create/
      - /api/payments/
      - /api/invoices/list/
      - /api/orders/list/
      - /api/customers/list/
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Payments dashboard page
      - Payments list page
      - Payments detail page
      - Invoices pages
      - Orders pages
      - Customers pages
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - تسجيل دفعة من فاتورة.
      - تسجيل دفعة من طلب.
      - تسجيل دفعة لعميل.
      - تسجيل دفعة يدوية.
      - تعبئة بيانات العميل والمبلغ تلقائيًا عند اختيار فاتورة/طلب.
      - Main Form + Sidebar Summary.
      - Error Alert داخلي.
      - Field-level validation.
      - beforeunload protection.
      - حفظ واستعادة مسودة محلية.
      - تأكيد مسح النموذج.
      - تعطيل الحقول أثناء الحفظ.
      - تنظيف البيانات قبل الإرسال.
      - قراءة invoice/order/customer من query params عند توفرها.
      - صلاحيات آمنة بدون كسر system_admin/superuser.
      - إخفاء الإنشاء عند عدم وجود صلاحية.
      - أرقام إنجليزية دائمًا.
      - رمز SAR من /currency/sar.svg بعد الرقم.
      - استخدام sonner للتنبيهات.
      - بدون localhost hardcoded.
      - بدون إظهار مسارات أو عبارات تقنية داخل الواجهة.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  UserRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/AuthProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
   Types
============================================================ */

type AppLocale = "ar" | "en";
type Dict = Record<string, unknown>;

type PaymentSource = "INVOICE" | "ORDER" | "CUSTOMER" | "MANUAL";

type PaymentStatus = "PENDING" | "CONFIRMED";

type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "GATEWAY"
  | "CARD"
  | "WALLET"
  | "TAMARA"
  | "TABBY";

type ApiEnvelope<T> = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  data?: T;
  results?: unknown[];
  items?: unknown[];
  rows?: unknown[];
  invoices?: unknown[];
  orders?: unknown[];
  customers?: unknown[];
};

type InvoiceOption = {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone: string;
  customer_id: string;
  order_id: string;
  order_number: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
};

type OrderOption = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_id: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
};

type CustomerOption = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

type FormState = {
  source: PaymentSource;
  invoice_id: string;
  order_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  amount: string;
  payment_date: string;
  reference: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const SAR_ICON_PATH = "/currency/sar.svg";
const DRAFT_KEY = "primey-care-payment-create-draft-v1";

/* ============================================================
   Locale / API
============================================================ */

function readLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const saved =
      window.localStorage.getItem("primey-locale") ||
      window.localStorage.getItem("locale") ||
      window.localStorage.getItem("lang");

    if (saved === "en") return "en";
    if (saved === "ar") return "ar";

    return document.documentElement.lang === "en" ? "en" : "ar";
  } catch {
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

function apiUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  if (!base) return path;

  return `${base.replace(/\/$/, "")}${path}`;
}

function getCookie(name: string) {
  try {
    if (typeof document === "undefined") return "";

    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);

    if (parts.length === 2) return parts.pop()?.split(";").shift() || "";

    return "";
  } catch {
    return "";
  }
}

/* ============================================================
   Auth / Permissions
============================================================ */

function asDict(value: unknown): Dict {
  return value && typeof value === "object" ? (value as Dict) : {};
}

function getNested(source: Dict, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (value && typeof value === "object") return value as Dict;
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
                const obj = item as Dict;

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
            const obj = value as Dict;

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

function getAuthUser(authValue: unknown) {
  const auth = asDict(authValue);

  return getNested(auth, [
    "user",
    "currentUser",
    "profile",
    "account",
    "session",
    "data",
  ]);
}

function getAuthRoles(authValue: unknown): string[] {
  const auth = asDict(authValue);
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
  const auth = asDict(authValue);
  const user = getAuthUser(authValue);

  const authPermissions = asDict(auth.permissions);
  const userPermissions = asDict(user.permissions);
  const authProfilePermissions = asDict(auth.profile_permissions);
  const userProfilePermissions = asDict(user.profile_permissions);

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
  const auth = asDict(authValue);

  return Boolean(
    auth.isLoading ||
      auth.loading ||
      auth.isInitializing ||
      auth.initializing ||
      auth.pending,
  );
}

function isSystemAdmin(authValue: unknown) {
  const auth = asDict(authValue);
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

function hasSafePermission(
  authValue: unknown,
  codes: string[],
  mode: "view" | "action",
) {
  if (isSystemAdmin(authValue)) return true;

  const permissions = getAuthPermissionCodes(authValue);

  if (permissions.length > 0) {
    return codes.some((code) => permissions.includes(code));
  }

  const roles = getAuthRoles(authValue);

  if (roles.length > 0) {
    if (mode === "view") {
      return roles.some((role) =>
        [
          "system_admin",
          "superuser",
          "super_admin",
          "accountant",
          "support",
          "viewer",
        ].includes(role),
      );
    }

    return roles.some((role) =>
      ["system_admin", "superuser", "super_admin", "accountant"].includes(role),
    );
  }

  return true;
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "تسجيل دفعة" : "Create Payment",
    subtitle: isArabic
      ? "سجل دفعة مرتبطة بفاتورة أو طلب أو عميل مع بيانات التحصيل والترحيل."
      : "Record a payment linked to an invoice, order, or customer with collection details.",

    back: isArabic ? "قائمة المدفوعات" : "Payments List",
    dashboard: isArabic ? "المدفوعات" : "Payments",
    refreshData: isArabic ? "تحديث البيانات" : "Refresh Data",
    save: isArabic ? "حفظ الدفعة" : "Save Payment",
    saving: isArabic ? "جار الحفظ..." : "Saving...",
    clear: isArabic ? "مسح النموذج" : "Clear Form",

    accessDeniedTitle: isArabic ? "غير مصرح بتسجيل المدفوعات" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية تسجيل المدفوعات. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to create payments. Contact your system administrator if you need access.",

    formTitle: isArabic ? "بيانات الدفعة" : "Payment Information",
    formDesc: isArabic
      ? "اختر مصدر الدفعة وأدخل طريقة الدفع والمبلغ والمرجع."
      : "Choose the payment source and enter method, amount, and reference.",

    source: isArabic ? "مصدر الدفعة" : "Payment Source",
    fromInvoice: isArabic ? "من فاتورة" : "From Invoice",
    fromOrder: isArabic ? "من طلب" : "From Order",
    fromCustomer: isArabic ? "من عميل" : "From Customer",
    manual: isArabic ? "يدوية" : "Manual",

    invoice: isArabic ? "الفاتورة" : "Invoice",
    order: isArabic ? "الطلب" : "Order",
    customer: isArabic ? "العميل" : "Customer",
    searchInvoice: isArabic ? "ابحث داخل الفواتير..." : "Search invoices...",
    searchOrder: isArabic ? "ابحث داخل الطلبات..." : "Search orders...",
    searchCustomer: isArabic ? "ابحث داخل العملاء..." : "Search customers...",

    customerName: isArabic ? "اسم العميل" : "Customer Name",
    customerPhone: isArabic ? "جوال العميل" : "Customer Phone",
    customerEmail: isArabic ? "البريد الإلكتروني" : "Email",
    paymentMethod: isArabic ? "طريقة الدفع" : "Payment Method",
    status: isArabic ? "حالة الدفعة" : "Payment Status",
    paymentDate: isArabic ? "تاريخ الدفع" : "Payment Date",
    amount: isArabic ? "المبلغ" : "Amount",
    reference: isArabic ? "مرجع العملية" : "Reference",
    notes: isArabic ? "ملاحظات" : "Notes",

    pending: isArabic ? "بانتظار التأكيد" : "Pending",
    confirmed: isArabic ? "مؤكدة" : "Confirmed",

    cash: isArabic ? "نقدًا" : "Cash",
    bankTransfer: isArabic ? "تحويل بنكي" : "Bank Transfer",
    gateway: isArabic ? "بوابة دفع" : "Gateway",
    card: isArabic ? "بطاقة" : "Card",
    wallet: isArabic ? "محفظة" : "Wallet",
    tamara: isArabic ? "تمارا" : "Tamara",
    tabby: isArabic ? "تابي" : "Tabby",

    summaryTitle: isArabic ? "ملخص الدفعة" : "Payment Summary",
    summaryDesc: isArabic
      ? "ملخص المبلغ والربط قبل الحفظ."
      : "Summary of amount and linkage before saving.",
    selectedSource: isArabic ? "المصدر المختار" : "Selected Source",
    selectedBalance: isArabic ? "المتبقي على المصدر" : "Source Balance",
    totalAmount: isArabic ? "إجمالي المصدر" : "Source Total",
    paidAmount: isArabic ? "المدفوع سابقًا" : "Already Paid",
    remainingAmount: isArabic ? "المتبقي" : "Remaining",
    paymentAmount: isArabic ? "مبلغ الدفعة" : "Payment Amount",

    draftSaved: isArabic ? "تم حفظ المسودة محليًا." : "Draft saved locally.",
    draftRestored: isArabic ? "تم استعادة المسودة." : "Draft restored.",
    draftCleared: isArabic ? "تم مسح النموذج." : "Form cleared.",
    confirmClear: isArabic
      ? "هل تريد مسح النموذج الحالي؟"
      : "Clear the current form?",
    leaveConfirm: isArabic
      ? "لديك تغييرات غير محفوظة."
      : "You have unsaved changes.",

    loadError: isArabic ? "تعذر تحميل البيانات." : "Unable to load data.",
    paymentCreated: isArabic
      ? "تم تسجيل الدفعة بنجاح."
      : "Payment created successfully.",
    submitError: isArabic
      ? "تعذر تسجيل الدفعة."
      : "Unable to create payment.",

    required: isArabic ? "هذا الحقل مطلوب." : "This field is required.",
    sourceRequired: isArabic ? "اختر مصدر الدفعة." : "Select payment source.",
    customerRequired: isArabic ? "أدخل بيانات العميل." : "Enter customer data.",
    invalidAmount: isArabic ? "أدخل مبلغًا صحيحًا." : "Enter a valid amount.",
    amountExceeds: isArabic
      ? "المبلغ أكبر من المتبقي على المصدر."
      : "Amount exceeds the remaining source balance.",

    noInvoices: isArabic ? "لا توجد فواتير متاحة" : "No invoices available",
    noOrders: isArabic ? "لا توجد طلبات متاحة" : "No orders available",
    noCustomers: isArabic ? "لا يوجد عملاء متاحون" : "No customers available",
    notSelected: isArabic ? "غير محدد" : "Not selected",
  };
}

/* ============================================================
   Helpers
============================================================ */

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMoneyInput(value: unknown) {
  const number = toNumber(value);

  if (number <= 0) return "";

  return String(number.toFixed(2));
}

function formatNumber(value: unknown): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatMoney(value: unknown): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function getNestedValue(obj: Dict, keys: string[]): unknown {
  for (const key of keys) {
    const value = obj[key];

    if (value !== undefined && value !== null && value !== "") return value;
  }

  for (const container of [
    "customer",
    "client",
    "invoice",
    "order",
    "payment",
    "item",
    "data",
  ]) {
    const nested = obj[container];

    if (nested && typeof nested === "object") {
      const value = getNestedValue(nested as Dict, keys);

      if (value !== undefined && value !== null && value !== "") return value;
    }
  }

  return undefined;
}

function extractRows(payload: ApiEnvelope<unknown> | null, key: string): unknown[] {
  if (!payload) return [];

  const data = asDict(payload.data);
  const directValue = (payload as Dict)[key];

  if (Array.isArray(directValue)) return directValue;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.rows)) return payload.rows;

  if (Array.isArray(data[key])) return data[key] as unknown[];
  if (Array.isArray(data.results)) return data.results as unknown[];
  if (Array.isArray(data.items)) return data.items as unknown[];
  if (Array.isArray(data.rows)) return data.rows as unknown[];

  if (Array.isArray(payload.data)) return payload.data;

  return [];
}

function normalizeInvoice(item: unknown, index: number): InvoiceOption {
  const obj = asDict(item);
  const customerObj = asDict(obj.customer || obj.client);
  const orderObj = asDict(obj.order);

  const totalAmount = toNumber(
    getNestedValue(obj, [
      "total_amount",
      "grand_total",
      "net_amount",
      "amount",
      "total",
    ]),
  );

  const paidAmount = toNumber(
    getNestedValue(obj, ["paid_amount", "amount_paid", "collected_amount"]),
  );

  const remainingValue = getNestedValue(obj, [
    "remaining_amount",
    "balance_due",
    "due_amount",
  ]);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    invoice_number: String(
      getNestedValue(obj, ["invoice_number", "number", "code", "reference"]) ||
        "-",
    ),
    customer_name: String(
      customerObj.name ||
        customerObj.full_name ||
        getNestedValue(obj, [
          "customer_name",
          "client_name",
          "beneficiary_name",
          "name",
        ]) ||
        "-",
    ),
    customer_phone: String(
      customerObj.phone ||
        customerObj.mobile ||
        getNestedValue(obj, ["customer_phone", "phone", "mobile"]) ||
        "",
    ),
    customer_id: String(
      customerObj.id || getNestedValue(obj, ["customer_id", "client_id"]) || "",
    ),
    order_id: String(orderObj.id || getNestedValue(obj, ["order_id"]) || ""),
    order_number: String(
      orderObj.order_number ||
        orderObj.number ||
        getNestedValue(obj, ["order_number", "order_reference"]) ||
        "-",
    ),
    total_amount: totalAmount,
    paid_amount: paidAmount,
    remaining_amount:
      remainingValue !== undefined && remainingValue !== null
        ? toNumber(remainingValue)
        : Math.max(totalAmount - paidAmount, 0),
    status: String(getNestedValue(obj, ["status", "state"]) || ""),
  };
}

function normalizeOrder(item: unknown, index: number): OrderOption {
  const obj = asDict(item);
  const customerObj = asDict(obj.customer || obj.client);

  const totalAmount = toNumber(
    getNestedValue(obj, [
      "total_amount",
      "grand_total",
      "net_amount",
      "amount",
      "total",
    ]),
  );

  const paidAmount = toNumber(
    getNestedValue(obj, ["paid_amount", "amount_paid", "collected_amount"]),
  );

  const remainingValue = getNestedValue(obj, [
    "remaining_amount",
    "balance_due",
    "due_amount",
  ]);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    order_number: String(
      getNestedValue(obj, ["order_number", "number", "code", "reference"]) ||
        "-",
    ),
    customer_name: String(
      customerObj.name ||
        customerObj.full_name ||
        getNestedValue(obj, [
          "customer_name",
          "client_name",
          "beneficiary_name",
          "name",
        ]) ||
        "-",
    ),
    customer_phone: String(
      customerObj.phone ||
        customerObj.mobile ||
        getNestedValue(obj, ["customer_phone", "phone", "mobile"]) ||
        "",
    ),
    customer_id: String(
      customerObj.id || getNestedValue(obj, ["customer_id", "client_id"]) || "",
    ),
    total_amount: totalAmount,
    paid_amount: paidAmount,
    remaining_amount:
      remainingValue !== undefined && remainingValue !== null
        ? toNumber(remainingValue)
        : Math.max(totalAmount - paidAmount, 0),
    status: String(getNestedValue(obj, ["status", "state"]) || ""),
  };
}

function normalizeCustomer(item: unknown, index: number): CustomerOption {
  const obj = asDict(item);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || `${index}`),
    name: String(
      getNestedValue(obj, ["name", "full_name", "customer_name"]) || "-",
    ),
    phone: String(getNestedValue(obj, ["phone", "mobile", "customer_phone"]) || ""),
    email: String(getNestedValue(obj, ["email", "customer_email"]) || ""),
  };
}

function makeDefaultForm(): FormState {
  return {
    source: "INVOICE",
    invoice_id: "",
    order_id: "",
    customer_id: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    payment_method: "CASH",
    status: "PENDING",
    amount: "",
    payment_date: todayDate(),
    reference: "",
    notes: "",
  };
}

function paymentMethodLabel(method: PaymentMethod, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<PaymentMethod, string> = {
    CASH: t.cash,
    BANK_TRANSFER: t.bankTransfer,
    GATEWAY: t.gateway,
    CARD: t.card,
    WALLET: t.wallet,
    TAMARA: t.tamara,
    TABBY: t.tabby,
  };

  return labels[method];
}

function SarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Image
      src={SAR_ICON_PATH}
      alt=""
      width={16}
      height={16}
      className={className}
    />
  );
}

function MoneyText({ value }: { value: unknown }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span>{formatMoney(value)}</span>
      <SarIcon className="h-3.5 w-3.5" />
    </span>
  );
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

/* ============================================================
   Page
============================================================ */

export default function SystemCreatePaymentPage() {
  const auth = useAuth() as unknown;
  const searchParams = useSearchParams();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [form, setForm] = useState<FormState>(() => makeDefaultForm());

  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [didApplyQueryParams, setDidApplyQueryParams] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canCreate = hasSafePermission(
    auth,
    ["payments.create", "billing.payments.create"],
    "action",
  );

  const canViewInvoices = hasSafePermission(
    auth,
    ["invoices.view", "billing.invoices.view", "payments.create"],
    "view",
  );

  const canViewOrders = hasSafePermission(
    auth,
    ["orders.view", "payments.create"],
    "view",
  );

  const canViewCustomers = hasSafePermission(
    auth,
    ["customers.view", "payments.create"],
    "view",
  );

  const selectedInvoice = useMemo(
    () => invoices.find((item) => item.id === form.invoice_id) || null,
    [form.invoice_id, invoices],
  );

  const selectedOrder = useMemo(
    () => orders.find((item) => item.id === form.order_id) || null,
    [form.order_id, orders],
  );

  const selectedCustomer = useMemo(
    () => customers.find((item) => item.id === form.customer_id) || null,
    [form.customer_id, customers],
  );

  const sourceBalance = useMemo(() => {
    if (form.source === "INVOICE" && selectedInvoice) {
      return selectedInvoice.remaining_amount;
    }

    if (form.source === "ORDER" && selectedOrder) {
      return selectedOrder.remaining_amount;
    }

    return 0;
  }, [form.source, selectedInvoice, selectedOrder]);

  const sourceTotal = useMemo(() => {
    if (form.source === "INVOICE" && selectedInvoice) {
      return selectedInvoice.total_amount;
    }

    if (form.source === "ORDER" && selectedOrder) {
      return selectedOrder.total_amount;
    }

    return 0;
  }, [form.source, selectedInvoice, selectedOrder]);

  const sourcePaid = useMemo(() => {
    if (form.source === "INVOICE" && selectedInvoice) {
      return selectedInvoice.paid_amount;
    }

    if (form.source === "ORDER" && selectedOrder) {
      return selectedOrder.paid_amount;
    }

    return 0;
  }, [form.source, selectedInvoice, selectedOrder]);

  const filteredInvoices = useMemo(() => {
    const clean = invoiceSearch.trim().toLowerCase();

    const base = invoices.filter((item) => item.remaining_amount > 0);

    if (!clean) return base.slice(0, 60);

    return base
      .filter((item) =>
        [
          item.invoice_number,
          item.customer_name,
          item.customer_phone,
          item.order_number,
          String(item.remaining_amount),
        ]
          .join(" ")
          .toLowerCase()
          .includes(clean),
      )
      .slice(0, 60);
  }, [invoiceSearch, invoices]);

  const filteredOrders = useMemo(() => {
    const clean = orderSearch.trim().toLowerCase();

    const base = orders.filter((item) => item.remaining_amount > 0);

    if (!clean) return base.slice(0, 60);

    return base
      .filter((item) =>
        [
          item.order_number,
          item.customer_name,
          item.customer_phone,
          String(item.remaining_amount),
        ]
          .join(" ")
          .toLowerCase()
          .includes(clean),
      )
      .slice(0, 60);
  }, [orderSearch, orders]);

  const filteredCustomers = useMemo(() => {
    const clean = customerSearch.trim().toLowerCase();

    if (!clean) return customers.slice(0, 60);

    return customers
      .filter((item) =>
        [item.name, item.phone, item.email]
          .join(" ")
          .toLowerCase()
          .includes(clean),
      )
      .slice(0, 60);
  }, [customerSearch, customers]);

  const canSubmit =
    canCreate &&
    !authResolving &&
    !isSaving &&
    toNumber(form.amount) > 0 &&
    Boolean(form.payment_date);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setIsDirty(true);

    setErrors((current) => {
      const next = { ...current };
      delete next[key];

      return next;
    });
  }

  function changeSource(source: PaymentSource) {
    setForm((current) => ({
      ...current,
      source,
      invoice_id: source === "INVOICE" ? current.invoice_id : "",
      order_id: source === "ORDER" ? current.order_id : "",
      customer_id: source === "CUSTOMER" ? current.customer_id : "",
      customer_name: source === "MANUAL" ? current.customer_name : "",
      customer_phone: source === "MANUAL" ? current.customer_phone : "",
      customer_email: source === "MANUAL" ? current.customer_email : "",
      amount: "",
    }));

    setErrors({});
    setSubmitError("");
    setIsDirty(true);
  }

  function applyInvoice(invoiceId: string) {
    const invoice = invoices.find((item) => item.id === invoiceId) || null;

    setForm((current) => ({
      ...current,
      source: "INVOICE",
      invoice_id: invoiceId,
      order_id: invoice?.order_id || "",
      customer_id: invoice?.customer_id || "",
      customer_name: invoice?.customer_name || current.customer_name,
      customer_phone: invoice?.customer_phone || current.customer_phone,
      customer_email: current.customer_email,
      amount: toMoneyInput(invoice?.remaining_amount),
      notes:
        invoice && locale === "ar"
          ? `دفعة على الفاتورة ${invoice.invoice_number}`
          : invoice
            ? `Payment for invoice ${invoice.invoice_number}`
            : current.notes,
    }));

    setErrors({});
    setSubmitError("");
    setIsDirty(true);
  }

  function applyOrder(orderId: string) {
    const order = orders.find((item) => item.id === orderId) || null;

    setForm((current) => ({
      ...current,
      source: "ORDER",
      order_id: orderId,
      invoice_id: "",
      customer_id: order?.customer_id || "",
      customer_name: order?.customer_name || current.customer_name,
      customer_phone: order?.customer_phone || current.customer_phone,
      customer_email: current.customer_email,
      amount: toMoneyInput(order?.remaining_amount),
      notes:
        order && locale === "ar"
          ? `دفعة على الطلب ${order.order_number}`
          : order
            ? `Payment for order ${order.order_number}`
            : current.notes,
    }));

    setErrors({});
    setSubmitError("");
    setIsDirty(true);
  }

  function applyCustomer(customerId: string) {
    const customer = customers.find((item) => item.id === customerId) || null;

    setForm((current) => ({
      ...current,
      source: "CUSTOMER",
      customer_id: customerId,
      invoice_id: "",
      order_id: "",
      customer_name: customer?.name || current.customer_name,
      customer_phone: customer?.phone || current.customer_phone,
      customer_email: customer?.email || current.customer_email,
    }));

    setErrors({});
    setSubmitError("");
    setIsDirty(true);
  }

  function validateForm() {
    const nextErrors: FormErrors = {};

    if (form.source === "INVOICE" && !form.invoice_id) {
      nextErrors.invoice_id = t.sourceRequired;
    }

    if (form.source === "ORDER" && !form.order_id) {
      nextErrors.order_id = t.sourceRequired;
    }

    if (form.source === "CUSTOMER" && !form.customer_id) {
      nextErrors.customer_id = t.sourceRequired;
    }

    if (form.source === "MANUAL" && !form.customer_name.trim()) {
      nextErrors.customer_name = t.customerRequired;
    }

    if (!form.payment_date) nextErrors.payment_date = t.required;

    const amount = toNumber(form.amount);

    if (amount <= 0) {
      nextErrors.amount = t.invalidAmount;
    }

    if (
      ["INVOICE", "ORDER"].includes(form.source) &&
      sourceBalance > 0 &&
      amount > sourceBalance
    ) {
      nextErrors.amount = t.amountExceeds;
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  function buildPayload() {
    return {
      source: form.source.toLowerCase(),
      invoice_id: form.source === "INVOICE" ? form.invoice_id || null : null,
      order_id:
        form.source === "ORDER" || form.source === "INVOICE"
          ? form.order_id || null
          : null,
      customer_id:
        form.source !== "MANUAL" ? form.customer_id || null : null,
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim(),
      customer_email: form.customer_email.trim(),
      payment_method: form.payment_method.toLowerCase(),
      status: form.status.toLowerCase(),
      amount: toNumber(form.amount),
      payment_date: form.payment_date,
      reference: form.reference.trim(),
      source_reference: form.reference.trim(),
      notes: form.notes.trim(),
    };
  }

  const loadData = useCallback(
    async (showToast = false) => {
      try {
        setIsLoadingData(true);

        const requests: Array<Promise<void>> = [];

        if (canViewInvoices) {
          requests.push(
            loadCollection<InvoiceOption>({
              endpoints: [
                "/api/invoices/list/?page_size=500",
                "/api/invoices/?page_size=500",
              ],
              key: "invoices",
              normalize: normalizeInvoice,
              setRows: setInvoices,
            }),
          );
        } else {
          setInvoices([]);
        }

        if (canViewOrders) {
          requests.push(
            loadCollection<OrderOption>({
              endpoints: [
                "/api/orders/list/?page_size=500",
                "/api/orders/?page_size=500",
              ],
              key: "orders",
              normalize: normalizeOrder,
              setRows: setOrders,
            }),
          );
        } else {
          setOrders([]);
        }

        if (canViewCustomers) {
          requests.push(
            loadCollection<CustomerOption>({
              endpoints: [
                "/api/customers/list/?page_size=500",
                "/api/customers/?page_size=500",
              ],
              key: "customers",
              normalize: normalizeCustomer,
              setRows: setCustomers,
            }),
          );
        } else {
          setCustomers([]);
        }

        await Promise.all(requests);

        if (showToast) {
          toast.success(locale === "ar" ? "تم تحديث البيانات." : "Data refreshed.");
        }
      } catch (error) {
        console.error("Payment create load data error:", error);
        toast.error(t.loadError);
      } finally {
        setIsLoadingData(false);
      }
    },
    [canViewCustomers, canViewInvoices, canViewOrders, locale, t.loadError],
  );

  async function submitForm() {
    if (!canCreate || isSaving) return;

    const isValid = validateForm();

    if (!isValid) {
      setSubmitError(t.submitError);
      return;
    }

    try {
      setIsSaving(true);
      setSubmitError("");

      const payload = buildPayload();
      const csrfToken = getCookie("csrftoken");
      const endpoints = ["/api/payments/create/", "/api/payments/"];

      let createdId = "";
      let lastError = "";

      for (const endpoint of endpoints) {
        const response = await fetch(apiUrl(endpoint), {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
          },
          body: JSON.stringify(payload),
        });

        const responsePayload = (await response.json().catch(() => null)) as
          | ApiEnvelope<unknown>
          | null;

        if (
          response.ok &&
          responsePayload?.ok !== false &&
          responsePayload?.success !== false
        ) {
          const data = asDict(responsePayload?.data);
          const payment = asDict(data.payment || data.item || responsePayload);

          createdId = String(
            payment.id ||
              data.id ||
              getNestedValue(asDict(responsePayload), ["id", "uuid", "pk"]) ||
              "",
          );

          break;
        }

        lastError =
          responsePayload?.message ||
          responsePayload?.detail ||
          responsePayload?.error ||
          `HTTP ${response.status}`;
      }

      if (!createdId && lastError) {
        throw new Error(lastError);
      }

      toast.success(t.paymentCreated);

      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore local storage failures
      }

      setIsDirty(false);

      if (createdId) {
        window.location.href = `/system/payments/${createdId}`;
        return;
      }

      window.location.href = "/system/payments/list";
    } catch (error) {
      console.error("Payment create submit error:", error);

      const message =
        error instanceof Error && error.message ? error.message : t.submitError;

      setSubmitError(message);
      toast.error(t.submitError);
    } finally {
      setIsSaving(false);
    }
  }

  function saveDraft() {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      toast.success(t.draftSaved);
    } catch (error) {
      console.error("Payment draft save error:", error);
    }
  }

  function clearForm() {
    const confirmed = window.confirm(t.confirmClear);

    if (!confirmed) return;

    setForm(makeDefaultForm());
    setErrors({});
    setSubmitError("");
    setInvoiceSearch("");
    setOrderSearch("");
    setCustomerSearch("");
    setIsDirty(false);

    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore local storage failures
    }

    toast.success(t.draftCleared);
  }

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readLocale();

      applyDocumentLocale(nextLocale);
      setLocale(nextLocale);
    };

    const syncAfterPaint = () => {
      syncLocale();
      window.setTimeout(syncLocale, 0);
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
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY);

      if (!saved) return;

      const parsed = JSON.parse(saved) as Partial<FormState>;

      if (!parsed || typeof parsed !== "object") return;

      setForm({
        ...makeDefaultForm(),
        ...parsed,
      });
      setIsDirty(true);
      toast.success(t.draftRestored);
    } catch (error) {
      console.error("Payment draft restore error:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authResolving) return;
    loadData(false);
  }, [authResolving, loadData]);

  useEffect(() => {
    if (didApplyQueryParams || isLoadingData) return;

    const invoiceId = searchParams.get("invoice") || searchParams.get("invoice_id");
    const orderId = searchParams.get("order") || searchParams.get("order_id");
    const customerId =
      searchParams.get("customer") || searchParams.get("customer_id");

    if (invoiceId && invoices.some((item) => item.id === invoiceId)) {
      applyInvoice(invoiceId);
      setDidApplyQueryParams(true);
      return;
    }

    if (orderId && orders.some((item) => item.id === orderId)) {
      applyOrder(orderId);
      setDidApplyQueryParams(true);
      return;
    }

    if (customerId && customers.some((item) => item.id === customerId)) {
      applyCustomer(customerId);
      setDidApplyQueryParams(true);
      return;
    }

    if (invoiceId || orderId || customerId) {
      setDidApplyQueryParams(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, didApplyQueryParams, invoices, isLoadingData, orders, searchParams]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty || isSaving) return;

      event.preventDefault();
      event.returnValue = t.leaveConfirm;
    };

    window.addEventListener("beforeunload", handler);

    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, isSaving, t.leaveConfirm]);

  if (!authResolving && !canCreate) {
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
          <Link href="/system/payments/list">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Link href="/system/payments">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <CreditCard className="h-4 w-4" />
              <span>{t.dashboard}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadData(true)}
            disabled={isLoadingData || isSaving}
          >
            {isLoadingData ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refreshData}</span>
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={saveDraft}
            disabled={isSaving}
          >
            <Save className="h-4 w-4" />
            <span>{locale === "ar" ? "حفظ مسودة" : "Save Draft"}</span>
          </Button>

          <Button
            className="h-10 rounded-xl"
            onClick={submitForm}
            disabled={!canSubmit}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span>{isSaving ? t.saving : t.save}</span>
          </Button>
        </div>
      </div>

      {submitError ? (
        <Alert className="rounded-2xl border-destructive/20 bg-destructive/5 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t.submitError}</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">
                {t.formTitle}
              </CardTitle>
              <CardDescription>{t.formDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label>{t.source}</Label>
                  <select
                    value={form.source}
                    onChange={(event) =>
                      changeSource(event.target.value as PaymentSource)
                    }
                    disabled={isSaving}
                    className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="INVOICE">{t.fromInvoice}</option>
                    <option value="ORDER">{t.fromOrder}</option>
                    <option value="CUSTOMER">{t.fromCustomer}</option>
                    <option value="MANUAL">{t.manual}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>{t.paymentMethod}</Label>
                  <select
                    value={form.payment_method}
                    onChange={(event) =>
                      updateForm(
                        "payment_method",
                        event.target.value as PaymentMethod,
                      )
                    }
                    disabled={isSaving}
                    className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="CASH">{t.cash}</option>
                    <option value="BANK_TRANSFER">{t.bankTransfer}</option>
                    <option value="GATEWAY">{t.gateway}</option>
                    <option value="CARD">{t.card}</option>
                    <option value="WALLET">{t.wallet}</option>
                    <option value="TAMARA">{t.tamara}</option>
                    <option value="TABBY">{t.tabby}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>{t.status}</Label>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm("status", event.target.value as PaymentStatus)
                    }
                    disabled={isSaving}
                    className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="PENDING">{t.pending}</option>
                    <option value="CONFIRMED">{t.confirmed}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>{t.paymentDate}</Label>
                  <div className="relative">
                    <CalendarDays
                      className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    />
                    <Input
                      type="date"
                      value={form.payment_date}
                      onChange={(event) =>
                        updateForm("payment_date", event.target.value)
                      }
                      disabled={isSaving}
                      dir="ltr"
                      className={`h-11 rounded-xl ${
                        isArabic ? "pr-10" : "pl-10"
                      }`}
                    />
                  </div>
                  {errors.payment_date ? (
                    <p className="text-xs text-destructive">
                      {errors.payment_date}
                    </p>
                  ) : null}
                </div>
              </div>

              {form.source === "INVOICE" ? (
                <SourcePicker
                  title={t.invoice}
                  searchValue={invoiceSearch}
                  onSearchChange={setInvoiceSearch}
                  searchPlaceholder={t.searchInvoice}
                  isLoading={isLoadingData}
                  emptyText={t.noInvoices}
                  error={errors.invoice_id}
                  items={filteredInvoices.map((invoice) => ({
                    id: invoice.id,
                    title: invoice.invoice_number,
                    subtitle: invoice.customer_name,
                    meta: invoice.customer_phone || "-",
                    amount: invoice.remaining_amount,
                    isSelected: form.invoice_id === invoice.id,
                    onClick: () => applyInvoice(invoice.id),
                  }))}
                />
              ) : null}

              {form.source === "ORDER" ? (
                <SourcePicker
                  title={t.order}
                  searchValue={orderSearch}
                  onSearchChange={setOrderSearch}
                  searchPlaceholder={t.searchOrder}
                  isLoading={isLoadingData}
                  emptyText={t.noOrders}
                  error={errors.order_id}
                  items={filteredOrders.map((order) => ({
                    id: order.id,
                    title: order.order_number,
                    subtitle: order.customer_name,
                    meta: order.customer_phone || "-",
                    amount: order.remaining_amount,
                    isSelected: form.order_id === order.id,
                    onClick: () => applyOrder(order.id),
                  }))}
                />
              ) : null}

              {form.source === "CUSTOMER" ? (
                <CustomerPicker
                  title={t.customer}
                  searchValue={customerSearch}
                  onSearchChange={setCustomerSearch}
                  searchPlaceholder={t.searchCustomer}
                  isLoading={isLoadingData}
                  emptyText={t.noCustomers}
                  error={errors.customer_id}
                  customers={filteredCustomers}
                  selectedId={form.customer_id}
                  onSelect={applyCustomer}
                />
              ) : null}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t.customerName}</Label>
                  <Input
                    value={form.customer_name}
                    onChange={(event) =>
                      updateForm("customer_name", event.target.value)
                    }
                    disabled={isSaving || form.source !== "MANUAL"}
                    className="h-11 rounded-xl"
                  />
                  {errors.customer_name ? (
                    <p className="text-xs text-destructive">
                      {errors.customer_name}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>{t.customerPhone}</Label>
                  <Input
                    value={form.customer_phone}
                    onChange={(event) =>
                      updateForm("customer_phone", event.target.value)
                    }
                    disabled={isSaving || form.source !== "MANUAL"}
                    dir="ltr"
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t.customerEmail}</Label>
                  <Input
                    value={form.customer_email}
                    onChange={(event) =>
                      updateForm("customer_email", event.target.value)
                    }
                    disabled={isSaving || form.source !== "MANUAL"}
                    dir="ltr"
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.amount}</Label>
                  <div className="relative">
                    <Input
                      value={form.amount}
                      onChange={(event) =>
                        updateForm("amount", event.target.value)
                      }
                      disabled={isSaving}
                      inputMode="decimal"
                      dir="ltr"
                      className="h-11 rounded-xl pe-10"
                    />
                    <SarIcon
                      className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                        isArabic ? "left-3" : "right-3"
                      }`}
                    />
                  </div>
                  {errors.amount ? (
                    <p className="text-xs text-destructive">{errors.amount}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>{t.reference}</Label>
                  <Input
                    value={form.reference}
                    onChange={(event) =>
                      updateForm("reference", event.target.value)
                    }
                    disabled={isSaving}
                    dir="ltr"
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t.notes}</Label>
                <Textarea
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  disabled={isSaving}
                  className="min-h-[110px] rounded-xl"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">
                {t.summaryTitle}
              </CardTitle>
              <CardDescription>{t.summaryDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex h-14 items-center justify-between rounded-2xl bg-muted/40 px-4">
                <span className="text-sm text-muted-foreground">
                  {t.paymentMethod}
                </span>
                <span className="font-semibold">
                  {paymentMethodLabel(form.payment_method, locale)}
                </span>
              </div>

              <div className="space-y-3 rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {t.selectedSource}
                  </span>
                  <span className="font-semibold">{sourceLabel(form, t)}</span>
                </div>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{t.totalAmount}</span>
                  <MoneyText value={sourceTotal} />
                </div>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{t.paidAmount}</span>
                  <MoneyText value={sourcePaid} />
                </div>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {t.remainingAmount}
                  </span>
                  <MoneyText value={sourceBalance} />
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{t.paymentAmount}</span>
                    <span className="text-lg font-bold">
                      <MoneyText value={form.amount} />
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{t.customer}</span>
                </div>

                <p className="font-semibold">
                  {form.customer_name || t.notSelected}
                </p>
                <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                  {form.customer_phone || "-"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                  {form.customer_email || "-"}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  className="h-11 rounded-xl"
                  onClick={submitForm}
                  disabled={!canSubmit}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {isSaving ? t.saving : t.save}
                </Button>

                <Button
                  variant="outline"
                  className="h-11 rounded-xl"
                  onClick={clearForm}
                  disabled={isSaving}
                >
                  <Trash2 className="h-4 w-4" />
                  {t.clear}
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* ============================================================
   Small Components / Helpers
============================================================ */

async function loadCollection<T>({
  endpoints,
  key,
  normalize,
  setRows,
}: {
  endpoints: string[];
  key: string;
  normalize: (item: unknown, index: number) => T;
  setRows: (rows: T[]) => void;
}) {
  let payload: ApiEnvelope<unknown> | null = null;

  for (const endpoint of endpoints) {
    const response = await fetch(apiUrl(endpoint), {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    const responsePayload = (await response.json().catch(() => null)) as
      | ApiEnvelope<unknown>
      | null;

    if (
      response.ok &&
      responsePayload?.ok !== false &&
      responsePayload?.success !== false
    ) {
      payload = responsePayload;
      break;
    }
  }

  const normalizedRows = extractRows(payload, key)
    .map(normalize)
    .filter(Boolean);

  setRows(normalizedRows);
}

function sourceLabel(form: FormState, t: ReturnType<typeof dictionary>) {
  if (form.source === "INVOICE") return t.fromInvoice;
  if (form.source === "ORDER") return t.fromOrder;
  if (form.source === "CUSTOMER") return t.fromCustomer;

  return t.manual;
}

function SourcePicker({
  title,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  isLoading,
  emptyText,
  error,
  items,
}: {
  title: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  isLoading: boolean;
  emptyText: string;
  error?: string;
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    meta: string;
    amount: number;
    isSelected: boolean;
    onClick: () => void;
  }>;
}) {
  return (
    <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>{title}</Label>
        </div>

        <Badge variant="outline" className="rounded-full">
          {formatNumber(items.length)}
        </Badge>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 ltr:right-auto" />
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-11 rounded-xl pr-10 ltr:pl-10 ltr:pr-3"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonLine key={index} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`rounded-xl border p-3 text-start transition hover:bg-muted/50 ${
                item.isSelected ? "border-primary bg-primary/5" : "bg-background"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold" dir="ltr">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.subtitle}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                    {item.meta}
                  </p>
                </div>

                <div className="text-end text-sm font-semibold">
                  <MoneyText value={item.amount} />
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      )}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function CustomerPicker({
  title,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  isLoading,
  emptyText,
  error,
  customers,
  selectedId,
  onSelect,
}: {
  title: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  isLoading: boolean;
  emptyText: string;
  error?: string;
  customers: CustomerOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <Label>{title}</Label>
        <Badge variant="outline" className="rounded-full">
          {formatNumber(customers.length)}
        </Badge>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 ltr:right-auto" />
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-11 rounded-xl pr-10 ltr:pl-10 ltr:pr-3"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonLine key={index} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : customers.length > 0 ? (
        <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
          {customers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => onSelect(customer.id)}
              className={`rounded-xl border p-3 text-start transition hover:bg-muted/50 ${
                selectedId === customer.id
                  ? "border-primary bg-primary/5"
                  : "bg-background"
              }`}
            >
              <p className="font-semibold">{customer.name}</p>
              <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                {customer.phone || "-"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                {customer.email || "-"}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      )}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}