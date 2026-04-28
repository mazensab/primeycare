"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileText,
  HandCoins,
  Landmark,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
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

/* ============================================================
   📂 app/system/agents/[id]/page.tsx
   🧠 Primey Care | Agent Details
   ------------------------------------------------------------
   ✅ Phase 6: Agents + Orders + Commissions + Statement
   ✅ GET /api/agents/<id>/?include_statement=1
   ✅ POST /api/agents/commissions/<id>/approve/
   ✅ عربي / إنجليزي عبر primey-locale
   ✅ أرقام إنجليزية دائمًا
   ✅ SAR icon
   ✅ sonner
   ✅ بدون localhost
============================================================ */

type AppLocale = "ar" | "en";

type AgentStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "DRAFT"
  | "UNKNOWN";

type CommissionType = "PERCENTAGE" | "FIXED" | "UNKNOWN";

type CommissionStatus =
  | "PENDING"
  | "EARNED"
  | "APPROVED"
  | "PAID"
  | "CANCELLED"
  | "REVERSED"
  | "UNKNOWN";

type Agent = {
  id: number | string;
  fullName: string;
  agentCode: string;
  referralCode: string;
  status: AgentStatus;
  phone: string;
  email: string;
  city: string;
  address: string;
  defaultCommissionType: CommissionType;
  defaultCommissionValue: number;
  bankName: string;
  bankAccountName: string;
  iban: string;
  notes: string;
  totalCustomers: number;
  totalOrders: number;
  totalSales: number;
  pendingCommission: number;
  approvedCommission: number;
  paidCommission: number;
  totalCommission: number;
  dueCommission: number;
  createdAt: string;
  updatedAt: string;
};

type AgentOrder = {
  id: number | string;
  orderId: number | string;
  orderNumber: string;
  customerId: number | string | null;
  customerName: string;
  commissionType: CommissionType;
  commissionValue: number;
  salesAmount: number;
  commissionAmount: number;
  referralCodeUsed: string;
  createdAt: string;
};

type AgentCommission = {
  id: number | string;
  reference: string;
  status: CommissionStatus;
  agentId: number | string | null;
  orderId: number | string | null;
  orderNumber: string;
  paymentId: number | string | null;
  paymentNumber: string;
  customerName: string;
  baseAmount: number;
  commissionAmount: number;
  paidAmount: number;
  remainingAmount: number;
  earnedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  notes: string;
};

type StatementSummary = {
  agent_id?: number | string;
  agent_code?: string;
  agent_name?: string;
  total_orders_count?: number | string;
  total_sales_amount?: number | string;
  total_commissions_count?: number | string;
  total_commission_amount?: number | string;
  total_paid_amount?: number | string;
  total_due_amount?: number | string;
  currency?: string;
};

type StatementLine = {
  line_type?: string;
  line_date?: string | null;
  reference?: string;
  related_order_id?: number | string | null;
  related_agent_order_id?: number | string | null;
  related_commission_id?: number | string | null;
  description?: string;
  debit_amount?: number | string;
  credit_amount?: number | string;
  balance_after?: number | string;
  currency?: string;
  status?: string;
};

type AgentDetailApiResponse = {
  ok?: boolean;
  message?: string;
  agent?: Record<string, unknown>;
  stats?: Record<string, unknown>;
  recent_orders?: unknown[];
  recent_commissions?: unknown[];
  statement?: {
    summary?: StatementSummary;
    lines?: StatementLine[];
  };
};

const SAR_ICON = "/currency/sar.svg";

