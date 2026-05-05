"use client";

/* ============================================================
   📂 app/system/agents/[id]/page.tsx
   🧠 Primey Care | Agent Details
   ------------------------------------------------------------
   ✅ المسار: /system/agents/[id]
   ✅ الإصدار: v2.0.0 - Centers Pattern + Safe Permissions

   ✅ العمل:
      عرض تفاصيل المندوب، بيانات التواصل، العمولات،
      الحساب البنكي، الأداء، والربط التشغيلي.

   ✅ Backend:
      GET /api/agents/{id}/

   ✅ المعيار:
      - مبني بصريًا على نمط تفاصيل المراكز والعملاء المعتمد.
      - دمج UX Refinement مع حماية المرحلة 2.
      - لا يتم إظهار مسارات تقنية أو API داخل الواجهة.
      - الصفحة ممتدة على عرض المساحة وليست متمركزة.
      - Side Profile Card + Main Content.
      - لا يتم عرض زر حذف نهائي.
      - لا يتم عرض أزرار وهمية أو معطلة.
      - إخفاء الأزرار غير المصرح بها بدل تعطيلها.
      - عدم كسر system_admin / superadmin.
      - Error State مستقل عن Not Found.
      - Skeleton Loading.
      - نسخ سريع للكود / الإحالة / المعرف / الآيبان.
      - Web PDF Print.
      - استخدام /currency/sar.svg.
      - الأرقام بالإنجليزية.
      - دعم عربي / إنجليزي عبر primey-locale.
      - استخدام sonner للتنبيهات.
      - بدون localhost hardcoded.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  Eye,
  FileText,
  HandCoins,
  IdCard,
  Landmark,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Printer,
  RefreshCcw,
  ShieldCheck,
  Star,
  UserRound,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/AuthProvider";
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
  TableRow,
} from "@/components/ui/table";

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";
type AuthRecord = Record<string, unknown>;

type AgentStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "DRAFT"
  | "UNKNOWN";

type CommissionType = "PERCENTAGE" | "FIXED" | "UNKNOWN";

type AgentDetail = {
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
  totalCustomers: number;
  totalOrders: number;
  totalSales: number;
  pendingCommission: number;
  approvedCommission: number;
  paidCommission: number;
  accountingPostedCommission: number;
  bankName: string;
  bankAccountName: string;
  iban: string;
  notes: string;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type AgentDetailResponse = {
  ok?: boolean;
  message?: string;
  data?: unknown;
  agent?: unknown;
  item?: unknown;
};

const SAR_ICON_PATH = "/currency/sar.svg";

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
   API Helper
============================================================ */

function apiUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  if (!base) return path;

  return `${base.replace(/\/$/, "")}${path}`;
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
   Normalizers
============================================================ */

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const clean = String(value ?? "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(clean);

  return Number.isFinite(parsed) ? parsed : 0;
}

function getObjectValue(obj: Record<string, unknown>, key: string): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  const containers = ["agent", "stats", "summary", "commissions"];

  for (const container of containers) {
    const nested = obj[container];

    if (nested && typeof nested === "object") {
      const nestedObj = nested as Record<string, unknown>;
      const value = nestedObj[key];

      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
  }

  return undefined;
}

function unwrapAgent(payload: unknown): unknown {
  const wrapper = (payload || {}) as AgentDetailResponse;

  return wrapper.data || wrapper.agent || wrapper.item || payload || {};
}

function normalizeStatus(value: unknown): AgentStatus {
  const status = String(value || "").toUpperCase();

  if (status === "ACTIVE") return "ACTIVE";
  if (status === "INACTIVE") return "INACTIVE";
  if (status === "SUSPENDED") return "SUSPENDED";
  if (status === "DRAFT") return "DRAFT";

  if (value === true) return "ACTIVE";
  if (value === false) return "INACTIVE";

  return "UNKNOWN";
}

function normalizeCommissionType(value: unknown): CommissionType {
  const commissionType = String(value || "").toUpperCase();

  if (commissionType === "PERCENTAGE") return "PERCENTAGE";
  if (commissionType === "FIXED") return "FIXED";

  return "UNKNOWN";
}

