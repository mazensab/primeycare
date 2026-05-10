"use client";

/* ============================================================
   📂 app/system/invoices/create/page.tsx
   🧠 Primey Care | Create Invoice

   ✅ المسار:
      app/system/invoices/create/page.tsx

   ✅ العمل:
      صفحة إنشاء فاتورة داخل النظام.
      تدعم إنشاء فاتورة من طلب أو إنشاء فاتورة يدوية مع بنود الفاتورة.

   ✅ الإصدار:
      Phase 17 UX Refinement + Phase 2 Permissions

   ✅ يعتمد على:
      - /api/invoices/create/
      - /api/invoices/
      - /api/orders/list/
      - /api/orders/
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Invoices dashboard page
      - Invoices list page
      - Invoices detail page
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - إنشاء فاتورة من طلب.
      - إنشاء فاتورة يدوية.
      - بنود متعددة للفاتورة.
      - حساب الإجمالي والخصم والضريبة والمتبقي محليًا.
      - Main Form + Sidebar Summary.
      - Error Alert داخلي.
      - Field-level validation.
      - beforeunload protection.
      - حفظ واستعادة مسودة محلية.
      - تأكيد مسح النموذج.
      - تعطيل الحقول أثناء الحفظ.
      - تنظيف البيانات قبل الإرسال.
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
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  PlusCircle,
  RefreshCcw,
  Save,
  Search,
  Trash2,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";
type Dict = Record<string, unknown>;

type InvoiceSource = "ORDER" | "MANUAL";
type InvoiceStatus = "DRAFT" | "ISSUED";

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
  orders?: unknown[];
};

type OrderOption = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
};

type InvoiceItem = {
  local_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  discount_amount: string;
  tax_rate: string;
};

type FormState = {
  source: InvoiceSource;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  source_reference: string;
  notes: string;
  items: InvoiceItem[];
};

type FormErrors = Partial<Record<keyof FormState | `item_${string}`, string>>;

type Totals = {
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  tax_amount: number;
  total_amount: number;
};

const SAR_ICON_PATH = "/currency/sar.svg";
const DRAFT_KEY = "primey-care-invoice-create-draft-v1";

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
    title: isArabic ? "إنشاء فاتورة" : "Create Invoice",
    subtitle: isArabic
      ? "أنشئ فاتورة من طلب قائم أو فاتورة يدوية مع بنود ومبالغ واضحة."
      : "Create an invoice from an existing order or manually with clear line items.",

    back: isArabic ? "قائمة الفواتير" : "Invoices List",
    dashboard: isArabic ? "الفواتير" : "Invoices",
    refreshOrders: isArabic ? "تحديث الطلبات" : "Refresh Orders",
    save: isArabic ? "حفظ الفاتورة" : "Save Invoice",
    saving: isArabic ? "جار الحفظ..." : "Saving...",
    clear: isArabic ? "مسح النموذج" : "Clear Form",

    accessDeniedTitle: isArabic ? "غير مصرح بإنشاء الفواتير" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية إنشاء الفواتير. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to create invoices. Contact your system administrator if you need access.",

    formTitle: isArabic ? "بيانات الفاتورة" : "Invoice Information",
    formDesc: isArabic
      ? "اختر مصدر الفاتورة وأدخل بيانات العميل والبنود."
      : "Choose the invoice source and enter customer and line item details.",

    source: isArabic ? "مصدر الفاتورة" : "Invoice Source",
    fromOrder: isArabic ? "من طلب" : "From Order",
    manual: isArabic ? "يدوية" : "Manual",
    order: isArabic ? "الطلب" : "Order",
    orderPlaceholder: isArabic ? "اختر الطلب" : "Select order",
    searchOrder: isArabic ? "ابحث داخل الطلبات..." : "Search orders...",
    customerName: isArabic ? "اسم العميل" : "Customer Name",
    customerPhone: isArabic ? "جوال العميل" : "Customer Phone",
    customerEmail: isArabic ? "البريد الإلكتروني" : "Email",
    issueDate: isArabic ? "تاريخ الإصدار" : "Issue Date",
    dueDate: isArabic ? "تاريخ الاستحقاق" : "Due Date",
    status: isArabic ? "حالة الفاتورة" : "Invoice Status",
    draft: isArabic ? "مسودة" : "Draft",
    issued: isArabic ? "مصدرة" : "Issued",
    sourceReference: isArabic ? "مرجع خارجي" : "External Reference",
    notes: isArabic ? "ملاحظات" : "Notes",

    itemsTitle: isArabic ? "بنود الفاتورة" : "Invoice Items",
    addItem: isArabic ? "إضافة بند" : "Add Item",
    description: isArabic ? "الوصف" : "Description",
    quantity: isArabic ? "الكمية" : "Qty",
    unitPrice: isArabic ? "سعر الوحدة" : "Unit Price",
    discount: isArabic ? "خصم" : "Discount",
    taxRate: isArabic ? "الضريبة %" : "Tax %",
    lineTotal: isArabic ? "الإجمالي" : "Total",
    action: isArabic ? "الإجراء" : "Action",

    summaryTitle: isArabic ? "ملخص الفاتورة" : "Invoice Summary",
    summaryDesc: isArabic
      ? "ملخص المبالغ المحسوبة قبل الحفظ."
      : "Calculated totals before saving.",
    subtotal: isArabic ? "الإجمالي قبل الخصم" : "Subtotal",
    discountAmount: isArabic ? "إجمالي الخصم" : "Total Discount",
    taxableAmount: isArabic ? "المبلغ الخاضع للضريبة" : "Taxable Amount",
    taxAmount: isArabic ? "الضريبة" : "Tax",
    totalAmount: isArabic ? "إجمالي الفاتورة" : "Invoice Total",
    itemsCount: isArabic ? "عدد البنود" : "Items Count",

    draftSaved: isArabic ? "تم حفظ المسودة محليًا." : "Draft saved locally.",
    draftRestored: isArabic ? "تم استعادة المسودة." : "Draft restored.",
    draftCleared: isArabic ? "تم مسح النموذج." : "Form cleared.",
    confirmClear: isArabic
      ? "هل تريد مسح النموذج الحالي؟"
      : "Clear the current form?",
    leaveConfirm: isArabic
      ? "لديك تغييرات غير محفوظة."
      : "You have unsaved changes.",

    ordersLoadError: isArabic
      ? "تعذر تحميل الطلبات."
      : "Unable to load orders.",
    invoiceCreated: isArabic
      ? "تم إنشاء الفاتورة بنجاح."
      : "Invoice created successfully.",
    submitError: isArabic
      ? "تعذر إنشاء الفاتورة."
      : "Unable to create invoice.",

    required: isArabic ? "هذا الحقل مطلوب." : "This field is required.",
    orderRequired: isArabic ? "اختر الطلب." : "Select an order.",
    itemRequired: isArabic
      ? "أدخل وصف البند وسعره."
      : "Enter item description and price.",
    invalidAmount: isArabic
      ? "تحقق من المبالغ والكميات."
      : "Check amounts and quantities.",
    noOrders: isArabic ? "لا توجد طلبات متاحة" : "No orders available",
  };
}

/* ============================================================
   Helpers
============================================================ */

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

