"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Copy,
  CreditCard,
  Edit3,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Printer,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { apiDelete, apiGet, API_PATHS } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ============================================================
   📂 app/system/customers/[id]/page.tsx
   🧠 Primey Care | Customer Detail Page
   ------------------------------------------------------------
   ✅ مرتبط مع lib/api.ts
   ✅ Customer Detail + Statement
   ✅ بيانات التواصل والعنوان والهوية
   ✅ روابط تشغيلية للطلبات والفواتير والمدفوعات
   ✅ حذف العميل
   ✅ دعم عربي / إنجليزي
   ✅ استخدام رمز العملة /currency/sar.svg
============================================================ */

type AppLocale = "ar" | "en";

type CustomerStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "BLOCKED"
  | "LEAD"
  | "UNKNOWN";

type CustomerType = "INDIVIDUAL" | "CORPORATE" | "UNKNOWN";

type CustomerDetail = {
  id: number | string;
  code: string;
  name: string;
  customerType: CustomerType;
  status: CustomerStatus;
  source: string;

  firstName: string;
  lastName: string;
  companyName: string;
  gender: string;
  dateOfBirth: string;

  email: string;
  phone: string;
  whatsapp: string;
  alternativePhone: string;
  primaryContact: string;

  nationalId: string;
  passportNumber: string;
  nationality: string;

  country: string;
  city: string;
  district: string;
  streetAddress: string;
  postalCode: string;
  nationalAddressText: string;

  notes: string;
  tags: string;

  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type CustomerDetailResponse = {
  ok?: boolean;
  message?: string;
  customer?: unknown;
  data?: unknown;
};

type StatementResponse = {
  ok?: boolean;
  message?: string;
  customer?: unknown;
  statement?: {
    summary?: StatementSummary;
    lines?: StatementLine[];
  };
  data?: {
    statement?: {
      summary?: StatementSummary;
      lines?: StatementLine[];
    };
    summary?: StatementSummary;
    lines?: StatementLine[];
  };
  summary?: StatementSummary;
  lines?: StatementLine[];
};

type StatementSummary = {
  customer_id?: number;
  customer_code?: string;
  customer_name?: string;
  customer_status?: string;
  primary_contact?: string;
  total_orders_count?: number;
  total_orders_amount?: string;
  total_invoices_count?: number;
  total_invoices_amount?: string;
  total_paid_amount?: string;
  total_due_amount?: string;
  currency?: string;
};

type StatementLine = {
  line_type: string;
  line_date: string | null;
  reference: string;
  related_order_id?: number | null;
  related_invoice_id?: number | null;
  related_payment_id?: number | null;
  description: string;
  debit_amount: string;
  credit_amount: string;
  balance_after: string;
  currency: string;
  status: string;
  metadata?: Record<string, unknown>;
};

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

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    pageSubtitle: ar
      ? "عرض الملف الكامل للعميل، بيانات التواصل، العنوان، الملخص المالي، وكشف الحساب."
      : "View customer profile, contact data, address, financial summary, and statement.",

    back: ar ? "قائمة العملاء" : "Customers List",
    refresh: ar ? "تحديث" : "Refresh",
    print: ar ? "طباعة" : "Print",
    edit: ar ? "تعديل" : "Edit",
    delete: ar ? "حذف" : "Delete",
    copyCode: ar ? "نسخ الكود" : "Copy Code",

    liveData: ar ? "بيانات حقيقية" : "Live Data",
    customerProfile: ar ? "ملف العميل" : "Customer Profile",
    profileSubtitle: ar
      ? "البيانات الأساسية والتعريفية للعميل."
      : "Basic and identity information for the customer.",

    financialSummary: ar ? "الملخص المالي" : "Financial Summary",

    statementTitle: ar ? "كشف حساب العميل" : "Customer Statement",
    statementSubtitle: ar
      ? "الحركات المالية المرتبطة بالعميل حسب الفواتير والمدفوعات."
      : "Financial movements linked to the customer through invoices and payments.",

    contactInfo: ar ? "بيانات التواصل" : "Contact Information",
    addressInfo: ar ? "العنوان" : "Address",
    legalInfo: ar ? "البيانات النظامية" : "Legal Information",
    notesInfo: ar ? "ملاحظات وتصنيفات" : "Notes & Tags",
    operationalLinks: ar ? "روابط تشغيلية" : "Operational Links",

    customerCode: ar ? "كود العميل" : "Customer Code",
    customerType: ar ? "نوع العميل" : "Customer Type",
    status: ar ? "الحالة" : "Status",
    source: ar ? "المصدر" : "Source",
    gender: ar ? "الجنس" : "Gender",
    dateOfBirth: ar ? "تاريخ الميلاد" : "Date of Birth",
    createdAt: ar ? "تاريخ الإنشاء" : "Created At",
    updatedAt: ar ? "آخر تحديث" : "Updated At",

    email: ar ? "البريد الإلكتروني" : "Email",
    phone: ar ? "الجوال" : "Phone",
    whatsapp: ar ? "الواتساب" : "WhatsApp",
    alternativePhone: ar ? "رقم بديل" : "Alternative Phone",

    nationalId: ar ? "الهوية / الإقامة" : "National ID / Iqama",
    passportNumber: ar ? "رقم الجواز" : "Passport Number",
    nationality: ar ? "الجنسية" : "Nationality",

    country: ar ? "الدولة" : "Country",
    city: ar ? "المدينة" : "City",
    district: ar ? "الحي" : "District",
    streetAddress: ar ? "العنوان" : "Street Address",
    postalCode: ar ? "الرمز البريدي" : "Postal Code",
    nationalAddress: ar ? "العنوان الوطني" : "National Address",

    notes: ar ? "ملاحظات" : "Notes",
    tags: ar ? "وسوم" : "Tags",

    totalOrders: ar ? "عدد الطلبات" : "Orders",
    invoicesAmount: ar ? "إجمالي الفواتير" : "Invoices Amount",
    paidAmount: ar ? "إجمالي المدفوع" : "Paid Amount",
    dueAmount: ar ? "المتبقي" : "Due Amount",

    invoices: ar ? "الفواتير" : "Invoices",
    payments: ar ? "المدفوعات" : "Payments",
    orders: ar ? "الطلبات" : "Orders",

    table: {
      date: ar ? "التاريخ" : "Date",
      reference: ar ? "المرجع" : "Reference",
      type: ar ? "النوع" : "Type",
      description: ar ? "الوصف" : "Description",
      debit: ar ? "مدين" : "Debit",
      credit: ar ? "دائن" : "Credit",
      balance: ar ? "الرصيد" : "Balance",
      status: ar ? "الحالة" : "Status",
    },

    active: ar ? "نشط" : "Active",
    inactive: ar ? "غير نشط" : "Inactive",
    blocked: ar ? "محظور" : "Blocked",
    lead: ar ? "عميل محتمل" : "Lead",
    unknown: ar ? "غير محدد" : "Unknown",

    individual: ar ? "فرد" : "Individual",
    corporate: ar ? "شركة" : "Corporate",

    invoice: ar ? "فاتورة" : "Invoice",
    payment: ar ? "دفعة" : "Payment",
    order: ar ? "طلب" : "Order",

    loading: ar ? "جاري تحميل بيانات العميل..." : "Loading customer data...",
    loadError: ar ? "تعذر تحميل بيانات العميل." : "Failed to load customer.",
    statementError: ar
      ? "تعذر تحميل كشف حساب العميل."
      : "Failed to load customer statement.",
    emptyStatement: ar
      ? "لا توجد حركات في كشف الحساب."
      : "No statement lines.",
    copied: ar ? "تم النسخ بنجاح." : "Copied successfully.",
    refreshed: ar ? "تم تحديث بيانات العميل." : "Customer data refreshed.",
    deleteConfirm: ar
      ? "هل تريد حذف هذا العميل؟ لا يمكن التراجع عن هذه العملية."
      : "Do you want to delete this customer? This action cannot be undone.",
    deleteSuccess: ar ? "تم حذف العميل بنجاح." : "Customer deleted successfully.",
    deleteError: ar ? "تعذر حذف العميل." : "Failed to delete customer.",
  };
}