function normalizeAgentDetail(payload: unknown): AgentDetail {
  const obj = unwrapAgent(payload) as Record<string, unknown>;

  const id = getObjectValue(obj, "id") ?? getObjectValue(obj, "agent_id") ?? "";

  const fullName =
    getObjectValue(obj, "full_name") ??
    getObjectValue(obj, "name") ??
    getObjectValue(obj, "agent_name") ??
    "-";

  const agentCode =
    getObjectValue(obj, "agent_code") ??
    getObjectValue(obj, "code") ??
    (id ? `AGT-${id}` : "-");

  const referralCode =
    getObjectValue(obj, "referral_code") ??
    getObjectValue(obj, "reference") ??
    getObjectValue(obj, "ref_code") ??
    "-";

  return {
    id: id as number | string,
    fullName: String(fullName || "-"),
    agentCode: String(agentCode || "-"),
    referralCode: String(referralCode || "-"),
    status: normalizeStatus(getObjectValue(obj, "status")),
    phone: String(getObjectValue(obj, "phone") ?? ""),
    email: String(getObjectValue(obj, "email") ?? ""),
    city: String(getObjectValue(obj, "city") ?? ""),
    address: String(getObjectValue(obj, "address") ?? ""),
    defaultCommissionType: normalizeCommissionType(
      getObjectValue(obj, "default_commission_type") ??
        getObjectValue(obj, "commission_type"),
    ),
    defaultCommissionValue: toNumber(
      getObjectValue(obj, "default_commission_value") ??
        getObjectValue(obj, "commission_value") ??
        0,
    ),
    totalCustomers: toNumber(
      getObjectValue(obj, "total_customers") ??
        getObjectValue(obj, "customers_count") ??
        getObjectValue(obj, "customer_count") ??
        0,
    ),
    totalOrders: toNumber(
      getObjectValue(obj, "total_orders") ??
        getObjectValue(obj, "orders_count") ??
        getObjectValue(obj, "order_count") ??
        0,
    ),
    totalSales: toNumber(
      getObjectValue(obj, "total_sales") ??
        getObjectValue(obj, "sales_total") ??
        getObjectValue(obj, "orders_total") ??
        0,
    ),
    pendingCommission: toNumber(
      getObjectValue(obj, "pending_commission") ??
        getObjectValue(obj, "pending_commissions") ??
        0,
    ),
    approvedCommission: toNumber(
      getObjectValue(obj, "approved_commission") ??
        getObjectValue(obj, "approved_commissions") ??
        getObjectValue(obj, "total_commission") ??
        0,
    ),
    paidCommission: toNumber(
      getObjectValue(obj, "paid_commission") ??
        getObjectValue(obj, "paid_commissions") ??
        0,
    ),
    accountingPostedCommission: toNumber(
      getObjectValue(obj, "accounting_posted_commission") ??
        getObjectValue(obj, "posted_commission") ??
        0,
    ),
    bankName: String(getObjectValue(obj, "bank_name") ?? ""),
    bankAccountName: String(getObjectValue(obj, "bank_account_name") ?? ""),
    iban: String(getObjectValue(obj, "iban") ?? ""),
    notes: String(getObjectValue(obj, "notes") ?? ""),
    isFeatured: Boolean(
      getObjectValue(obj, "is_featured") ??
        getObjectValue(obj, "featured") ??
        false,
    ),
    createdAt: String(getObjectValue(obj, "created_at") ?? ""),
    updatedAt: String(getObjectValue(obj, "updated_at") ?? ""),
    raw: obj,
  };
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "تفاصيل المندوب" : "Agent Details",
    subtitle: isArabic
      ? "عرض بيانات المندوب، التواصل، العمولة، الحساب البنكي، والأداء التشغيلي."
      : "View agent profile, contact, commission, bank details, and operational performance.",

    back: isArabic ? "العودة للمندوبين" : "Back to Agents",
    agentsList: isArabic ? "قائمة المندوبين" : "Agents List",
    refresh: isArabic ? "تحديث" : "Refresh",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    retry: isArabic ? "إعادة المحاولة" : "Retry",

    overview: isArabic ? "نظرة عامة" : "Overview",
    overviewDesc: isArabic
      ? "بيانات المندوب الأساسية والحالة التشغيلية."
      : "Basic agent information and operational status.",

    contact: isArabic ? "بيانات التواصل" : "Contact Information",
    contactDesc: isArabic
      ? "رقم الجوال، البريد الإلكتروني، المدينة، والعنوان."
      : "Phone, email, city, and address.",

    performance: isArabic ? "الأداء التشغيلي" : "Operational Performance",
    performanceDesc: isArabic
      ? "ملخص العملاء والطلبات والمبيعات المرتبطة بالمندوب."
      : "Summary of customers, orders, and sales linked to this agent.",

    commissions: isArabic ? "العمولات" : "Commissions",
    commissionsDesc: isArabic
      ? "إعدادات العمولة ورصيد العمولات حسب الحالة."
      : "Commission settings and balances by status.",

    bank: isArabic ? "البيانات البنكية" : "Bank Information",
    bankDesc: isArabic
      ? "بيانات الحساب البنكي المرتبط بالمندوب."
      : "Bank account information linked to this agent.",

    notes: isArabic ? "الملاحظات" : "Notes",
    notesDesc: isArabic
      ? "ملاحظات تشغيلية داخلية مرتبطة بالمندوب."
      : "Internal operational notes related to this agent.",

    quickInfo: isArabic ? "معلومات سريعة" : "Quick Info",
    copy: isArabic ? "نسخ" : "Copy",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تفاصيل المندوبين. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view agent details. Contact your system administrator if you need access.",

    notFoundTitle: isArabic ? "المندوب غير موجود" : "Agent not found",
    notFoundText: isArabic
      ? "لم يتم العثور على المندوب المطلوب أو قد يكون غير متاح."
      : "The requested agent could not be found or may not be available.",

    loadError: isArabic
      ? "تعذر تحميل تفاصيل المندوب."
      : "Unable to load agent details.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث تفاصيل المندوب بنجاح."
      : "Agent details refreshed successfully.",
    printReady: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

    fields: {
      id: isArabic ? "المعرف" : "ID",
      fullName: isArabic ? "اسم المندوب" : "Agent Name",
      agentCode: isArabic ? "كود المندوب" : "Agent Code",
      referralCode: isArabic ? "كود الإحالة" : "Referral Code",
      status: isArabic ? "الحالة" : "Status",
      phone: isArabic ? "رقم الجوال" : "Phone",
      email: isArabic ? "البريد الإلكتروني" : "Email",
      city: isArabic ? "المدينة" : "City",
      address: isArabic ? "العنوان" : "Address",
      commissionType: isArabic ? "نوع العمولة" : "Commission Type",
      commissionValue: isArabic ? "قيمة العمولة" : "Commission Value",
      totalCustomers: isArabic ? "إجمالي العملاء" : "Total Customers",
      totalOrders: isArabic ? "إجمالي الطلبات" : "Total Orders",
      totalSales: isArabic ? "إجمالي المبيعات" : "Total Sales",
      pendingCommission: isArabic ? "عمولة معلقة" : "Pending Commission",
      approvedCommission: isArabic ? "عمولة معتمدة" : "Approved Commission",
      paidCommission: isArabic ? "عمولة مدفوعة" : "Paid Commission",
      accountingPostedCommission: isArabic
        ? "عمولة مرحلة محاسبيًا"
        : "Accounting Posted Commission",
      bankName: isArabic ? "اسم البنك" : "Bank Name",
      bankAccountName: isArabic ? "اسم صاحب الحساب" : "Account Holder",
      iban: isArabic ? "IBAN" : "IBAN",
      notes: isArabic ? "الملاحظات" : "Notes",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isArabic ? "آخر تحديث" : "Updated At",
    },

    statuses: {
      ACTIVE: isArabic ? "نشط" : "Active",
      INACTIVE: isArabic ? "غير نشط" : "Inactive",
      SUSPENDED: isArabic ? "موقوف" : "Suspended",
      DRAFT: isArabic ? "مسودة" : "Draft",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<AgentStatus, string>,

    commissionTypes: {
      PERCENTAGE: isArabic ? "نسبة" : "Percentage",
      FIXED: isArabic ? "مبلغ ثابت" : "Fixed Amount",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<CommissionType, string>,

    badges: {
      featured: isArabic ? "مميز" : "Featured",
      active: isArabic ? "نشط" : "Active",
      hasBank: isArabic ? "بيانات بنكية متوفرة" : "Bank Details Available",
      noBank: isArabic ? "لا توجد بيانات بنكية" : "No Bank Details",
      hasContact: isArabic ? "بيانات تواصل متوفرة" : "Contact Available",
      noContact: isArabic ? "لا توجد بيانات تواصل" : "No Contact",
    },

    empty: isArabic ? "لا توجد بيانات" : "No data",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
  };
}

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

function formatDate(value: string): string {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isValidId(id: unknown) {
  const value = String(id || "").trim();

  return value.length > 0 && value !== "-" && value !== "undefined";
}

function statusLabel(status: AgentStatus, locale: AppLocale) {
  return dictionary(locale).statuses[status];
}

function commissionLabel(type: CommissionType, locale: AppLocale) {
  return dictionary(locale).commissionTypes[type];
}

function statusBadge(status: AgentStatus, locale: AppLocale) {
  const label = statusLabel(status, locale);

  if (status === "ACTIVE") {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
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

  if (status === "SUSPENDED") {
    return (
      <Badge className="rounded-full border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300">
        {label}
      </Badge>
    );
  }

  if (status === "INACTIVE") {
    return (
      <Badge variant="outline" className="rounded-full px-3 py-1">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="rounded-full px-3 py-1">
      {label}
    </Badge>
  );
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

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function copyToClipboard(value: string, successMessage: string) {
  if (!value || value === "-") return;

  navigator.clipboard.writeText(value);
  toast.success(successMessage);
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="space-y-4 p-5">
          <SkeletonLine className="h-16 w-16 rounded-2xl" />
          <SkeletonLine className="h-6 w-48" />
          <SkeletonLine className="h-4 w-32" />
          <div className="grid gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonLine key={index} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-3 p-5">
              <SkeletonLine className="h-5 w-40" />
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-4 w-3/4" />
              <SkeletonLine className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  copyable,
  copiedMessage,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  copiedMessage: string;
}) {
  return (
    <TableRow>
      <TableCell className="w-[220px] text-muted-foreground">{label}</TableCell>
      <TableCell>
        <div className="flex items-center justify-between gap-3">
          <span className="break-words font-medium">{value || "-"}</span>

          {copyable && value && value !== "-" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg"
              onClick={() => copyToClipboard(value, copiedMessage)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function QuickInfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-background p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold">{value || "-"}</p>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="mt-2 text-lg font-bold">{value}</div>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function TextSection({
  label,
  value,
  empty,
}: {
  label: string;
  value: string;
  empty: string;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
        {value || empty}
      </p>
    </div>
  );
}

/* ============================================================
   Print
============================================================ */

function buildPrintHtml({
  locale,
  agent,
  t,
}: {
  locale: AppLocale;
  agent: AgentDetail;
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const rows: Array<[string, string]> = [
    [t.fields.fullName, agent.fullName],
    [t.fields.agentCode, agent.agentCode],
    [t.fields.referralCode, agent.referralCode],
    [t.fields.status, statusLabel(agent.status, locale)],
    [t.fields.phone, agent.phone || "-"],
    [t.fields.email, agent.email || "-"],
    [t.fields.city, agent.city || "-"],
    [t.fields.address, agent.address || "-"],
    [t.fields.commissionType, commissionLabel(agent.defaultCommissionType, locale)],
    [
      t.fields.commissionValue,
      agent.defaultCommissionType === "FIXED"
        ? formatMoney(agent.defaultCommissionValue)
        : `${formatNumber(agent.defaultCommissionValue)}%`,
    ],
    [t.fields.totalCustomers, formatNumber(agent.totalCustomers)],
    [t.fields.totalOrders, formatNumber(agent.totalOrders)],
    [t.fields.totalSales, formatMoney(agent.totalSales)],
    [t.fields.pendingCommission, formatMoney(agent.pendingCommission)],
    [t.fields.approvedCommission, formatMoney(agent.approvedCommission)],
    [t.fields.paidCommission, formatMoney(agent.paidCommission)],
    [t.fields.bankName, agent.bankName || "-"],
    [t.fields.bankAccountName, agent.bankAccountName || "-"],
    [t.fields.iban, agent.iban || "-"],
    [t.fields.createdAt, formatDate(agent.createdAt)],
    [t.fields.updatedAt, formatDate(agent.updatedAt || agent.createdAt)],
  ];

  return `
    <!doctype html>
    <html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(t.title)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            font-family: Arial, Tahoma, sans-serif;
            color: #111827;
            background: #ffffff;
            direction: ${isArabic ? "rtl" : "ltr"};
            text-align: ${isArabic ? "right" : "left"};
          }
          .print-header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: flex-start;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 14px;
            margin-bottom: 18px;
          }
          h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 800;
          }
          .meta {
            margin-top: 8px;
            font-size: 12px;
            line-height: 1.8;
            color: #6b7280;
          }
          .badge {
            display: inline-block;
            border: 1px solid #d1d5db;
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 12px;
            color: #374151;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-bottom: 18px;
          }
          th,
          td {
            border: 1px solid #e5e7eb;
            padding: 10px 9px;
            text-align: ${isArabic ? "right" : "left"};
            vertical-align: top;
          }
          th {
            width: 240px;
            background: #f3f4f6;
            color: #111827;
          }
          .section-title {
            margin: 18px 0 8px;
            font-size: 16px;
            font-weight: 800;
          }
          .text-block {
            border: 1px solid #e5e7eb;
            padding: 12px;
            border-radius: 12px;
            line-height: 1.8;
            white-space: pre-wrap;
          }
          @page {
            size: A4;
            margin: 12mm;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>

      <body>
        <div class="print-header">
          <div>
            <h1>${escapeHtml(agent.fullName)}</h1>
            <div class="meta">
              <div>${escapeHtml(t.fields.agentCode)}: ${escapeHtml(agent.agentCode)}</div>
              <div>${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <table>
          <tbody>
            ${rows
              .map(
                ([label, value]) => `
                  <tr>
                    <th>${escapeHtml(label)}</th>
                    <td>${escapeHtml(value || "-")}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>

        <div class="section-title">${escapeHtml(t.fields.notes)}</div>
        <div class="text-block">${escapeHtml(agent.notes || "-")}</div>

        <script>
          window.addEventListener("load", () => {
            window.focus();
            window.print();
          });
        </script>
      </body>
    </html>
  `;
}

/* ============================================================
   Page
============================================================ */

export default function SystemAgentDetailsPage() {
  const params = useParams();
  const auth = useAuth() as unknown;

  const agentId = String(params?.id || "");

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [notFound, setNotFound] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const authResolving = isAuthResolving(auth);

  const canViewAgents = hasSafePermission(
    auth,
    ["agents.view", "agents.detail", "agents.list"],
    "view",
  );

  const canViewAgentsList = hasSafePermission(
    auth,
    ["agents.view", "agents.list"],
    "view",
  );

  const canPrintAgents = hasSafePermission(
    auth,
    ["agents.print", "reports.print"],
    "action",
  );

  const canViewCommissions = hasSafePermission(
    auth,
    ["agents.commissions.view"],
    "view",
  );

  const loadAgent = useCallback(
    async (showToast = false) => {
      if (!canViewAgents) {
        setIsLoading(false);
        setAgent(null);
        return;
      }

      if (!isValidId(agentId)) {
        setIsLoading(false);
        setAgent(null);
        setNotFound(true);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        setNotFound(false);

        const response = await fetch(
          apiUrl(`/api/agents/${encodeURIComponent(agentId)}/`),
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const payload = (await response.json().catch(() => null)) as
          | AgentDetailResponse
          | null;

        if (response.status === 404) {
          setAgent(null);
          setNotFound(true);
          return;
        }

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.message || `HTTP ${response.status}`);
        }

        const normalized = normalizeAgentDetail(payload);

        if (!isValidId(normalized.id)) {
          setAgent(null);
          setNotFound(true);
          return;
        }

        setAgent(normalized);

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load agent details:", error);
        setAgent(null);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [agentId, canViewAgents, t.loadError, t.refreshSuccess],
  );

  function printAgent() {
    if (!canPrintAgents || !agent) return;

    const printWindow = window.open("", "_blank", "width=1000,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        locale,
        agent,
        t,
      }),
    );
    printWindow.document.close();

    toast.success(t.printReady);
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
    loadAgent(false);
  }, [authResolving, loadAgent]);

  if (!authResolving && !canViewAgents) {
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
            {agent?.fullName || t.title}
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/system/agents">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          {canViewAgentsList ? (
            <Link href="/system/agents/list">
              <Button
                variant="outline"
                className="h-10 w-full rounded-xl sm:w-auto"
              >
                <ClipboardList className="h-4 w-4" />
                <span>{t.agentsList}</span>
              </Button>
            </Link>
          ) : null}

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadAgent(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canPrintAgents && agent ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printAgent}
              disabled={isLoading || Boolean(errorMessage) || notFound}
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Error State */}
      {!isLoading && errorMessage ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <XCircle className="h-5 w-5" />
              </div>

              <div>
                <p className="font-semibold text-destructive">{errorMessage}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.loadErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadAgent(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Not Found */}
      {!isLoading && !errorMessage && notFound ? (
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <UserRound className="h-7 w-7 text-muted-foreground" />
            </div>

            <div>
              <p className="text-lg font-semibold">{t.notFoundTitle}</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {t.notFoundText}
              </p>
            </div>

            {canViewAgentsList ? (
              <Link href="/system/agents/list">
                <Button className="mt-2 rounded-xl">
                  <ClipboardList className="h-4 w-4" />
                  {t.agentsList}
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Loading */}
      {isLoading ? <DetailSkeleton /> : null}

      {/* Details */}
      {!isLoading && !errorMessage && agent && !notFound ? (
        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          {/* Profile Card */}
          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="space-y-5 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border bg-muted">
                    <UserRound className="h-8 w-8" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-lg font-bold">
                        {agent.fullName}
                      </p>

                      {agent.isFeatured ? (
                        <Star className="h-4 w-4 shrink-0 fill-orange-400 text-orange-400" />
                      ) : null}
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {agent.agentCode}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {statusBadge(agent.status, locale)}
                      <Badge variant="secondary" className="rounded-full">
                        {agent.referralCode}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.fields.approvedCommission}
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    <SarAmount value={agent.approvedCommission} />
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full">
                      {commissionLabel(agent.defaultCommissionType, locale)}
                    </Badge>

                    <Badge variant="outline" className="rounded-full">
                      {agent.defaultCommissionType === "FIXED" ? (
                        <SarAmount value={agent.defaultCommissionValue} />
                      ) : (
                        `${formatNumber(agent.defaultCommissionValue)}%`
                      )}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() => copyToClipboard(agent.agentCode, t.copied)}
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy} {t.fields.agentCode}
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() => copyToClipboard(agent.referralCode, t.copied)}
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy} {t.fields.referralCode}
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() => copyToClipboard(String(agent.id), t.copied)}
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy} {t.fields.id}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">
                  {t.quickInfo}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <QuickInfoItem
                  icon={Phone}
                  label={t.fields.phone}
                  value={agent.phone || "-"}
                />

                <QuickInfoItem
                  icon={Mail}
                  label={t.fields.email}
                  value={agent.email || "-"}
                />

                <QuickInfoItem
                  icon={MapPin}
                  label={t.fields.city}
                  value={agent.city || "-"}
                />

                <QuickInfoItem
                  icon={CalendarDays}
                  label={t.fields.updatedAt}
                  value={formatDate(agent.updatedAt || agent.createdAt)}
                />
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="space-y-4">
            {/* Overview */}
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Eye className="h-4 w-4" />
                  {t.overview}
                </CardTitle>
                <CardDescription>{t.overviewDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableBody>
                      <InfoRow
                        label={t.fields.id}
                        value={String(agent.id || "-")}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.fullName}
                        value={agent.fullName}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.agentCode}
                        value={agent.agentCode}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.referralCode}
                        value={agent.referralCode}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.status}
                        value={statusLabel(agent.status, locale)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.createdAt}
                        value={formatDate(agent.createdAt)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.updatedAt}
                        value={formatDate(agent.updatedAt || agent.createdAt)}
                        copiedMessage={t.copied}
                      />
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Contact */}
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Phone className="h-4 w-4" />
                  {t.contact}
                </CardTitle>
                <CardDescription>{t.contactDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableBody>
                      <InfoRow
                        label={t.fields.phone}
                        value={agent.phone || "-"}
                        copyable={Boolean(agent.phone)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.email}
                        value={agent.email || "-"}
                        copyable={Boolean(agent.email)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.city}
                        value={agent.city || "-"}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.address}
                        value={agent.address || "-"}
                        copiedMessage={t.copied}
                      />
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Performance */}
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <ShieldCheck className="h-4 w-4" />
                  {t.performance}
                </CardTitle>
                <CardDescription>{t.performanceDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    icon={Users}
                    label={t.fields.totalCustomers}
                    value={formatNumber(agent.totalCustomers)}
                  />
                  <MetricCard
                    icon={ClipboardList}
                    label={t.fields.totalOrders}
                    value={formatNumber(agent.totalOrders)}
                  />
                  <MetricCard
                    icon={Wallet}
                    label={t.fields.totalSales}
                    value={<SarAmount value={agent.totalSales} />}
                  />
                  <MetricCard
                    icon={HandCoins}
                    label={t.fields.approvedCommission}
                    value={<SarAmount value={agent.approvedCommission} />}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Commissions */}
            {canViewCommissions ? (
              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <HandCoins className="h-4 w-4" />
                    {t.commissions}
                  </CardTitle>
                  <CardDescription>{t.commissionsDesc}</CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      icon={IdCard}
                      label={t.fields.commissionType}
                      value={commissionLabel(agent.defaultCommissionType, locale)}
                    />
                    <MetricCard
                      icon={BadgeCheck}
                      label={t.fields.commissionValue}
                      value={
                        agent.defaultCommissionType === "FIXED" ? (
                          <SarAmount value={agent.defaultCommissionValue} />
                        ) : (
                          `${formatNumber(agent.defaultCommissionValue)}%`
                        )
                      }
                    />
                    <MetricCard
                      icon={Wallet}
                      label={t.fields.pendingCommission}
                      value={<SarAmount value={agent.pendingCommission} />}
                    />
                    <MetricCard
                      icon={CheckCircle2}
                      label={t.fields.paidCommission}
                      value={<SarAmount value={agent.paidCommission} />}
                    />
                  </div>

                  <div className="mt-4 overflow-hidden rounded-xl border">
                    <Table>
                      <TableBody>
                        <InfoRow
                          label={t.fields.pendingCommission}
                          value={formatMoney(agent.pendingCommission)}
                          copiedMessage={t.copied}
                        />
                        <InfoRow
                          label={t.fields.approvedCommission}
                          value={formatMoney(agent.approvedCommission)}
                          copiedMessage={t.copied}
                        />
                        <InfoRow
                          label={t.fields.paidCommission}
                          value={formatMoney(agent.paidCommission)}
                          copiedMessage={t.copied}
                        />
                        <InfoRow
                          label={t.fields.accountingPostedCommission}
                          value={formatMoney(agent.accountingPostedCommission)}
                          copiedMessage={t.copied}
                        />
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Bank */}
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Landmark className="h-4 w-4" />
                  {t.bank}
                </CardTitle>
                <CardDescription>{t.bankDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableBody>
                      <InfoRow
                        label={t.fields.bankName}
                        value={agent.bankName || "-"}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.bankAccountName}
                        value={agent.bankAccountName || "-"}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.iban}
                        value={agent.iban || "-"}
                        copyable={Boolean(agent.iban)}
                        copiedMessage={t.copied}
                      />
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full">
                    <Banknote className="h-3.5 w-3.5" />
                    {agent.bankName || agent.iban ? t.badges.hasBank : t.badges.noBank}
                  </Badge>

                  <Badge variant="outline" className="rounded-full">
                    <Phone className="h-3.5 w-3.5" />
                    {agent.phone || agent.email
                      ? t.badges.hasContact
                      : t.badges.noContact}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <FileText className="h-4 w-4" />
                  {t.notes}
                </CardTitle>
                <CardDescription>{t.notesDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                <TextSection
                  label={t.fields.notes}
                  value={agent.notes}
                  empty={t.empty}
                />
              </CardContent>
            </Card>
          </main>
        </div>
      ) : null}
    </div>
  );
}