function createLocalId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

  for (const container of ["customer", "client", "order", "item", "data"]) {
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
    total_amount: totalAmount,
    paid_amount: paidAmount,
    remaining_amount:
      remainingValue !== undefined && remainingValue !== null
        ? toNumber(remainingValue)
        : Math.max(totalAmount - paidAmount, 0),
    status: String(getNestedValue(obj, ["status", "state"]) || ""),
  };
}

function makeEmptyItem(): InvoiceItem {
  return {
    local_id: createLocalId(),
    description: "",
    quantity: "1",
    unit_price: "",
    discount_amount: "",
    tax_rate: "15",
  };
}

function makeDefaultForm(): FormState {
  return {
    source: "ORDER",
    order_id: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    issue_date: todayDate(),
    due_date: addDays(7),
    status: "DRAFT",
    source_reference: "",
    notes: "",
    items: [makeEmptyItem()],
  };
}

function calculateItemTotal(item: InvoiceItem) {
  const quantity = Math.max(toNumber(item.quantity), 0);
  const unitPrice = Math.max(toNumber(item.unit_price), 0);
  const discount = Math.max(toNumber(item.discount_amount), 0);
  const taxRate = Math.max(toNumber(item.tax_rate), 0);

  const gross = quantity * unitPrice;
  const net = Math.max(gross - discount, 0);
  const tax = net * (taxRate / 100);

  return {
    gross,
    discount: Math.min(discount, gross),
    net,
    tax,
    total: net + tax,
  };
}