/* ============================================================
   Locale / Safe Helpers
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

function valueOf(obj: Record<string, unknown>, key: string): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  const agent = obj.agent;
  if (agent && typeof agent === "object") {
    const nested = (agent as Record<string, unknown>)[key];
    if (nested !== undefined && nested !== null && nested !== "") {
      return nested;
    }
  }

  const stats = obj.stats;
  if (stats && typeof stats === "object") {
    const nested = (stats as Record<string, unknown>)[key];
    if (nested !== undefined && nested !== null && nested !== "") {
      return nested;
    }
  }

  return undefined;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const clean = String(value ?? "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(value: unknown): AgentStatus {
  const status = String(value || "").toUpperCase();

  if (status === "ACTIVE") return "ACTIVE";
  if (status === "INACTIVE") return "INACTIVE";
  if (status === "SUSPENDED") return "SUSPENDED";
  if (status === "DRAFT") return "DRAFT";

  return "UNKNOWN";
}

function normalizeCommissionType(value: unknown): CommissionType {
  const type = String(value || "").toUpperCase();

  if (type === "PERCENTAGE") return "PERCENTAGE";
  if (type === "FIXED") return "FIXED";

  return "UNKNOWN";
}

function normalizeCommissionStatus(value: unknown): CommissionStatus {
  const status = String(value || "").toUpperCase();

  if (status === "PENDING") return "PENDING";
  if (status === "EARNED") return "EARNED";
  if (status === "APPROVED") return "APPROVED";
  if (status === "PAID") return "PAID";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "REVERSED") return "REVERSED";

  return "UNKNOWN";
}

function normalizeAgent(raw: unknown, stats?: Record<string, unknown>): Agent {
  const obj = (raw || {}) as Record<string, unknown>;
  const merged = {
    ...stats,
    ...obj,
  };

  const id = valueOf(merged, "id") ?? valueOf(merged, "agent_id") ?? "-";

  return {
    id: id as number | string,
    fullName: String(
      valueOf(merged, "full_name") ??
        valueOf(merged, "name") ??
        valueOf(merged, "agent_name") ??
        "-",
    ),
    agentCode: String(
      valueOf(merged, "agent_code") ?? valueOf(merged, "code") ?? "-",
    ),
    referralCode: String(valueOf(merged, "referral_code") ?? "-"),
    status: normalizeStatus(valueOf(merged, "status")),
    phone: String(valueOf(merged, "phone") ?? ""),
    email: String(valueOf(merged, "email") ?? ""),
    city: String(valueOf(merged, "city") ?? ""),
    address: String(valueOf(merged, "address") ?? ""),
    defaultCommissionType: normalizeCommissionType(
      valueOf(merged, "default_commission_type"),
    ),
    defaultCommissionValue: toNumber(valueOf(merged, "default_commission_value")),
    bankName: String(valueOf(merged, "bank_name") ?? ""),
    bankAccountName: String(valueOf(merged, "bank_account_name") ?? ""),
    iban: String(valueOf(merged, "iban") ?? ""),
    notes: String(valueOf(merged, "notes") ?? ""),
    totalCustomers: toNumber(
      valueOf(merged, "total_customers") ?? valueOf(merged, "customers_count"),
    ),
    totalOrders: toNumber(
      valueOf(merged, "total_orders") ?? valueOf(merged, "orders_count"),
    ),
    totalSales: toNumber(valueOf(merged, "total_sales")),
    pendingCommission: toNumber(valueOf(merged, "pending_commission")),
    approvedCommission: toNumber(valueOf(merged, "approved_commission")),
    paidCommission: toNumber(valueOf(merged, "paid_commission")),
    totalCommission: toNumber(valueOf(merged, "total_commission")),
    dueCommission: toNumber(valueOf(merged, "due_commission")),
    createdAt: String(valueOf(merged, "created_at") ?? ""),
    updatedAt: String(valueOf(merged, "updated_at") ?? ""),
  };
}

function normalizeOrder(item: unknown): AgentOrder {
  const obj = (item || {}) as Record<string, unknown>;

  return {
    id: (obj.id ?? "-") as number | string,
    orderId: (obj.order_id ?? "-") as number | string,
    orderNumber: String(obj.order_number ?? `ORD-${obj.order_id ?? "-"}`),
    customerId: (obj.customer_id ?? null) as number | string | null,
    customerName: String(obj.customer_name ?? "-"),
    commissionType: normalizeCommissionType(obj.commission_type),
    commissionValue: toNumber(obj.commission_value),
    salesAmount: toNumber(obj.sales_amount),
    commissionAmount: toNumber(obj.commission_amount),
    referralCodeUsed: String(obj.referral_code_used ?? ""),
    createdAt: String(obj.created_at ?? ""),
  };
}

function normalizeCommission(item: unknown): AgentCommission {
  const obj = (item || {}) as Record<string, unknown>;

  return {
    id: (obj.id ?? "-") as number | string,
    reference: String(obj.reference ?? `COM-${obj.id ?? "-"}`),
    status: normalizeCommissionStatus(obj.commission_status ?? obj.status),
    agentId: (obj.agent_id ?? null) as number | string | null,
    orderId: (obj.order_id ?? null) as number | string | null,
    orderNumber: String(obj.order_number ?? `ORD-${obj.order_id ?? "-"}`),
    paymentId: (obj.payment_id ?? null) as number | string | null,
    paymentNumber: String(obj.payment_number ?? ""),
    customerName: String(obj.customer_name ?? "-"),
    baseAmount: toNumber(obj.base_amount),
    commissionAmount: toNumber(obj.commission_amount ?? obj.amount),
    paidAmount: toNumber(obj.paid_amount),
    remainingAmount: toNumber(obj.remaining_amount),
    earnedAt: obj.earned_at ? String(obj.earned_at) : null,
    approvedAt: obj.approved_at ? String(obj.approved_at) : null,
    paidAt: obj.paid_at ? String(obj.paid_at) : null,
    createdAt: String(obj.created_at ?? ""),
    notes: String(obj.notes ?? ""),
  };
}

/* ============================================================
   Dictionary / Formatters
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "تفاصيل المندوب" : "Agent Details",
    subtitle: isArabic
      ? "ملف تشغيلي يعرض بيانات المندوب، الطلبات، العمولات، وكشف الحساب."
      : "Operational profile showing agent data, orders, commissions, and statement.",

    back: isArabic ? "لوحة المندوبين" : "Agents Overview",
    list: isArabic ? "قائمة المندوبين" : "Agents List",
    refresh: isArabic ? "تحديث" : "Refresh",

    profile: isArabic ? "الملف الأساسي" : "Profile",
    contact: isArabic ? "معلومات التواصل" : "Contact Info",
    bank: isArabic ? "البيانات البنكية" : "Bank Info",
    commissionSetup: isArabic ? "إعداد العمولة" : "Commission Setup",
    recentOrders: isArabic ? "آخر الطلبات المرتبطة" : "Recent Linked Orders",
    recentCommissions: isArabic ? "آخر العمولات" : "Recent Commissions",
    statement: isArabic ? "كشف حساب المندوب" : "Agent Statement",
    notes: isArabic ? "ملاحظات" : "Notes",

    totalSales: isArabic ? "إجمالي المبيعات" : "Total Sales",
    totalCommission: isArabic ? "إجمالي العمولات" : "Total Commissions",
    dueCommission: isArabic ? "الرصيد المستحق" : "Due Balance",
    paidCommission: isArabic ? "المدفوع" : "Paid",
    customers: isArabic ? "العملاء" : "Customers",
    orders: isArabic ? "الطلبات" : "Orders",

    agentCode: isArabic ? "كود المندوب" : "Agent Code",
    referralCode: isArabic ? "كود الإحالة" : "Referral Code",
    status: isArabic ? "الحالة" : "Status",
    phone: isArabic ? "الجوال" : "Phone",
    email: isArabic ? "البريد" : "Email",
    city: isArabic ? "المدينة" : "City",
    address: isArabic ? "العنوان" : "Address",
    createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
    updatedAt: isArabic ? "آخر تحديث" : "Updated At",
    bankName: isArabic ? "اسم البنك" : "Bank Name",
    bankAccountName: isArabic ? "اسم صاحب الحساب" : "Account Holder",
    iban: isArabic ? "الآيبان" : "IBAN",
    commissionType: isArabic ? "نوع العمولة" : "Commission Type",
    commissionValue: isArabic ? "قيمة العمولة" : "Commission Value",

    orderNumber: isArabic ? "رقم الطلب" : "Order No.",
    customer: isArabic ? "العميل" : "Customer",
    salesAmount: isArabic ? "المبيعات" : "Sales",
    commissionAmount: isArabic ? "العمولة" : "Commission",
    date: isArabic ? "التاريخ" : "Date",

    reference: isArabic ? "المرجع" : "Reference",
    baseAmount: isArabic ? "الأساس" : "Base",
    remaining: isArabic ? "المتبقي" : "Remaining",
    approve: isArabic ? "اعتماد" : "Approve",
    approved: isArabic ? "معتمدة" : "Approved",

    debit: isArabic ? "مدين" : "Debit",
    credit: isArabic ? "دائن" : "Credit",
    balance: isArabic ? "الرصيد" : "Balance",
    description: isArabic ? "الوصف" : "Description",

    loading: isArabic ? "جاري تحميل تفاصيل المندوب..." : "Loading agent details...",
    emptyOrders: isArabic ? "لا توجد طلبات مرتبطة." : "No linked orders.",
    emptyCommissions: isArabic ? "لا توجد عمولات." : "No commissions.",
    emptyStatement: isArabic ? "لا توجد حركات في كشف الحساب." : "No statement lines.",
    notFound: isArabic ? "المندوب غير موجود." : "Agent not found.",
    apiError: isArabic ? "تعذر تحميل تفاصيل المندوب." : "Unable to load agent details.",
    refreshSuccess: isArabic ? "تم تحديث تفاصيل المندوب" : "Agent details refreshed",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",
    approveSuccess: isArabic ? "تم اعتماد العمولة بنجاح" : "Commission approved successfully",
    approveError: isArabic ? "تعذر اعتماد العمولة" : "Unable to approve commission",

    statusLabels: {
      ACTIVE: isArabic ? "نشط" : "Active",
      INACTIVE: isArabic ? "غير نشط" : "Inactive",
      SUSPENDED: isArabic ? "موقوف" : "Suspended",
      DRAFT: isArabic ? "مسودة" : "Draft",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<AgentStatus, string>,

    commissionStatusLabels: {
      PENDING: isArabic ? "معلقة" : "Pending",
      EARNED: isArabic ? "مستحقة" : "Earned",
      APPROVED: isArabic ? "معتمدة" : "Approved",
      PAID: isArabic ? "مدفوعة" : "Paid",
      CANCELLED: isArabic ? "ملغاة" : "Cancelled",
      REVERSED: isArabic ? "معكوسة" : "Reversed",
      UNKNOWN: isArabic ? "غير محددة" : "Unknown",
    } satisfies Record<CommissionStatus, string>,

    commissionTypeLabels: {
      PERCENTAGE: isArabic ? "نسبة" : "Percentage",
      FIXED: isArabic ? "مبلغ ثابت" : "Fixed",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<CommissionType, string>,
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function SarAmount({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold">
      <Image
        src={SAR_ICON}
        alt="SAR"
        width={14}
        height={14}
        className="h-3.5 w-3.5"
      />
      <span>{formatMoney(value)}</span>
    </span>
  );
}

function statusBadge(status: AgentStatus, locale: AppLocale) {
  const t = dictionary(locale);
  const label = t.statusLabels[status];

  if (status === "ACTIVE") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }

  if (status === "SUSPENDED") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
        {label}
      </Badge>
    );
  }

  if (status === "DRAFT") {
    return (
      <Badge className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
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

function commissionStatusBadge(status: CommissionStatus, locale: AppLocale) {
  const t = dictionary(locale);
  const label = t.commissionStatusLabels[status];

  if (status === "APPROVED" || status === "PAID") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50">
        {label}
      </Badge>
    );
  }

  if (status === "PENDING" || status === "EARNED") {
    return (
      <Badge className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50">
        {label}
      </Badge>
    );
  }

  if (status === "CANCELLED" || status === "REVERSED") {
    return (
      <Badge className="rounded-full border-rose-200 bg-rose-50 px-3 py-1 text-rose-700 hover:bg-rose-50">
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

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border bg-background p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-muted p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>

      <div className="max-w-[55%] truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: React.ReactNode;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        <div className="rounded-2xl bg-muted p-3">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================================================
   Page
============================================================ */

