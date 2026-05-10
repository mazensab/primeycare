"use client";

/* ============================================================
   📂 app/system/contracts/[id]/page.tsx
   🧠 Primey Care | Marketing Contract Details
   ------------------------------------------------------------
   ✅ تفاصيل عقد تسويق لمنتجات مقدم الخدمة
   ✅ العقد لا يحتوي قيمة مالية مباشرة
   ✅ منتجات العقد: السعر قبل الخصم / نسبة الخصم / السعر بعد الخصم
   ✅ منتجات العقد: تاريخ بداية ونهاية لكل منتج داخل العقد
   ✅ Provider Marketing Contract
   ✅ Phase 17 UX + Phase 2 Permissions
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  ClipboardList,
  Copy,
  Eye,
  FileText,
  Handshake,
  Layers3,
  Loader2,
  Package,
  Percent,
  Printer,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Tag,
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";
type AuthRecord = Record<string, unknown>;

type ContractStatus =
  | "DRAFT"
  | "ACTIVE"
  | "SUSPENDED"
  | "EXPIRED"
  | "TERMINATED"
  | "UNKNOWN";

type ContractProduct = {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  productType: string;
  priceBeforeDiscount: number;
  discountPercentage: number;
  priceAfterDiscount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  raw: Record<string, unknown>;
};

type ContractDetail = {
  id: number | string;
  contractNumber: string;
  title: string;
  providerId: string;
  providerName: string;
  providerCode: string;
  status: ContractStatus;
  systemCommissionPercentage: number;
  startDate: string;
  endDate: string;
  termsAndConditions: string;
  coverageNotes: string;
  notes: string;
  isMarketingContract: boolean;
  autoActivate: boolean;
  notifyProvider: boolean;
  products: ContractProduct[];
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type ContractDetailResponse = {
  ok?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  data?: unknown;
  contract?: unknown;
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

  const parsed = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, ""),
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(value: unknown): ContractStatus {
  const status = String(value || "").trim().toUpperCase();

  if (status === "DRAFT") return "DRAFT";
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "SUSPENDED") return "SUSPENDED";
  if (status === "EXPIRED") return "EXPIRED";
  if (status === "TERMINATED") return "TERMINATED";

  return "UNKNOWN";
}

function getObjectValue(obj: Record<string, unknown>, key: string): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  const containers = [
    "contract",
    "provider",
    "product",
    "item",
    "data",
    "summary",
    "totals",
  ];

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

function unwrapContract(payload: unknown): unknown {
  const wrapper = (payload || {}) as ContractDetailResponse;

  return wrapper.data || wrapper.contract || wrapper.item || payload || {};
}

function calculatePriceAfterDiscount(price: unknown, discount: unknown) {
  const originalPrice = toNumber(price);
  const discountPercentage = Math.min(Math.max(toNumber(discount), 0), 100);
  const result = originalPrice - originalPrice * (discountPercentage / 100);

  return Math.max(result, 0);
}

function normalizeContractProduct(item: unknown, index: number): ContractProduct {
  const obj = (item || {}) as Record<string, unknown>;
  const product = obj.product as Record<string, unknown> | undefined;

  const productId = String(
    getObjectValue(obj, "product_id") ??
      getObjectValue(obj, "productId") ??
      product?.id ??
      getObjectValue(obj, "id") ??
      "",
  );

  const productName = String(
    getObjectValue(obj, "product_name") ??
      product?.name ??
      product?.title ??
      product?.name_ar ??
      product?.name_en ??
      getObjectValue(obj, "name") ??
      getObjectValue(obj, "title") ??
      "-",
  );

  const productCode = String(
    getObjectValue(obj, "product_code") ??
      product?.code ??
      getObjectValue(obj, "code") ??
      "",
  );

  const priceBeforeDiscount = toNumber(
    getObjectValue(obj, "price_before_discount") ??
      getObjectValue(obj, "original_price") ??
      getObjectValue(obj, "base_price") ??
      getObjectValue(obj, "list_price") ??
      getObjectValue(obj, "price") ??
      product?.price ??
      product?.base_price ??
      product?.sale_price ??
      0,
  );

  const discountPercentage = toNumber(
    getObjectValue(obj, "discount_percentage") ??
      getObjectValue(obj, "discount_percent") ??
      getObjectValue(obj, "discount_rate") ??
      0,
  );

  const explicitPriceAfterDiscount =
    getObjectValue(obj, "price_after_discount") ??
    getObjectValue(obj, "final_price") ??
    getObjectValue(obj, "special_price") ??
    getObjectValue(obj, "net_price") ??
    getObjectValue(obj, "effective_price");

  const priceAfterDiscount =
    explicitPriceAfterDiscount !== undefined &&
    explicitPriceAfterDiscount !== null &&
    explicitPriceAfterDiscount !== ""
      ? toNumber(explicitPriceAfterDiscount)
      : calculatePriceAfterDiscount(priceBeforeDiscount, discountPercentage);

  const startDate = String(
    getObjectValue(obj, "item_start_date") ??
      getObjectValue(obj, "start_date") ??
      getObjectValue(obj, "valid_from") ??
      "",
  );

  const endDate = String(
    getObjectValue(obj, "item_end_date") ??
      getObjectValue(obj, "end_date") ??
      getObjectValue(obj, "valid_to") ??
      "",
  );

  return {
    id: String(getObjectValue(obj, "id") ?? `${index + 1}`),
    productId,
    productName,
    productCode,
    productType: String(
      getObjectValue(obj, "product_type") ??
        product?.product_type ??
        product?.type ??
        "",
    ),
    priceBeforeDiscount,
    discountPercentage,
    priceAfterDiscount,
    startDate,
    endDate,
    isActive: Boolean(getObjectValue(obj, "is_active") ?? true),
    raw: obj,
  };
}

function extractProducts(obj: Record<string, unknown>): ContractProduct[] {
  const sources = [
    obj.contract_products,
    obj.products,
    obj.items,
    obj.service_items,
    obj.product_items,
  ];

  const source = sources.find(Array.isArray) as unknown[] | undefined;

  return (source || []).map(normalizeContractProduct);
}

function normalizeContractDetail(payload: unknown): ContractDetail {
  const obj = unwrapContract(payload) as Record<string, unknown>;
  const provider = obj.provider as Record<string, unknown> | undefined;
  const id = getObjectValue(obj, "id") ?? "";

  const contractNumber =
    getObjectValue(obj, "contract_number") ??
    getObjectValue(obj, "number") ??
    getObjectValue(obj, "code") ??
    (id ? `CTR-${id}` : "-");

  const title =
    getObjectValue(obj, "title") ??
    getObjectValue(obj, "name") ??
    getObjectValue(obj, "contract_title") ??
    contractNumber;

  return {
    id: id as number | string,
    contractNumber: String(contractNumber || "-"),
    title: String(title || "-"),
    providerId: String(getObjectValue(obj, "provider_id") ?? provider?.id ?? ""),
    providerName: String(
      getObjectValue(obj, "provider_name") ??
        provider?.name ??
        provider?.name_ar ??
        provider?.name_en ??
        "-",
    ),
    providerCode: String(getObjectValue(obj, "provider_code") ?? provider?.code ?? ""),
    status: normalizeStatus(getObjectValue(obj, "status")),
    systemCommissionPercentage: toNumber(
      getObjectValue(obj, "system_commission_percentage") ??
        getObjectValue(obj, "commission_percentage") ??
        getObjectValue(obj, "commission_percent") ??
        0,
    ),
    startDate: String(
      getObjectValue(obj, "start_date") ??
        getObjectValue(obj, "valid_from") ??
        "",
    ),
    endDate: String(
      getObjectValue(obj, "end_date") ?? getObjectValue(obj, "valid_to") ?? "",
    ),
    termsAndConditions: String(getObjectValue(obj, "terms_and_conditions") ?? ""),
    coverageNotes: String(getObjectValue(obj, "coverage_notes") ?? ""),
    notes: String(getObjectValue(obj, "notes") ?? ""),
    isMarketingContract: true,
    autoActivate: Boolean(getObjectValue(obj, "auto_activate") ?? false),
    notifyProvider: Boolean(getObjectValue(obj, "notify_provider") ?? false),
    products: extractProducts(obj),
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
    title: isArabic ? "تفاصيل عقد التسويق" : "Marketing Contract Details",
    subtitle: isArabic
      ? "عرض بيانات عقد التسويق المرتبط بمقدم الخدمة والمنتجات والأسعار بعد الخصم."
      : "View the marketing contract linked to the provider, products, and discounted prices.",

    back: isArabic ? "العودة للعقود" : "Back to Contracts",
    contractsList: isArabic ? "قائمة العقود" : "Contracts List",
    refresh: isArabic ? "تحديث" : "Refresh",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    copy: isArabic ? "نسخ" : "Copy",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",
    viewProduct: isArabic ? "عرض المنتج" : "View Product",
    viewProvider: isArabic ? "عرض مقدم الخدمة" : "View Provider",

    overview: isArabic ? "نظرة عامة" : "Overview",
    overviewDesc: isArabic
      ? "بيانات العقد الأساسية ومقدم الخدمة وحالة العقد."
      : "Basic contract data, provider, and contract status.",

    products: isArabic ? "منتجات وخدمات العقد" : "Contract Products & Services",
    productsDesc: isArabic
      ? "المنتجات أو البرامج التي يتم تسويقها مع السعر قبل الخصم وبعد الخصم وتاريخ السريان داخل العقد."
      : "Products or programs marketed with prices before and after discount and item validity dates.",

    terms: isArabic ? "الشروط والتغطية" : "Terms & Coverage",
    termsDesc: isArabic
      ? "الشروط والأحكام وملاحظات التغطية والملاحظات الداخلية."
      : "Terms, coverage notes, and internal notes.",

    quickInfo: isArabic ? "معلومات سريعة" : "Quick Info",
    financialSummary: isArabic ? "ملخص المنتجات" : "Products Summary",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تفاصيل العقود. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view contract details. Contact your system administrator if you need access.",

    notFoundTitle: isArabic ? "العقد غير موجود" : "Contract not found",
    notFoundText: isArabic
      ? "لم يتم العثور على العقد المطلوب أو قد يكون غير متاح."
      : "The requested contract could not be found or may not be available.",

    loadError: isArabic
      ? "تعذر تحميل تفاصيل العقد."
      : "Unable to load contract details.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث تفاصيل العقد بنجاح."
      : "Contract details refreshed successfully.",
    printReady: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

    fields: {
      id: isArabic ? "المعرف" : "ID",
      contractNumber: isArabic ? "رقم العقد" : "Contract Number",
      title: isArabic ? "عنوان العقد" : "Contract Title",
      provider: isArabic ? "مقدم الخدمة" : "Provider",
      providerCode: isArabic ? "كود مقدم الخدمة" : "Provider Code",
      status: isArabic ? "الحالة" : "Status",
      systemCommission: isArabic ? "نسبة النظام" : "System Commission",
      startDate: isArabic ? "تاريخ البداية" : "Start Date",
      endDate: isArabic ? "تاريخ النهاية" : "End Date",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isArabic ? "آخر تحديث" : "Updated At",
      product: isArabic ? "المنتج / الخدمة" : "Product / Service",
      productStartDate: isArabic
        ? "بداية المنتج داخل العقد"
        : "Product Start Date",
      productEndDate: isArabic
        ? "نهاية المنتج داخل العقد"
        : "Product End Date",
      priceBeforeDiscount: isArabic ? "السعر قبل الخصم" : "Price Before Discount",
      discount: isArabic ? "نسبة الخصم" : "Discount",
      priceAfterDiscount: isArabic ? "السعر بعد الخصم" : "Price After Discount",
      productStatus: isArabic ? "حالة المنتج" : "Product Status",
      terms: isArabic ? "الشروط والأحكام" : "Terms & Conditions",
      coverageNotes: isArabic ? "ملاحظات التغطية" : "Coverage Notes",
      notes: isArabic ? "ملاحظات داخلية" : "Internal Notes",
      marketingContract: isArabic ? "عقد تسويق" : "Marketing Contract",
      productsCount: isArabic ? "عدد المنتجات" : "Products Count",
      totalBeforeDiscount: isArabic
        ? "إجمالي قبل الخصم"
        : "Total Before Discount",
      totalAfterDiscount: isArabic ? "إجمالي بعد الخصم" : "Total After Discount",
      totalDiscount: isArabic ? "إجمالي الخصم" : "Total Discount",
    },

    statuses: {
      DRAFT: isArabic ? "مسودة" : "Draft",
      ACTIVE: isArabic ? "نشط" : "Active",
      SUSPENDED: isArabic ? "موقوف" : "Suspended",
      EXPIRED: isArabic ? "منتهي" : "Expired",
      TERMINATED: isArabic ? "منهى" : "Terminated",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<ContractStatus, string>,

    activeProduct: isArabic ? "نشط" : "Active",
    inactiveProduct: isArabic ? "غير نشط" : "Inactive",
    empty: isArabic ? "لا توجد بيانات" : "No data",
    noProducts: isArabic
      ? "لا توجد منتجات أو خدمات مرتبطة بهذا العقد."
      : "No products or services are linked to this contract.",
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

function formatPercent(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0%";

  return `${numericValue.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}%`;
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

  return value.length > 0 && value !== "-" && value !== "undefined" && value !== "null";
}

function statusLabel(status: ContractStatus, locale: AppLocale) {
  return dictionary(locale).statuses[status];
}

function statusBadge(status: ContractStatus, locale: AppLocale) {
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

  if (status === "EXPIRED" || status === "TERMINATED") {
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

function MoneyValue({ value }: { value: string | number }) {
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

function DetailSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="space-y-4 p-5">
          <SkeletonLine className="h-16 w-16 rounded-2xl" />
          <SkeletonLine className="h-6 w-48" />
          <SkeletonLine className="h-4 w-32" />
          <div className="grid gap-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <SkeletonLine key={index} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
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

function copyToClipboard(value: string, successMessage: string) {
  if (!value || value === "-") return;

  navigator.clipboard.writeText(value);
  toast.success(successMessage);
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
  contract,
  t,
}: {
  locale: AppLocale;
  contract: ContractDetail;
  t: ReturnType<typeof dictionary>;
}) {
  const isArabic = locale === "ar";
  const now = new Date().toLocaleString("en-US");

  const productRows = contract.products
    .map(
      (product, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(product.productName || "-")}</td>
          <td>${escapeHtml(product.productCode || "-")}</td>
          <td>${escapeHtml(formatMoney(product.priceBeforeDiscount))}</td>
          <td>${escapeHtml(formatPercent(product.discountPercentage))}</td>
          <td>${escapeHtml(formatMoney(product.priceAfterDiscount))}</td>
          <td>${escapeHtml(formatDate(product.startDate))}</td>
          <td>${escapeHtml(formatDate(product.endDate))}</td>
          <td>${escapeHtml(product.isActive ? t.activeProduct : t.inactiveProduct)}</td>
        </tr>
      `,
    )
    .join("");

  const overviewRows: Array<[string, string]> = [
    [t.fields.contractNumber, contract.contractNumber],
    [t.fields.title, contract.title],
    [t.fields.provider, contract.providerName],
    [t.fields.status, statusLabel(contract.status, locale)],
    [t.fields.systemCommission, formatPercent(contract.systemCommissionPercentage)],
    [t.fields.startDate, formatDate(contract.startDate)],
    [t.fields.endDate, formatDate(contract.endDate)],
    [t.fields.createdAt, formatDate(contract.createdAt)],
    [t.fields.updatedAt, formatDate(contract.updatedAt || contract.createdAt)],
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
            font-size: 12px;
            margin-bottom: 18px;
          }
          th,
          td {
            border: 1px solid #e5e7eb;
            padding: 9px;
            text-align: ${isArabic ? "right" : "left"};
            vertical-align: top;
          }
          th {
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
            size: A4 landscape;
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
            <h1>${escapeHtml(contract.title)}</h1>
            <div class="meta">
              <div>${escapeHtml(t.fields.contractNumber)}: ${escapeHtml(contract.contractNumber)}</div>
              <div>${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <div class="section-title">${escapeHtml(t.overview)}</div>
        <table>
          <tbody>
            ${overviewRows
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

        <div class="section-title">${escapeHtml(t.products)}</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(t.fields.product)}</th>
              <th>${escapeHtml("Code")}</th>
              <th>${escapeHtml(t.fields.priceBeforeDiscount)}</th>
              <th>${escapeHtml(t.fields.discount)}</th>
              <th>${escapeHtml(t.fields.priceAfterDiscount)}</th>
              <th>${escapeHtml(t.fields.productStartDate)}</th>
              <th>${escapeHtml(t.fields.productEndDate)}</th>
              <th>${escapeHtml(t.fields.productStatus)}</th>
            </tr>
          </thead>
          <tbody>
            ${
              productRows ||
              `<tr><td colspan="9" style="text-align:center">${escapeHtml(t.noProducts)}</td></tr>`
            }
          </tbody>
        </table>

        <div class="section-title">${escapeHtml(t.fields.terms)}</div>
        <div class="text-block">${escapeHtml(contract.termsAndConditions || "-")}</div>

        <div class="section-title">${escapeHtml(t.fields.coverageNotes)}</div>
        <div class="text-block">${escapeHtml(contract.coverageNotes || "-")}</div>

        <div class="section-title">${escapeHtml(t.fields.notes)}</div>
        <div class="text-block">${escapeHtml(contract.notes || "-")}</div>

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

export default function SystemContractDetailsPage() {
  const params = useParams();
  const auth = useAuth() as unknown;

  const contractId = String(params?.id || "");

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [notFound, setNotFound] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canViewContracts = hasSafePermission(
    auth,
    ["contracts.view", "contracts.detail", "contracts.list"],
    "view",
  );

  const canViewContractsList = hasSafePermission(
    auth,
    ["contracts.view", "contracts.list"],
    "view",
  );

  const canPrintContracts = hasSafePermission(
    auth,
    ["contracts.print", "reports.print"],
    "action",
  );

  const canViewProviders = hasSafePermission(
    auth,
    ["providers.view", "providers.detail"],
    "view",
  );

  const canViewProducts = hasSafePermission(
    auth,
    ["products.view", "products.detail"],
    "view",
  );

  const productsSummary = useMemo(() => {
    const products = contract?.products || [];

    const totalBeforeDiscount = products.reduce(
      (sum, product) => sum + product.priceBeforeDiscount,
      0,
    );

    const totalAfterDiscount = products.reduce(
      (sum, product) => sum + product.priceAfterDiscount,
      0,
    );

    return {
      count: products.length,
      totalBeforeDiscount,
      totalAfterDiscount,
      totalDiscount: Math.max(totalBeforeDiscount - totalAfterDiscount, 0),
    };
  }, [contract]);

  const loadContract = useCallback(
    async (showToast = false) => {
      if (!canViewContracts) {
        setIsLoading(false);
        setContract(null);
        return;
      }

      if (!isValidId(contractId)) {
        setIsLoading(false);
        setContract(null);
        setNotFound(true);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        setNotFound(false);

        const response = await fetch(
          apiUrl(`/api/contracts/${encodeURIComponent(contractId)}/`),
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const payload = (await response.json().catch(() => null)) as
          | ContractDetailResponse
          | null;

        if (response.status === 404) {
          setContract(null);
          setNotFound(true);
          return;
        }

        if (!response.ok || payload?.ok === false) {
          throw new Error(
            payload?.message ||
              payload?.detail ||
              payload?.error ||
              `HTTP ${response.status}`,
          );
        }

        const normalized = normalizeContractDetail(payload);

        if (!isValidId(normalized.id)) {
          setContract(null);
          setNotFound(true);
          return;
        }

        setContract(normalized);

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load contract details:", error);
        setContract(null);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewContracts, contractId, t.loadError, t.refreshSuccess],
  );

  function printContract() {
    if (!canPrintContracts || !contract) return;

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        locale,
        contract,
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
    loadContract(false);
  }, [authResolving, loadContract]);

  if (!authResolving && !canViewContracts) {
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
            {contract?.title || t.title}
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {contract
              ? `${contract.contractNumber} - ${contract.providerName}`
              : t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/system/contracts">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          {canViewContractsList ? (
            <Link href="/system/contracts/list">
              <Button
                variant="outline"
                className="h-10 w-full rounded-xl sm:w-auto"
              >
                <ClipboardList className="h-4 w-4" />
                <span>{t.contractsList}</span>
              </Button>
            </Link>
          ) : null}

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadContract(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canPrintContracts && contract ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printContract}
              disabled={isLoading || Boolean(errorMessage) || notFound}
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}
        </div>
      </div>

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
              onClick={() => loadContract(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && notFound ? (
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <FileText className="h-7 w-7 text-muted-foreground" />
            </div>

            <div>
              <p className="text-lg font-semibold">{t.notFoundTitle}</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {t.notFoundText}
              </p>
            </div>

            {canViewContractsList ? (
              <Link href="/system/contracts/list">
                <Button className="mt-2 rounded-xl">
                  <ClipboardList className="h-4 w-4" />
                  {t.contractsList}
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? <DetailSkeleton /> : null}

      {!isLoading && !errorMessage && contract && !notFound ? (
        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="space-y-5 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border bg-muted">
                    <Handshake className="h-8 w-8" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-lg font-bold">
                        {contract.title}
                      </p>
                      <Sparkles className="h-4 w-4 shrink-0 fill-orange-400 text-orange-400" />
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {contract.contractNumber}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {statusBadge(contract.status, locale)}
                      <Badge variant="secondary" className="rounded-full">
                        {t.fields.marketingContract}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() =>
                      copyToClipboard(contract.contractNumber, t.copied)
                    }
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy} {t.fields.contractNumber}
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() => copyToClipboard(contract.title, t.copied)}
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy} {t.fields.title}
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start rounded-xl"
                    onClick={() =>
                      copyToClipboard(contract.providerName, t.copied)
                    }
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy} {t.fields.provider}
                  </Button>

                  {canViewProviders && isValidId(contract.providerId) ? (
                    <Button asChild variant="outline" className="justify-start rounded-xl">
                      <Link href={`/system/providers/${contract.providerId}`}>
                        <Eye className="h-4 w-4" />
                        {t.viewProvider}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">
                  {t.quickInfo}
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-3">
                <QuickInfoItem
                  icon={Handshake}
                  label={t.fields.provider}
                  value={contract.providerName}
                />

                <QuickInfoItem
                  icon={Package}
                  label={t.fields.productsCount}
                  value={formatNumber(productsSummary.count)}
                />

                <QuickInfoItem
                  icon={Percent}
                  label={t.fields.systemCommission}
                  value={formatPercent(contract.systemCommissionPercentage)}
                />

                <QuickInfoItem
                  icon={CalendarDays}
                  label={t.fields.startDate}
                  value={formatDate(contract.startDate)}
                />

                <QuickInfoItem
                  icon={CalendarDays}
                  label={t.fields.endDate}
                  value={formatDate(contract.endDate)}
                />

                <QuickInfoItem
                  icon={Wallet}
                  label={t.fields.totalAfterDiscount}
                  value={<MoneyValue value={productsSummary.totalAfterDiscount} />}
                />
              </CardContent>
            </Card>
          </aside>

          <div className="space-y-4">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <FileText className="h-4 w-4" />
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
                        value={String(contract.id)}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.contractNumber}
                        value={contract.contractNumber}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.title}
                        value={contract.title}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.provider}
                        value={contract.providerName}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.providerCode}
                        value={contract.providerCode || "-"}
                        copyable={Boolean(contract.providerCode)}
                        copiedMessage={t.copied}
                      />
                      <TableRow>
                        <TableCell className="w-[220px] text-muted-foreground">
                          {t.fields.status}
                        </TableCell>
                        <TableCell>{statusBadge(contract.status, locale)}</TableCell>
                      </TableRow>
                      <InfoRow
                        label={t.fields.systemCommission}
                        value={formatPercent(contract.systemCommissionPercentage)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.startDate}
                        value={formatDate(contract.startDate)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.endDate}
                        value={formatDate(contract.endDate)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.createdAt}
                        value={formatDate(contract.createdAt)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.updatedAt}
                        value={formatDate(contract.updatedAt || contract.createdAt)}
                        copiedMessage={t.copied}
                      />
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Wallet className="h-4 w-4" />
                  {t.financialSummary}
                </CardTitle>
                <CardDescription>{t.productsDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-4">
                <MetricCard
                  icon={Package}
                  label={t.fields.productsCount}
                  value={formatNumber(productsSummary.count)}
                />

                <MetricCard
                  icon={Wallet}
                  label={t.fields.totalBeforeDiscount}
                  value={<MoneyValue value={productsSummary.totalBeforeDiscount} />}
                />

                <MetricCard
                  icon={Tag}
                  label={t.fields.totalDiscount}
                  value={<MoneyValue value={productsSummary.totalDiscount} />}
                />

                <MetricCard
                  icon={BadgeCheck}
                  label={t.fields.totalAfterDiscount}
                  value={<MoneyValue value={productsSummary.totalAfterDiscount} />}
                />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Package className="h-4 w-4" />
                  {t.products}
                </CardTitle>
                <CardDescription>{t.productsDesc}</CardDescription>
              </CardHeader>

              <CardContent>
                {contract.products.length === 0 ? (
                  <div className="rounded-2xl border bg-background px-6 py-12 text-center">
                    <Package className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-3 text-sm text-muted-foreground">
                      {t.noProducts}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t.fields.product}</TableHead>
                            <TableHead>{t.fields.priceBeforeDiscount}</TableHead>
                            <TableHead>{t.fields.discount}</TableHead>
                            <TableHead>{t.fields.priceAfterDiscount}</TableHead>
                            <TableHead>{t.fields.productStartDate}</TableHead>
                            <TableHead>{t.fields.productEndDate}</TableHead>
                            <TableHead>{t.fields.productStatus}</TableHead>
                            {canViewProducts ? <TableHead></TableHead> : null}
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {contract.products.map((product) => (
                            <TableRow key={`${product.id}-${product.productId}`}>
                              <TableCell>
                                <div className="flex min-w-[240px] items-center gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted">
                                    <Package className="h-4 w-4" />
                                  </div>

                                  <div className="min-w-0">
                                    <p className="truncate font-medium">
                                      {product.productName || "-"}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {product.productCode ||
                                        product.productType ||
                                        product.productId ||
                                        "-"}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>

                              <TableCell>
                                <MoneyValue value={product.priceBeforeDiscount} />
                              </TableCell>

                              <TableCell>
                                {formatPercent(product.discountPercentage)}
                              </TableCell>

                              <TableCell>
                                <MoneyValue value={product.priceAfterDiscount} />
                              </TableCell>

                              <TableCell>{formatDate(product.startDate)}</TableCell>

                              <TableCell>{formatDate(product.endDate)}</TableCell>

                              <TableCell>
                                <Badge
                                  variant={product.isActive ? "default" : "outline"}
                                  className="rounded-full"
                                >
                                  {product.isActive
                                    ? t.activeProduct
                                    : t.inactiveProduct}
                                </Badge>
                              </TableCell>

                              {canViewProducts ? (
                                <TableCell>
                                  {isValidId(product.productId) ? (
                                    <Button asChild variant="outline" size="sm">
                                      <Link href={`/system/products/${product.productId}`}>
                                        <Eye className="h-4 w-4" />
                                        {t.viewProduct}
                                      </Link>
                                    </Button>
                                  ) : null}
                                </TableCell>
                              ) : null}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <ShieldCheck className="h-4 w-4" />
                  {t.terms}
                </CardTitle>
                <CardDescription>{t.termsDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4">
                <TextSection
                  label={t.fields.terms}
                  value={contract.termsAndConditions}
                  empty={t.empty}
                />

                <TextSection
                  label={t.fields.coverageNotes}
                  value={contract.coverageNotes}
                  empty={t.empty}
                />

                <TextSection
                  label={t.fields.notes}
                  value={contract.notes}
                  empty={t.empty}
                />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Layers3 className="h-4 w-4" />
                  {t.fields.marketingContract}
                </CardTitle>
                <CardDescription>{t.subtitle}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-3">
                <MetricCard
                  icon={Handshake}
                  label={t.fields.provider}
                  value={contract.providerName}
                />

                <MetricCard
                  icon={Percent}
                  label={t.fields.systemCommission}
                  value={formatPercent(contract.systemCommissionPercentage)}
                />

                <MetricCard
                  icon={FileText}
                  label={t.fields.status}
                  value={statusLabel(contract.status, locale)}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}