function calculateTotals(items: InvoiceItem[]): Totals {
  return items.reduce<Totals>(
    (acc, item) => {
      const line = calculateItemTotal(item);

      acc.subtotal += line.gross;
      acc.discount_amount += line.discount;
      acc.taxable_amount += line.net;
      acc.tax_amount += line.tax;
      acc.total_amount += line.total;

      return acc;
    },
    {
      subtotal: 0,
      discount_amount: 0,
      taxable_amount: 0,
      tax_amount: 0,
      total_amount: 0,
    },
  );
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

export default function SystemCreateInvoicePage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [form, setForm] = useState<FormState>(() => makeDefaultForm());
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canViewOrders = hasSafePermission(
    auth,
    ["orders.view", "orders.list", "invoices.create"],
    "view",
  );

  const canCreate = hasSafePermission(
    auth,
    ["invoices.create", "billing.invoices.create"],
    "action",
  );

  const totals = useMemo(() => calculateTotals(form.items), [form.items]);

  const selectedOrder = useMemo(
    () => orders.find((item) => item.id === form.order_id) || null,
    [form.order_id, orders],
  );

  const filteredOrders = useMemo(() => {
    const cleanSearch = orderSearch.trim().toLowerCase();

    if (!cleanSearch) return orders.slice(0, 60);

    return orders
      .filter((item) =>
        [
          item.order_number,
          item.customer_name,
          item.customer_phone,
          item.status,
          String(item.total_amount),
        ]
          .join(" ")
          .toLowerCase()
          .includes(cleanSearch),
      )
      .slice(0, 60);
  }, [orderSearch, orders]);

  const canSubmit =
    canCreate &&
    !authResolving &&
    !isSaving &&
    (form.source === "MANUAL" || Boolean(form.order_id));

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

  function updateItem(localId: string, key: keyof InvoiceItem, value: string) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.local_id === localId ? { ...item, [key]: value } : item,
      ),
    }));
    setIsDirty(true);

    setErrors((current) => {
      const next = { ...current };
      delete next[`item_${localId}`];

      return next;
    });
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, makeEmptyItem()],
    }));
    setIsDirty(true);
  }

  function removeItem(localId: string) {
    setForm((current) => ({
      ...current,
      items:
        current.items.length <= 1
          ? current.items
          : current.items.filter((item) => item.local_id !== localId),
    }));
    setIsDirty(true);
  }

  function applyOrder(orderId: string) {
    const order = orders.find((item) => item.id === orderId) || null;

    setForm((current) => ({
      ...current,
      order_id: orderId,
      customer_name: order?.customer_name || current.customer_name,
      customer_phone: order?.customer_phone || current.customer_phone,
      items:
        order && order.total_amount > 0
          ? [
              {
                local_id: createLocalId(),
                description:
                  locale === "ar"
                    ? `فاتورة للطلب ${order.order_number}`
                    : `Invoice for order ${order.order_number}`,
                quantity: "1",
                unit_price: toMoneyInput(order.total_amount),
                discount_amount: "",
                tax_rate: "0",
              },
            ]
          : current.items,
    }));

    setErrors((current) => {
      const next = { ...current };
      delete next.order_id;
      delete next.customer_name;

      return next;
    });

    setIsDirty(true);
  }

  function validateForm() {
    const nextErrors: FormErrors = {};

    if (form.source === "ORDER" && !form.order_id) {
      nextErrors.order_id = t.orderRequired;
    }

    if (form.source === "MANUAL" && !form.customer_name.trim()) {
      nextErrors.customer_name = t.required;
    }

    if (!form.issue_date) nextErrors.issue_date = t.required;
    if (!form.due_date) nextErrors.due_date = t.required;

    const validItems = form.items.filter((item) => {
      const quantity = toNumber(item.quantity);
      const unitPrice = toNumber(item.unit_price);

      return item.description.trim() && quantity > 0 && unitPrice >= 0;
    });

    if (validItems.length === 0) {
      nextErrors.items = t.itemRequired;
    }

    form.items.forEach((item) => {
      const quantity = toNumber(item.quantity);
      const unitPrice = toNumber(item.unit_price);
      const discount = toNumber(item.discount_amount);

      if (!item.description.trim() || quantity <= 0 || unitPrice < 0) {
        nextErrors[`item_${item.local_id}`] = t.itemRequired;
      }

      if (discount < 0 || discount > quantity * unitPrice) {
        nextErrors[`item_${item.local_id}`] = t.invalidAmount;
      }
    });

    if (totals.total_amount <= 0) {
      nextErrors.items = t.invalidAmount;
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  function buildPayload() {
    const cleanedItems = form.items
      .map((item) => {
        const line = calculateItemTotal(item);

        return {
          description: item.description.trim(),
          quantity: toNumber(item.quantity),
          unit_price: toNumber(item.unit_price),
          discount_amount: line.discount,
          tax_rate: toNumber(item.tax_rate),
          tax_amount: line.tax,
          subtotal: line.gross,
          total_amount: line.total,
        };
      })
      .filter((item) => item.description && item.quantity > 0);

    return {
      source: form.source.toLowerCase(),
      order_id: form.source === "ORDER" ? form.order_id || null : null,
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim(),
      customer_email: form.customer_email.trim(),
      issue_date: form.issue_date,
      due_date: form.due_date,
      status: form.status.toLowerCase(),
      source_reference: form.source_reference.trim(),
      notes: form.notes.trim(),
      subtotal: totals.subtotal,
      discount_amount: totals.discount_amount,
      taxable_amount: totals.taxable_amount,
      tax_amount: totals.tax_amount,
      total_amount: totals.total_amount,
      items: cleanedItems,
    };
  }

  const loadOrders = useCallback(
    async (showToast = false) => {
      if (!canViewOrders) {
        setOrders([]);
        setIsLoadingOrders(false);
        return;
      }

      try {
        setIsLoadingOrders(true);

        const endpoints = [
          "/api/orders/list/?page_size=500",
          "/api/orders/?page_size=500",
        ];

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

        const normalizedOrders = extractRows(payload, "orders")
          .map(normalizeOrder)
          .filter((item) => item.id && item.order_number);

        setOrders(normalizedOrders);

        if (showToast) {
          toast.success(locale === "ar" ? "تم تحديث الطلبات." : "Orders refreshed.");
        }
      } catch (error) {
        console.error("Invoice create orders load error:", error);
        setOrders([]);
        toast.error(t.ordersLoadError);
      } finally {
        setIsLoadingOrders(false);
      }
    },
    [canViewOrders, locale, t.ordersLoadError],
  );

  async function submitForm() {
    if (!canCreate || isSaving) return;

    const isValid = validateForm();

    if (!isValid) {
      setSubmitError(t.invalidAmount);
      return;
    }

    try {
      setIsSaving(true);
      setSubmitError("");

      const payload = buildPayload();
      const csrfToken = getCookie("csrftoken");

      const endpoints = ["/api/invoices/create/", "/api/invoices/"];

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
          const invoice = asDict(data.invoice || data.item || responsePayload);

          createdId = String(
            invoice.id ||
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

      toast.success(t.invoiceCreated);

      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore local storage failures
      }

      setIsDirty(false);

      if (createdId) {
        window.location.href = `/system/invoices/${createdId}`;
        return;
      }

      window.location.href = "/system/invoices/list";
    } catch (error) {
      console.error("Invoice create submit error:", error);

      const message =
        error instanceof Error && error.message
          ? error.message
          : t.submitError;

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
      console.error("Invoice draft save error:", error);
    }
  }

  function clearForm() {
    const confirmed = window.confirm(t.confirmClear);

    if (!confirmed) return;

    setForm(makeDefaultForm());
    setErrors({});
    setSubmitError("");
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
    if (authResolving) return;
    loadOrders(false);
  }, [authResolving, loadOrders]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY);

      if (!saved) return;

      const parsed = JSON.parse(saved) as Partial<FormState>;

      if (!parsed || typeof parsed !== "object") return;

      setForm({
        ...makeDefaultForm(),
        ...parsed,
        items:
          Array.isArray(parsed.items) && parsed.items.length > 0
            ? parsed.items
            : [makeEmptyItem()],
      });
      setIsDirty(true);
      toast.success(t.draftRestored);
    } catch (error) {
      console.error("Invoice draft restore error:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <Link href="/system/invoices/list">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Link href="/system/invoices">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <FileText className="h-4 w-4" />
              <span>{t.dashboard}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadOrders(true)}
            disabled={isLoadingOrders || isSaving}
          >
            {isLoadingOrders ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refreshOrders}</span>
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

      {errors.items ? (
        <Alert className="rounded-2xl border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t.itemsTitle}</AlertTitle>
          <AlertDescription>{errors.items}</AlertDescription>
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
                    onChange={(event) => {
                      const source = event.target.value as InvoiceSource;

                      updateForm("source", source);

                      if (source === "MANUAL") {
                        updateForm("order_id", "");
                      }
                    }}
                    disabled={isSaving}
                    className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="ORDER">{t.fromOrder}</option>
                    <option value="MANUAL">{t.manual}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>{t.status}</Label>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm("status", event.target.value as InvoiceStatus)
                    }
                    disabled={isSaving}
                    className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="DRAFT">{t.draft}</option>
                    <option value="ISSUED">{t.issued}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>{t.issueDate}</Label>
                  <div className="relative">
                    <CalendarDays
                      className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    />
                    <Input
                      type="date"
                      value={form.issue_date}
                      onChange={(event) =>
                        updateForm("issue_date", event.target.value)
                      }
                      disabled={isSaving}
                      dir="ltr"
                      className={`h-11 rounded-xl ${
                        isArabic ? "pr-10" : "pl-10"
                      }`}
                    />
                  </div>
                  {errors.issue_date ? (
                    <p className="text-xs text-destructive">
                      {errors.issue_date}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>{t.dueDate}</Label>
                  <div className="relative">
                    <CalendarDays
                      className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    />
                    <Input
                      type="date"
                      value={form.due_date}
                      onChange={(event) =>
                        updateForm("due_date", event.target.value)
                      }
                      disabled={isSaving}
                      dir="ltr"
                      className={`h-11 rounded-xl ${
                        isArabic ? "pr-10" : "pl-10"
                      }`}
                    />
                  </div>
                  {errors.due_date ? (
                    <p className="text-xs text-destructive">
                      {errors.due_date}
                    </p>
                  ) : null}
                </div>
              </div>

              {form.source === "ORDER" ? (
                <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <Label>{t.order}</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.orderPlaceholder}
                      </p>
                    </div>

                    <Badge variant="outline" className="w-fit rounded-full">
                      {formatNumber(filteredOrders.length)}
                    </Badge>
                  </div>

                  <div className="relative">
                    <Search
                      className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                        isArabic ? "right-3" : "left-3"
                      }`}
                    />
                    <Input
                      value={orderSearch}
                      onChange={(event) => setOrderSearch(event.target.value)}
                      placeholder={t.searchOrder}
                      disabled={isSaving}
                      className={`h-11 rounded-xl ${
                        isArabic ? "pr-10" : "pl-10"
                      }`}
                    />
                  </div>

                  {isLoadingOrders ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <SkeletonLine key={index} className="h-14 rounded-xl" />
                      ))}
                    </div>
                  ) : filteredOrders.length > 0 ? (
                    <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
                      {filteredOrders.map((order) => {
                        const isSelected = form.order_id === order.id;

                        return (
                          <button
                            key={order.id}
                            type="button"
                            onClick={() => applyOrder(order.id)}
                            disabled={isSaving}
                            className={`rounded-xl border p-3 text-start transition hover:bg-muted/50 ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "bg-background"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold" dir="ltr">
                                  {order.order_number}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {order.customer_name}
                                </p>
                                <p
                                  className="mt-1 text-xs text-muted-foreground"
                                  dir="ltr"
                                >
                                  {order.customer_phone || "-"}
                                </p>
                              </div>

                              <div className="text-end text-sm font-semibold">
                                <MoneyText value={order.total_amount} />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      {t.noOrders}
                    </div>
                  )}

                  {errors.order_id ? (
                    <p className="text-xs text-destructive">{errors.order_id}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t.customerName}</Label>
                  <Input
                    value={form.customer_name}
                    onChange={(event) =>
                      updateForm("customer_name", event.target.value)
                    }
                    disabled={isSaving || form.source === "ORDER"}
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
                    disabled={isSaving || form.source === "ORDER"}
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
                    disabled={isSaving}
                    dir="ltr"
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.sourceReference}</Label>
                  <Input
                    value={form.source_reference}
                    onChange={(event) =>
                      updateForm("source_reference", event.target.value)
                    }
                    disabled={isSaving}
                    dir="ltr"
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t.notes}</Label>
                  <Input
                    value={form.notes}
                    onChange={(event) => updateForm("notes", event.target.value)}
                    disabled={isSaving}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base font-bold">
                  {t.itemsTitle}
                </CardTitle>
                <CardDescription>{t.summaryDesc}</CardDescription>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={addItem}
                disabled={isSaving}
              >
                <PlusCircle className="h-4 w-4" />
                {t.addItem}
              </Button>
            </CardHeader>

            <CardContent>
              <div className="overflow-hidden rounded-xl border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[260px]">
                          {t.description}
                        </TableHead>
                        <TableHead className="min-w-[100px]">
                          {t.quantity}
                        </TableHead>
                        <TableHead className="min-w-[130px]">
                          {t.unitPrice}
                        </TableHead>
                        <TableHead className="min-w-[120px]">
                          {t.discount}
                        </TableHead>
                        <TableHead className="min-w-[100px]">
                          {t.taxRate}
                        </TableHead>
                        <TableHead className="min-w-[140px]">
                          {t.lineTotal}
                        </TableHead>
                        <TableHead className="min-w-[90px]">
                          {t.action}
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {form.items.map((item) => {
                        const line = calculateItemTotal(item);
                        const itemError = errors[`item_${item.local_id}`];

                        return (
                          <TableRow key={item.local_id}>
                            <TableCell>
                              <Textarea
                                value={item.description}
                                onChange={(event) =>
                                  updateItem(
                                    item.local_id,
                                    "description",
                                    event.target.value,
                                  )
                                }
                                disabled={isSaving}
                                className="min-h-[72px] rounded-xl"
                              />
                              {itemError ? (
                                <p className="mt-1 text-xs text-destructive">
                                  {itemError}
                                </p>
                              ) : null}
                            </TableCell>

                            <TableCell>
                              <Input
                                value={item.quantity}
                                onChange={(event) =>
                                  updateItem(
                                    item.local_id,
                                    "quantity",
                                    event.target.value,
                                  )
                                }
                                disabled={isSaving}
                                inputMode="decimal"
                                dir="ltr"
                                className="h-10 rounded-xl"
                              />
                            </TableCell>

                            <TableCell>
                              <Input
                                value={item.unit_price}
                                onChange={(event) =>
                                  updateItem(
                                    item.local_id,
                                    "unit_price",
                                    event.target.value,
                                  )
                                }
                                disabled={isSaving}
                                inputMode="decimal"
                                dir="ltr"
                                className="h-10 rounded-xl"
                              />
                            </TableCell>

                            <TableCell>
                              <Input
                                value={item.discount_amount}
                                onChange={(event) =>
                                  updateItem(
                                    item.local_id,
                                    "discount_amount",
                                    event.target.value,
                                  )
                                }
                                disabled={isSaving}
                                inputMode="decimal"
                                dir="ltr"
                                className="h-10 rounded-xl"
                              />
                            </TableCell>

                            <TableCell>
                              <Input
                                value={item.tax_rate}
                                onChange={(event) =>
                                  updateItem(
                                    item.local_id,
                                    "tax_rate",
                                    event.target.value,
                                  )
                                }
                                disabled={isSaving}
                                inputMode="decimal"
                                dir="ltr"
                                className="h-10 rounded-xl"
                              />
                            </TableCell>

                            <TableCell className="font-semibold">
                              <MoneyText value={line.total} />
                            </TableCell>

                            <TableCell>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 rounded-xl text-destructive"
                                onClick={() => removeItem(item.local_id)}
                                disabled={isSaving || form.items.length <= 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
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
                  {t.itemsCount}
                </span>
                <span className="font-semibold">
                  {formatNumber(form.items.length)}
                </span>
              </div>

              <div className="space-y-3 rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{t.subtotal}</span>
                  <MoneyText value={totals.subtotal} />
                </div>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {t.discountAmount}
                  </span>
                  <MoneyText value={totals.discount_amount} />
                </div>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {t.taxableAmount}
                  </span>
                  <MoneyText value={totals.taxable_amount} />
                </div>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{t.taxAmount}</span>
                  <MoneyText value={totals.tax_amount} />
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{t.totalAmount}</span>
                    <span className="text-lg font-bold">
                      <MoneyText value={totals.total_amount} />
                    </span>
                  </div>
                </div>
              </div>

              {selectedOrder ? (
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <WalletCards className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{t.order}</span>
                  </div>

                  <p className="font-semibold" dir="ltr">
                    {selectedOrder.order_number}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedOrder.customer_name}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t.totalAmount}
                    </span>
                    <MoneyText value={selectedOrder.total_amount} />
                  </div>
                </div>
              ) : null}

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