function pickString(
  obj: Record<string, unknown>,
  keys: string[],
  fallback = "",
) {
  for (const key of keys) {
    const value = obj[key];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      return String(value).trim();
    }
  }

  return fallback;
}

function normalizeStatus(value: unknown): CustomerStatus {
  const status = String(value || "").toUpperCase();

  if (status === "ACTIVE") return "ACTIVE";
  if (status === "INACTIVE") return "INACTIVE";
  if (status === "BLOCKED") return "BLOCKED";
  if (status === "LEAD") return "LEAD";

  return "UNKNOWN";
}

function normalizeCustomerType(value: unknown): CustomerType {
  const type = String(value || "").toUpperCase();

  if (type === "INDIVIDUAL") return "INDIVIDUAL";
  if (type === "CORPORATE") return "CORPORATE";

  return "UNKNOWN";
}

function normalizeCustomer(payload: CustomerDetailResponse | unknown): CustomerDetail {
  const source = (payload || {}) as Record<string, unknown>;
  const obj =
    (source.customer as Record<string, unknown> | undefined) ||
    (source.data as Record<string, unknown> | undefined) ||
    source;

  const firstName = pickString(obj, ["first_name", "firstName"]);
  const lastName = pickString(obj, ["last_name", "lastName"]);
  const companyName = pickString(obj, ["company_name", "companyName"]);

  const customerType = normalizeCustomerType(
    obj.customer_type ?? obj.customerType,
  );

  const fallbackName =
    customerType === "CORPORATE"
      ? companyName
      : `${firstName} ${lastName}`.trim();

  const email = pickString(obj, ["email"]);
  const phone = pickString(obj, ["phone_number", "phoneNumber", "phone"]);
  const whatsapp = pickString(obj, [
    "whatsapp_number",
    "whatsappNumber",
    "whatsapp",
  ]);
  const alternativePhone = pickString(obj, [
    "alternative_phone_number",
    "alternativePhoneNumber",
  ]);

  return {
    id: (obj.id ?? obj.pk ?? "-") as number | string,
    code: pickString(obj, ["customer_code", "customerCode", "code"], "-"),
    name: pickString(
      obj,
      ["display_name", "displayName", "name", "full_name", "fullName"],
      fallbackName || "-",
    ),
    customerType,
    status: normalizeStatus(obj.status),
    source: pickString(obj, ["source"], "-"),

    firstName,
    lastName,
    companyName,
    gender: pickString(obj, ["gender"], "-"),
    dateOfBirth: pickString(obj, ["date_of_birth", "dateOfBirth"], ""),

    email,
    phone,
    whatsapp,
    alternativePhone,
    primaryContact:
      pickString(obj, ["primary_contact_number", "primaryContactNumber"]) ||
      whatsapp ||
      phone ||
      alternativePhone ||
      email,

    nationalId: pickString(obj, ["national_id", "nationalId"], "-"),
    passportNumber: pickString(obj, ["passport_number", "passportNumber"], "-"),
    nationality: pickString(obj, ["nationality"], "-"),

    country: pickString(obj, ["country"], "-"),
    city: pickString(obj, ["city"], "-"),
    district: pickString(obj, ["district"], "-"),
    streetAddress: pickString(obj, ["street_address", "streetAddress"], "-"),
    postalCode: pickString(obj, ["postal_code", "postalCode"], "-"),
    nationalAddressText: pickString(
      obj,
      ["national_address_text", "nationalAddressText"],
      "-",
    ),

    notes: pickString(obj, ["notes"], "-"),
    tags: pickString(obj, ["tags"], "-"),

    createdAt: pickString(obj, ["created_at", "createdAt"], ""),
    updatedAt: pickString(obj, ["updated_at", "updatedAt"], ""),
    raw: obj,
  };
}