export default function AgentDetailsPage() {
  const params = useParams<{ id: string }>();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [orders, setOrders] = useState<AgentOrder[]>([]);
  const [commissions, setCommissions] = useState<AgentCommission[]>([]);
  const [statementSummary, setStatementSummary] =
    useState<StatementSummary | null>(null);
  const [statementLines, setStatementLines] = useState<StatementLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<number | string | null>(null);

  const t = useMemo(() => dictionary(locale), [locale]);
  const agentId = params?.id;

  const loadAgent = useCallback(
    async (showToast = false) => {
      if (!agentId) return;

      try {
        setIsLoading(true);

        const response = await fetch(
          `/api/agents/${agentId}/?include_statement=1&include_agent_orders=1`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const payload = (await response.json().catch(() => null)) as
          | AgentDetailApiResponse
          | null;

        if (!response.ok || !payload?.ok || !payload.agent) {
          throw new Error(payload?.message || `HTTP ${response.status}`);
        }

        const normalizedAgent = normalizeAgent(payload.agent, payload.stats);
        const normalizedOrders = (payload.recent_orders || []).map(normalizeOrder);
        const normalizedCommissions = (payload.recent_commissions || []).map(
          normalizeCommission,
        );

        setAgent(normalizedAgent);
        setOrders(normalizedOrders);
        setCommissions(normalizedCommissions);
        setStatementSummary(payload.statement?.summary || null);
        setStatementLines(payload.statement?.lines || []);

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load agent details:", error);
        setAgent(null);
        setOrders([]);
        setCommissions([]);
        setStatementSummary(null);
        setStatementLines([]);
        toast.error(t.apiError);
      } finally {
        setIsLoading(false);
      }
    },
    [agentId, t.apiError, t.refreshSuccess],
  );

  async function approveCommission(commissionId: number | string) {
    try {
      setApprovingId(commissionId);

      const response = await fetch(
        `/api/agents/commissions/${commissionId}/approve/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken"),
          },
          body: JSON.stringify({
            auto_post_accounting: true,
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      toast.success(t.approveSuccess);
      await loadAgent(false);
    } catch (error) {
      console.error("Approve commission error:", error);
      toast.error(t.approveError);
    } finally {
      setApprovingId(null);
    }
  }

  function copyValue(value: string, fallback = "-") {
    const text = value || fallback;

    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(t.copied))
      .catch(() => toast.error(t.copied));
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
    loadAgent(false);
  }, [loadAgent]);

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.loading}
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="space-y-4">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-8 text-center">
            <p className="font-semibold">{t.notFound}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t.apiError}</p>

            <div className="mt-5 flex justify-center gap-2">
              <Link href="/system/agents">
                <Button variant="outline" className="rounded-xl">
                  <ArrowLeft className="h-4 w-4" />
                  {t.back}
                </Button>
              </Link>

              <Button className="rounded-xl" onClick={() => loadAgent(true)}>
                <RefreshCcw className="h-4 w-4" />
                {t.refresh}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const commissionValue =
    agent.defaultCommissionType === "PERCENTAGE"
      ? `${formatNumber(agent.defaultCommissionValue)}%`
      : formatMoney(agent.defaultCommissionValue);

  const statementDue = toNumber(statementSummary?.total_due_amount);
  const effectiveDue = agent.dueCommission || statementDue;

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="relative p-6 md:p-8">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-l from-primary/10 via-primary/5 to-transparent" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-5 md:flex-row md:items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
                <UserRound className="h-10 w-10 text-primary" />
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {statusBadge(agent.status, locale)}

                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {agent.agentCode}
                  </Badge>

                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {agent.referralCode}
                  </Badge>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    {t.profile} / {t.title}
                  </p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
                    {agent.fullName}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {agent.email || agent.phone || agent.city || "-"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {agent.city || "-"}
                  </span>

                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-4 w-4" />
                    {formatDateTime(agent.createdAt)}
                  </span>

                  <span className="inline-flex items-center gap-1">
                    <HandCoins className="h-4 w-4" />
                    {t.commissionType}:{" "}
                    {t.commissionTypeLabels[agent.defaultCommissionType]}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/system/agents">
                <Button variant="outline" className="rounded-2xl">
                  <ArrowLeft className="h-4 w-4" />
                  {t.back}
                </Button>
              </Link>

              <Link href="/system/agents/list">
                <Button variant="outline" className="rounded-2xl">
                  <ClipboardList className="h-4 w-4" />
                  {t.list}
                </Button>
              </Link>

              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => loadAgent(true)}
                disabled={isLoading}
              >
                <RefreshCcw className="h-4 w-4" />
                {t.refresh}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t.totalSales}
          value={<SarAmount value={agent.totalSales} />}
          description={t.orders}
          icon={TrendingUp}
        />

        <StatCard
          title={t.totalCommission}
          value={<SarAmount value={agent.totalCommission || agent.approvedCommission} />}
          description={t.commissionAmount}
          icon={HandCoins}
        />

        <StatCard
          title={t.dueCommission}
          value={<SarAmount value={effectiveDue} />}
          description={t.remaining}
          icon={Wallet}
        />

        <StatCard
          title={t.customers}
          value={formatNumber(agent.totalCustomers)}
          description={`${t.orders}: ${formatNumber(agent.totalOrders)}`}
          icon={CheckCircle2}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Main Info */}
          <Card className="rounded-3xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <ShieldCheck className="h-5 w-5" />
                {t.profile}
              </CardTitle>
              <CardDescription>{t.subtitle}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <InfoRow
                label={t.agentCode}
                value={
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 hover:text-primary"
                    onClick={() => copyValue(agent.agentCode)}
                  >
                    {agent.agentCode}
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                }
                icon={ClipboardList}
              />

              <InfoRow
                label={t.referralCode}
                value={
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 hover:text-primary"
                    onClick={() => copyValue(agent.referralCode)}
                  >
                    {agent.referralCode}
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                }
                icon={BadgeCheck}
              />

              <InfoRow
                label={t.status}
                value={statusBadge(agent.status, locale)}
                icon={ShieldCheck}
              />

              <InfoRow
                label={t.createdAt}
                value={formatDateTime(agent.createdAt)}
                icon={CalendarDays}
              />

              <InfoRow
                label={t.commissionType}
                value={t.commissionTypeLabels[agent.defaultCommissionType]}
                icon={HandCoins}
              />

              <InfoRow
                label={t.commissionValue}
                value={
                  agent.defaultCommissionType === "FIXED" ? (
                    <SarAmount value={agent.defaultCommissionValue} />
                  ) : (
                    commissionValue
                  )
                }
                icon={Banknote}
              />
            </CardContent>
          </Card>

          {/* Recent Orders */}
          <Card className="rounded-3xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <ReceiptText className="h-5 w-5" />
                {t.recentOrders}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="overflow-hidden rounded-2xl border">
                <div className="grid grid-cols-5 gap-3 border-b bg-muted/60 px-4 py-3 text-xs font-semibold text-muted-foreground">
                  <span>{t.orderNumber}</span>
                  <span>{t.customer}</span>
                  <span>{t.salesAmount}</span>
                  <span>{t.commissionAmount}</span>
                  <span>{t.date}</span>
                </div>

                {orders.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {t.emptyOrders}
                  </div>
                ) : (
                  orders.map((order) => (
                    <div
                      key={order.id}
                      className="grid grid-cols-5 gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                    >
                      <Link
                        href={`/system/orders/${order.orderId}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <span>{order.customerName || "-"}</span>
                      <span>
                        <SarAmount value={order.salesAmount} />
                      </span>
                      <span>
                        <SarAmount value={order.commissionAmount} />
                      </span>
                      <span className="text-muted-foreground">
                        {formatDateTime(order.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Commissions */}
          <Card className="rounded-3xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <HandCoins className="h-5 w-5" />
                {t.recentCommissions}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="overflow-hidden rounded-2xl border">
                <div className="grid grid-cols-6 gap-3 border-b bg-muted/60 px-4 py-3 text-xs font-semibold text-muted-foreground">
                  <span>{t.reference}</span>
                  <span>{t.orderNumber}</span>
                  <span>{t.commissionAmount}</span>
                  <span>{t.paidCommission}</span>
                  <span>{t.status}</span>
                  <span>{t.approve}</span>
                </div>

                {commissions.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {t.emptyCommissions}
                  </div>
                ) : (
                  commissions.map((commission) => (
                    <div
                      key={commission.id}
                      className="grid grid-cols-6 gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                    >
                      <span className="font-semibold">{commission.reference}</span>
                      <span>{commission.orderNumber}</span>
                      <span>
                        <SarAmount value={commission.commissionAmount} />
                      </span>
                      <span>
                        <SarAmount value={commission.paidAmount} />
                      </span>
                      <span>{commissionStatusBadge(commission.status, locale)}</span>
                      <span>
                        {commission.status === "PENDING" ||
                        commission.status === "EARNED" ? (
                          <Button
                            size="sm"
                            className="h-8 rounded-xl"
                            onClick={() => approveCommission(commission.id)}
                            disabled={approvingId === commission.id}
                          >
                            {approvingId === commission.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <BadgeCheck className="h-4 w-4" />
                            )}
                            {t.approve}
                          </Button>
                        ) : (
                          <Badge variant="outline" className="rounded-full">
                            {t.approved}
                          </Badge>
                        )}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Statement */}
          <Card className="rounded-3xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <FileText className="h-5 w-5" />
                {t.statement}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="overflow-hidden rounded-2xl border">
                <div className="grid grid-cols-5 gap-3 border-b bg-muted/60 px-4 py-3 text-xs font-semibold text-muted-foreground">
                  <span>{t.date}</span>
                  <span>{t.description}</span>
                  <span>{t.debit}</span>
                  <span>{t.credit}</span>
                  <span>{t.balance}</span>
                </div>

                {statementLines.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {t.emptyStatement}
                  </div>
                ) : (
                  statementLines.slice(0, 12).map((line, index) => (
                    <div
                      key={`${line.reference}-${index}`}
                      className="grid grid-cols-5 gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                    >
                      <span className="text-muted-foreground">
                        {formatDateTime(line.line_date)}
                      </span>
                      <span>{line.description || line.reference || "-"}</span>
                      <span>
                        <SarAmount value={toNumber(line.debit_amount)} />
                      </span>
                      <span>
                        <SarAmount value={toNumber(line.credit_amount)} />
                      </span>
                      <span>
                        <SarAmount value={toNumber(line.balance_after)} />
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side Info */}
        <div className="space-y-4">
          <Card className="rounded-3xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Phone className="h-5 w-5" />
                {t.contact}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <InfoRow
                label={t.phone}
                value={
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 hover:text-primary"
                    onClick={() => copyValue(agent.phone)}
                  >
                    {agent.phone || "-"}
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                }
                icon={Phone}
              />

              <InfoRow
                label={t.email}
                value={
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 hover:text-primary"
                    onClick={() => copyValue(agent.email)}
                  >
                    {agent.email || "-"}
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                }
                icon={Mail}
              />

              <InfoRow
                label={t.city}
                value={agent.city || "-"}
                icon={MapPin}
              />

              <InfoRow
                label={t.address}
                value={agent.address || "-"}
                icon={MapPin}
              />
            </CardContent>
          </Card>

          <Card className="rounded-3xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Landmark className="h-5 w-5" />
                {t.bank}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <InfoRow
                label={t.bankName}
                value={agent.bankName || "-"}
                icon={Landmark}
              />

              <InfoRow
                label={t.bankAccountName}
                value={agent.bankAccountName || "-"}
                icon={UserRound}
              />

              <InfoRow
                label={t.iban}
                value={
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 hover:text-primary"
                    onClick={() => copyValue(agent.iban)}
                  >
                    {agent.iban || "-"}
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                }
                icon={ClipboardList}
              />
            </CardContent>
          </Card>

          <Card className="rounded-3xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Wallet className="h-5 w-5" />
                {t.commissionSetup}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  {t.paidCommission}
                </p>
                <div className="mt-2 text-xl font-bold">
                  <SarAmount value={agent.paidCommission} />
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  {t.dueCommission}
                </p>
                <div className="mt-2 text-xl font-bold">
                  <SarAmount value={effectiveDue} />
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  {t.commissionValue}
                </p>
                <div className="mt-2 text-xl font-bold">
                  {agent.defaultCommissionType === "FIXED" ? (
                    <SarAmount value={agent.defaultCommissionValue} />
                  ) : (
                    commissionValue
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">{t.notes}</CardTitle>
            </CardHeader>

            <CardContent>
              <p className="text-sm leading-7 text-muted-foreground">
                {agent.notes || "-"}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}