function extractStatement(payload: StatementResponse) {
  return {
    summary:
      payload.statement?.summary ||
      payload.data?.statement?.summary ||
      payload.data?.summary ||
      payload.summary ||
      null,
    lines:
      payload.statement?.lines ||
      payload.data?.statement?.lines ||
      payload.data?.lines ||
      payload.lines ||
      [],
  };
}

function statusLabel(status: CustomerStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<CustomerStatus, string> = {
    ACTIVE: t.active,
    INACTIVE: t.inactive,
    BLOCKED: t.blocked,
    LEAD: t.lead,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function typeLabel(type: CustomerType, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<CustomerType, string> = {
    INDIVIDUAL: t.individual,
    CORPORATE: t.corporate,
    UNKNOWN: t.unknown,
  };

  return labels[type];
}

function statusBadge(status: CustomerStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

  if (status === "ACTIVE") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50">
        {label}
      </Badge>
    );
  }

  if (status === "LEAD") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50">
        {label}
      </Badge>
    );
  }

  if (status === "BLOCKED") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50">
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

function formatDate(value: string | null | undefined, locale: AppLocale) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function money(value: string | number | undefined, currency = "SAR") {
  const amount = Number(value || 0);

  return `${Number.isFinite(amount)
    ? amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00"} ${currency}`;
}

function statementTypeLabel(type: string, locale: AppLocale) {
  const t = dictionary(locale);

  if (type === "INVOICE") return t.invoice;
  if (type === "PAYMENT") return t.payment;
  if (type === "ORDER") return t.order;

  return type || "-";
}

export default function SystemCustomerDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const customerId = params?.id;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const currency = summary?.currency || "SAR";

  const financialCards = useMemo(
    () => [
      {
        title: t.totalOrders,
        value: summary?.total_orders_count || 0,
        icon: FileText,
        isMoney: false,
      },
      {
        title: t.invoicesAmount,
        value: money(summary?.total_invoices_amount, currency),
        icon: Wallet,
        isMoney: true,
      },
      {
        title: t.paidAmount,
        value: money(summary?.total_paid_amount, currency),
        icon: BadgeCheck,
        isMoney: true,
      },
      {
        title: t.dueAmount,
        value: money(summary?.total_due_amount, currency),
        icon: CreditCard,
        isMoney: true,
      },
    ],
    [currency, summary, t],
  );

  async function loadCustomer(showSuccessToast = false) {
    if (!customerId) return;

    setIsLoading(true);

    const [detailResponse, statementResponse] = await Promise.all([
      apiGet<CustomerDetailResponse>(API_PATHS.customers.detail(customerId)),
      apiGet<StatementResponse>(`/api/customers/${customerId}/statement/`),
    ]);

    if (!detailResponse.ok) {
      setCustomer(null);
      setSummary(null);
      setLines([]);
      setIsLoading(false);
      toast.error(detailResponse.message || t.loadError);
      return;
    }

    setCustomer(normalizeCustomer(detailResponse.data));

    if (statementResponse.ok) {
      const statement = extractStatement(statementResponse.data);
      setSummary(statement.summary);
      setLines(statement.lines);
    } else {
      setSummary(null);
      setLines([]);
      toast.error(statementResponse.message || t.statementError);
    }

    setIsLoading(false);

    if (showSuccessToast) {
      toast.success(t.refreshed);
    }
  }

  async function deleteCustomer() {
    if (!customerId) return;

    const confirmed = window.confirm(t.deleteConfirm);
    if (!confirmed) return;

    setIsDeleting(true);

    const response = await apiDelete(API_PATHS.customers.detail(customerId));

    setIsDeleting(false);

    if (!response.ok) {
      toast.error(response.message || t.deleteError);
      return;
    }

    toast.success(t.deleteSuccess);
    router.push("/system/customers/list");
  }

  function copyCustomerCode() {
    if (!customer?.code) return;

    navigator.clipboard.writeText(String(customer.code));
    toast.success(t.copied);
  }

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readLocale();
      applyDocumentLocale(nextLocale);
      setLocale(nextLocale);
    };

    syncLocale();

    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  useEffect(() => {
    loadCustomer(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, locale]);

  if (isLoading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t.loading}
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <Card className="w-full max-w-md rounded-2xl">
          <CardHeader className="text-center">
            <CardTitle>{t.loadError}</CardTitle>
            <CardDescription>{customerId}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild className="rounded-xl">
              <Link href="/system/customers/list">{t.back}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              /system/customers/{customer.id}
            </Badge>
            <Badge className="rounded-full">{t.liveData}</Badge>
            {statusBadge(customer.status, locale)}
          </div>

          <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>

          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t.pageSubtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button asChild variant="outline" className="h-10 rounded-xl">
            <Link href="/system/customers/list">
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </Link>
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadCustomer(true)}
            disabled={isLoading}
          >
            <RefreshCcw className="h-4 w-4" />
            {t.refresh}
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            {t.print}
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={copyCustomerCode}
          >
            <Copy className="h-4 w-4" />
            {t.copyCode}
          </Button>

          <Button
            variant="destructive"
            className="h-10 rounded-xl"
            onClick={deleteCustomer}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {t.delete}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl border bg-card shadow-sm xl:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">
                  {t.customerProfile}
                </CardTitle>
                <CardDescription className="mt-1">
                  {t.profileSubtitle}
                </CardDescription>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                {customer.customerType === "CORPORATE" ? (
                  <Building2 className="h-5 w-5" />
                ) : (
                  <UserRound className="h-5 w-5" />
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-background p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {customer.customerType === "CORPORATE" ? (
                    <Building2 className="h-7 w-7" />
                  ) : (
                    <UserRound className="h-7 w-7" />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-lg font-bold">{customer.name}</p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {customer.code}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full">
                  {typeLabel(customer.customerType, locale)}
                </Badge>
                {statusBadge(customer.status, locale)}
              </div>
            </div>

            <InfoRow label={t.customerCode} value={customer.code} />
            <InfoRow
              label={t.customerType}
              value={typeLabel(customer.customerType, locale)}
            />
            <InfoRow
              label={t.status}
              value={statusLabel(customer.status, locale)}
            />
            <InfoRow label={t.source} value={customer.source || "-"} />
            <InfoRow
              label={t.createdAt}
              value={formatDate(customer.createdAt, locale)}
            />
            <InfoRow
              label={t.updatedAt}
              value={formatDate(customer.updatedAt, locale)}
            />

            <Button variant="outline" className="w-full rounded-xl" disabled>
              <Edit3 className="h-4 w-4" />
              {t.edit}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4 xl:col-span-2">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {financialCards.map((item) => {
              const Icon = item.icon;

              return (
                <Card key={item.title} className="rounded-2xl border shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">
                          {item.title}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <p className="truncate text-xl font-bold">
                            {item.value}
                          </p>
                          {item.isMoney ? (
                            <Image
                              src="/currency/sar.svg"
                              alt="SAR"
                              width={16}
                              height={16}
                            />
                          ) : null}
                        </div>
                      </div>

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <InfoCard
              title={t.contactInfo}
              icon={Phone}
              items={[
                { label: t.email, value: customer.email || "-", icon: Mail },
                { label: t.phone, value: customer.phone || "-", icon: Phone },
                {
                  label: t.whatsapp,
                  value: customer.whatsapp || "-",
                  icon: Phone,
                },
                {
                  label: t.alternativePhone,
                  value: customer.alternativePhone || "-",
                  icon: Phone,
                },
              ]}
            />

            <InfoCard
              title={t.addressInfo}
              icon={MapPin}
              items={[
                { label: t.country, value: customer.country || "-", icon: MapPin },
                { label: t.city, value: customer.city || "-", icon: MapPin },
                { label: t.district, value: customer.district || "-", icon: MapPin },
                {
                  label: t.streetAddress,
                  value: customer.streetAddress || "-",
                  icon: MapPin,
                },
                {
                  label: t.postalCode,
                  value: customer.postalCode || "-",
                  icon: MapPin,
                },
              ]}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <InfoCard
              title={t.legalInfo}
              icon={ShieldCheck}
              items={[
                {
                  label: t.nationalId,
                  value: customer.nationalId || "-",
                  icon: ShieldCheck,
                },
                {
                  label: t.passportNumber,
                  value: customer.passportNumber || "-",
                  icon: ShieldCheck,
                },
                {
                  label: t.nationality,
                  value: customer.nationality || "-",
                  icon: ShieldCheck,
                },
                {
                  label: t.gender,
                  value: customer.gender || "-",
                  icon: UserRound,
                },
                {
                  label: t.dateOfBirth,
                  value: customer.dateOfBirth || "-",
                  icon: CalendarDays,
                },
              ]}
            />

            <InfoCard
              title={t.notesInfo}
              icon={Activity}
              items={[
                { label: t.tags, value: customer.tags || "-", icon: BadgeCheck },
                { label: t.notes, value: customer.notes || "-", icon: FileText },
                {
                  label: t.nationalAddress,
                  value: customer.nationalAddressText || "-",
                  icon: MapPin,
                },
              ]}
            />
          </div>
        </div>
      </div>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">
            {t.operationalLinks}
          </CardTitle>
          <CardDescription>
            {customer.name} — {customer.code}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <QuickLink
              title={t.invoices}
              href={`/system/invoices/list?customer=${customer.id}`}
              icon={FileText}
            />
            <QuickLink
              title={t.payments}
              href={`/system/payments/list?customer=${customer.id}`}
              icon={Wallet}
            />
            <QuickLink
              title={t.orders}
              href={`/system/orders/list?customer=${customer.id}`}
              icon={CheckCircle2}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base font-bold">
              {t.statementTitle}
            </CardTitle>
            <CardDescription>{t.statementSubtitle}</CardDescription>
          </div>

          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            {t.print}
          </Button>
        </CardHeader>

        <CardContent>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.table.date}</TableHead>
                  <TableHead>{t.table.reference}</TableHead>
                  <TableHead>{t.table.type}</TableHead>
                  <TableHead>{t.table.description}</TableHead>
                  <TableHead>{t.table.debit}</TableHead>
                  <TableHead>{t.table.credit}</TableHead>
                  <TableHead>{t.table.balance}</TableHead>
                  <TableHead>{t.table.status}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      {t.emptyStatement}
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map((line, index) => (
                    <TableRow key={`${line.reference}-${index}`}>
                      <TableCell>{formatDate(line.line_date, locale)}</TableCell>
                      <TableCell className="font-medium">
                        {line.reference || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full">
                          {statementTypeLabel(line.line_type, locale)}
                        </Badge>
                      </TableCell>
                      <TableCell>{line.description || "-"}</TableCell>
                      <TableCell>{money(line.debit_amount, line.currency)}</TableCell>
                      <TableCell>{money(line.credit_amount, line.currency)}</TableCell>
                      <TableCell className="font-semibold">
                        {money(line.balance_after, line.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full">
                          {line.status || "-"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-background p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[180px] truncate text-sm font-medium">
        {value || "-"}
      </span>
    </div>
  );
}

function InfoCard({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Array<{
    label: string;
    value: React.ReactNode;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}) {
  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {items.map((item) => {
          const ItemIcon = item.icon;

          return (
            <div
              key={item.label}
              className="flex items-start gap-3 rounded-xl border bg-background p-3"
            >
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <ItemIcon className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 break-words text-sm font-medium">
                  {item.value || "-"}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function QuickLink({
  title,
  href,
  icon: Icon,
}: {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href} className="block">
      <Card className="h-full rounded-2xl border bg-background shadow-none transition hover:bg-muted/40">
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <p className="font-semibold">{title}</p>

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}