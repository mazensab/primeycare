"use client";

/* ============================================================
   📂 app/system/providers/[id]/page.tsx
   🧠 Primey Care | Provider Details
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ تفاصيل مقدم الخدمة كاملة
   ✅ الاسم العربي والإنجليزي منفصلين
   ✅ السجل التجاري والرقم الضريبي
   ✅ شعار وصورة مقدم الخدمة
   ✅ رفع ملفات مقدم الخدمة إلى Google Drive عبر API
   ✅ عرض مرفقات مقدم الخدمة
   ✅ تجهيز الصفحة للطباعة كتقرير مقدم خدمة
   ✅ تعديل البيانات داخل نفس صفحة التفاصيل
   ✅ PATCH update بدون صفحة edit منفصلة
   ✅ لا يوجد حذف نهائي
   ✅ لا توجد أزرار وهمية أو معطلة
   ✅ Error State مستقل عن Not Found
   ✅ Skeleton Loading
   ✅ Web PDF Print
   ✅ حماية روابط التفاصيل والأزرار والطلبات
   ✅ fallback آمن لـ system_admin / superuser
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ استخدام toast من sonner
   ✅ استخدام رمز العملة /currency/sar.svg
   ✅ بدون localhost hardcoded
   ✅ بدون main / min-h-screen / max-w
   ✅ الأرقام تبقى بالإنجليزية
============================================================ */

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  ClipboardList,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  FolderOpen,
  Hospital,
  ImageIcon,
  Layers3,
  Loader2,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Printer,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UploadCloud,
  X,
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
type AuthRecord = Record<string, unknown>;

type ProviderStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "DRAFT"
  | "UNKNOWN";

type EditableProviderStatus = Exclude<ProviderStatus, "UNKNOWN">;

type ProviderType =
  | "HOSPITAL"
  | "MEDICAL_CENTER"
  | "PHARMACY"
  | "PARTNER"
  | "LAB"
  | "CLINIC"
  | "OTHER"
  | "UNKNOWN";

type EditableProviderType = Exclude<ProviderType, "UNKNOWN">;

type ProviderDocumentType =
  | "logo"
  | "image"
  | "product_image"
  | "contract_file"
  | "commercial_registration"
  | "tax_certificate"
  | "license"
  | "other";

type ProviderDocument = {
  id: number | string;
  fileType: ProviderDocumentType | string;
  fileTypeLabel: string;
  title: string;
  description: string;
  fileUrl: string;
  driveFileId: string;
  driveFolderId: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  isPrimary: boolean;
  uploadedBy: string;
  createdAt: string;
  raw: Record<string, unknown>;
};

type RelatedContractItem = {
  id: string;
  title: string;
  status: string;
  discount: string;
  systemCommission: string;
  startDate: string;
  endDate: string;
  raw: Record<string, unknown>;
};

type RelatedProductItem = {
  id: string;
  title: string;
  type: string;
  priceBeforeDiscount: string;
  discount: string;
  priceAfterDiscount: string;
  ordersCount: string;
  raw: Record<string, unknown>;
};

type RelatedOrderItem = {
  id: string;
  number: string;
  customer: string;
  status: string;
  total: string;
  createdAt: string;
  raw: Record<string, unknown>;
};

type ProviderDetail = {
  id: number | string;
  name: string;
  nameAr: string;
  nameEn: string;
  displayNameAr: string;
  displayNameEn: string;
  code: string;
  providerType: ProviderType;
  status: ProviderStatus;
  commercialRegistration: string;
  taxNumber: string;
  logoUrl: string;
  logoDriveFileId: string;
  imageUrl: string;
  imageDriveFileId: string;
  driveFolderId: string;
  driveFolderUrl: string;
  contactPerson: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  region: string;
  city: string;
  area: string;
  street: string;
  address: string;
  googleMapsLink: string;
  sourceCategory: string;
  importSource: string;
  externalReference: string;
  notes: string;
  isFeatured: boolean;
  ordersCount: number;
  documents: ProviderDocument[];
  contracts: RelatedContractItem[];
  products: RelatedProductItem[];
  orders: RelatedOrderItem[];
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type ProviderFormData = {
  name: string;
  name_ar: string;
  name_en: string;
  code: string;
  provider_type: EditableProviderType;
  status: EditableProviderStatus;
  commercial_registration: string;
  tax_number: string;
  contact_person: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  region: string;
  city: string;
  area: string;
  street: string;
  address: string;
  google_maps_link: string;
  source_category: string;
  external_reference: string;
  notes: string;
  is_featured: boolean;
};

type ProviderFormErrors = Partial<Record<keyof ProviderFormData, string>>;

type ProviderDetailResponse = {
  ok?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  errors?: Record<string, string[] | string> | string[] | string;
  data?: unknown;
  provider?: unknown;
  item?: unknown;
};

type UploadFileType = ProviderDocumentType;

const DEFAULT_PROVIDER_TYPE: EditableProviderType = "MEDICAL_CENTER";
const DEFAULT_PROVIDER_STATUS: EditableProviderStatus = "ACTIVE";

const PROVIDER_FORM_FIELDS: Array<keyof ProviderFormData> = [
  "name",
  "name_ar",
  "name_en",
  "code",
  "provider_type",
  "status",
  "commercial_registration",
  "tax_number",
  "contact_person",
  "phone",
  "mobile",
  "email",
  "website",
  "region",
  "city",
  "area",
  "street",
  "address",
  "google_maps_link",
  "source_category",
  "external_reference",
  "notes",
  "is_featured",
];

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
   Normalizers
============================================================ */

function normalizeStatus(value: unknown): ProviderStatus {
  const status = String(value || "").trim().toUpperCase();

  if (status === "ACTIVE") return "ACTIVE";
  if (status === "INACTIVE") return "INACTIVE";
  if (status === "SUSPENDED") return "SUSPENDED";
  if (status === "DRAFT") return "DRAFT";

  if (value === true) return "ACTIVE";
  if (value === false) return "INACTIVE";

  return "UNKNOWN";
}

function normalizeProviderType(value: unknown): ProviderType {
  const providerType = String(value || "").trim().toUpperCase();

  if (providerType === "HOSPITAL") return "HOSPITAL";
  if (providerType === "MEDICAL_CENTER") return "MEDICAL_CENTER";
  if (providerType === "PHARMACY") return "PHARMACY";
  if (providerType === "PARTNER") return "PARTNER";
  if (providerType === "LAB") return "LAB";
  if (providerType === "CLINIC") return "CLINIC";
  if (providerType === "OTHER") return "OTHER";

  return "UNKNOWN";
}

function toEditableProviderType(value: ProviderType): EditableProviderType {
  if (value === "UNKNOWN") return DEFAULT_PROVIDER_TYPE;
  return value;
}

function toEditableProviderStatus(value: ProviderStatus): EditableProviderStatus {
  if (value === "UNKNOWN") return DEFAULT_PROVIDER_STATUS;
  return value;
}

function getObjectValue(obj: Record<string, unknown>, key: string): unknown {
  const direct = obj[key];

  if (direct !== undefined && direct !== null && direct !== "") {
    return direct;
  }

  const containers = ["provider", "item", "data", "profile"];

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

function getString(obj: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = getObjectValue(obj, key);

    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }

  return fallback;
}

function getNumber(obj: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = getObjectValue(obj, key);
    const numberValue = Number(value);

    if (Number.isFinite(numberValue)) return numberValue;
  }

  return fallback;
}

function getArray(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = getObjectValue(obj, key);

    if (Array.isArray(value)) return value;
  }

  return [];
}

function unwrapProvider(payload: unknown): unknown {
  const wrapper = (payload || {}) as ProviderDetailResponse;

  return wrapper.data || wrapper.provider || wrapper.item || payload || {};
}

function normalizeDocument(value: unknown): ProviderDocument {
  const obj = asRecord(value);

  return {
    id: String(getObjectValue(obj, "id") ?? ""),
    fileType: String(getObjectValue(obj, "file_type") ?? "other"),
    fileTypeLabel: String(getObjectValue(obj, "file_type_label") ?? ""),
    title: String(getObjectValue(obj, "title") ?? ""),
    description: String(getObjectValue(obj, "description") ?? ""),
    fileUrl: String(
      getObjectValue(obj, "file_url") ??
        getObjectValue(obj, "url") ??
        getObjectValue(obj, "link") ??
        "",
    ),
    driveFileId: String(getObjectValue(obj, "drive_file_id") ?? ""),
    driveFolderId: String(getObjectValue(obj, "drive_folder_id") ?? ""),
    originalFilename: String(getObjectValue(obj, "original_filename") ?? ""),
    contentType: String(getObjectValue(obj, "content_type") ?? ""),
    sizeBytes: Number(getObjectValue(obj, "size_bytes") ?? 0) || 0,
    isPrimary: Boolean(getObjectValue(obj, "is_primary")),
    uploadedBy: String(getObjectValue(obj, "uploaded_by") ?? ""),
    createdAt: String(getObjectValue(obj, "created_at") ?? ""),
    raw: obj,
  };
}

function normalizeContractItem(value: unknown): RelatedContractItem {
  const obj = asRecord(value);

  return {
    id: getString(obj, ["id", "contract_id", "uuid"], "-"),
    title: getString(obj, ["title", "name", "contract_number", "number"], "-"),
    status: getString(obj, ["status"], "-"),
    discount: getString(obj, ["discount_percentage", "discount", "provider_discount"], "-"),
    systemCommission: getString(obj, [
      "system_commission_percentage",
      "commission_percentage",
      "system_commission",
    ], "-"),
    startDate: getString(obj, ["start_date", "starts_at", "created_at"], ""),
    endDate: getString(obj, ["end_date", "ends_at"], ""),
    raw: obj,
  };
}

function normalizeProductItem(value: unknown): RelatedProductItem {
  const obj = asRecord(value);

  return {
    id: getString(obj, ["id", "product_id", "service_id", "program_id"], "-"),
    title: getString(obj, ["title", "name", "product_name", "service_name"], "-"),
    type: getString(obj, ["type", "product_type", "category"], "-"),
    priceBeforeDiscount: getString(obj, [
      "price_before_discount",
      "base_price",
      "original_price",
      "price",
    ], "-"),
    discount: getString(obj, ["discount_percentage", "discount", "provider_discount"], "-"),
    priceAfterDiscount: getString(obj, [
      "price_after_discount",
      "final_price",
      "discounted_price",
    ], "-"),
    ordersCount: getString(obj, ["orders_count", "order_count", "total_orders"], "0"),
    raw: obj,
  };
}

function normalizeOrderItem(value: unknown): RelatedOrderItem {
  const obj = asRecord(value);

  return {
    id: getString(obj, ["id", "order_id"], "-"),
    number: getString(obj, ["order_number", "number", "code"], "-"),
    customer: getString(obj, ["customer_name", "customer", "client_name"], "-"),
    status: getString(obj, ["status"], "-"),
    total: getString(obj, ["total", "amount", "grand_total"], "-"),
    createdAt: getString(obj, ["created_at", "date"], ""),
    raw: obj,
  };
}

function normalizeProviderDetail(payload: unknown): ProviderDetail {
  const obj = unwrapProvider(payload) as Record<string, unknown>;

  const id = getObjectValue(obj, "id") ?? "";
  const name = getString(obj, ["name", "provider_name"], "-");
  const nameAr = getString(obj, ["name_ar", "arabic_name"], "");
  const nameEn = getString(obj, ["name_en", "english_name"], "");

  const documents = getArray(obj, ["documents", "files", "attachments"]).map(
    normalizeDocument,
  );

  return {
    id: id as number | string,
    name,
    nameAr,
    nameEn,
    displayNameAr: getString(obj, ["display_name_ar"], nameAr || name),
    displayNameEn: getString(obj, ["display_name_en"], nameEn || name),
    code: getString(obj, ["code", "provider_code"], id ? `PRV-${id}` : "-"),
    providerType: normalizeProviderType(
      getObjectValue(obj, "provider_type") ?? getObjectValue(obj, "type"),
    ),
    status: normalizeStatus(getObjectValue(obj, "status")),
    commercialRegistration: getString(obj, [
      "commercial_registration",
      "cr_number",
      "commercial_registration_number",
    ]),
    taxNumber: getString(obj, ["tax_number", "vat_number"]),
    logoUrl: getString(obj, ["logo_url"]),
    logoDriveFileId: getString(obj, ["logo_drive_file_id"]),
    imageUrl: getString(obj, ["image_url"]),
    imageDriveFileId: getString(obj, ["image_drive_file_id"]),
    driveFolderId: getString(obj, ["drive_folder_id"]),
    driveFolderUrl: getString(obj, ["drive_folder_url"]),
    contactPerson: getString(obj, ["contact_person"]),
    phone: getString(obj, ["phone"]),
    mobile: getString(obj, ["mobile"]),
    email: getString(obj, ["email"]),
    website: getString(obj, ["website"]),
    region: getString(obj, ["region"]),
    city: getString(obj, ["city"]),
    area: getString(obj, ["area"]),
    street: getString(obj, ["street"]),
    address: getString(obj, ["address"]),
    googleMapsLink: getString(obj, ["google_maps_link"]),
    sourceCategory: getString(obj, ["source_category"]),
    importSource: getString(obj, ["import_source"]),
    externalReference: getString(obj, ["external_reference"]),
    notes: getString(obj, ["notes"]),
    isFeatured: Boolean(
      getObjectValue(obj, "is_featured") ?? getObjectValue(obj, "featured"),
    ),
    ordersCount: getNumber(obj, ["orders_count", "order_count", "total_orders"]),
    documents,
    contracts: getArray(obj, ["contracts", "provider_contracts"]).map(
      normalizeContractItem,
    ),
    products: getArray(obj, [
      "products",
      "services",
      "items",
      "contract_products",
      "provider_products",
    ]).map(normalizeProductItem),
    orders: getArray(obj, ["orders", "provider_orders"]).map(normalizeOrderItem),
    createdAt: getString(obj, ["created_at"]),
    updatedAt: getString(obj, ["updated_at"]),
    raw: obj,
  };
}

function providerToFormData(provider: ProviderDetail): ProviderFormData {
  return {
    name: provider.name === "-" ? "" : provider.name,
    name_ar: provider.nameAr || provider.displayNameAr,
    name_en: provider.nameEn,
    code: provider.code === "-" ? "" : provider.code,
    provider_type: toEditableProviderType(provider.providerType),
    status: toEditableProviderStatus(provider.status),
    commercial_registration: provider.commercialRegistration,
    tax_number: provider.taxNumber,
    contact_person: provider.contactPerson,
    phone: provider.phone,
    mobile: provider.mobile,
    email: provider.email,
    website: provider.website,
    region: provider.region,
    city: provider.city,
    area: provider.area,
    street: provider.street,
    address: provider.address,
    google_maps_link: provider.googleMapsLink,
    source_category: provider.sourceCategory,
    external_reference: provider.externalReference,
    notes: provider.notes,
    is_featured: provider.isFeatured,
  };
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "").trim();
}

function normalizeCode(value: string) {
  return value.trim().replace(/\s+/g, "-").toUpperCase();
}

function normalizeIdentifier(value: string) {
  return value.trim().replace(/\s+/g, "");
}

function normalizeUrl(value: string) {
  return value.trim();
}

function isValidUrl(value: string) {
  if (!value.trim()) return true;

  return /^https?:\/\/.+/i.test(value.trim());
}

function isValidEmail(value: string) {
  if (!value.trim()) return true;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhone(value: string) {
  if (!value.trim()) return true;

  return /^\+?\d{6,18}$/.test(normalizePhone(value));
}

function normalizePayload(formData: ProviderFormData) {
  const nameAr = formData.name_ar.trim();
  const nameEn = formData.name_en.trim();
  const fallbackName = formData.name.trim() || nameAr || nameEn;

  return {
    name: fallbackName,
    name_ar: nameAr || fallbackName,
    name_en: nameEn,
    code: normalizeCode(formData.code),
    provider_type: formData.provider_type,
    status: formData.status,
    commercial_registration: normalizeIdentifier(formData.commercial_registration),
    tax_number: normalizeIdentifier(formData.tax_number),
    contact_person: formData.contact_person.trim(),
    phone: normalizePhone(formData.phone),
    mobile: normalizePhone(formData.mobile),
    email: formData.email.trim().toLowerCase(),
    website: normalizeUrl(formData.website),
    region: formData.region.trim(),
    city: formData.city.trim(),
    area: formData.area.trim(),
    street: formData.street.trim(),
    address: formData.address.trim(),
    google_maps_link: normalizeUrl(formData.google_maps_link),
    source_category: formData.source_category.trim(),
    external_reference: formData.external_reference.trim(),
    notes: formData.notes.trim(),
    is_featured: formData.is_featured,
  };
}

function normalizeApiErrors(errors: ProviderDetailResponse["errors"]) {
  if (!errors) return "";

  if (typeof errors === "string") return errors;

  if (Array.isArray(errors)) {
    return errors.filter(Boolean).join("، ");
  }

  return Object.entries(errors)
    .map(([key, value]) => {
      const message = Array.isArray(value) ? value.join("، ") : value;
      return `${key}: ${message}`;
    })
    .join("، ");
}

function mapApiFieldErrors(
  errors: ProviderDetailResponse["errors"],
): ProviderFormErrors {
  const nextErrors: ProviderFormErrors = {};

  if (!errors || typeof errors === "string" || Array.isArray(errors)) {
    return nextErrors;
  }

  Object.entries(errors).forEach(([key, value]) => {
    const message = Array.isArray(value) ? value[0] : value;

    if (!message) return;

    if ((PROVIDER_FORM_FIELDS as string[]).includes(key)) {
      nextErrors[key as keyof ProviderFormData] = String(message);
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
    title: isArabic ? "تفاصيل مقدم الخدمة" : "Provider Details",
    subtitle: isArabic
      ? "ملف كامل لمقدم الخدمة يشمل الهوية، البيانات النظامية، المرفقات، العقود، المنتجات، والطلبات."
      : "A complete provider profile with identity, legal data, documents, contracts, products, and orders.",

    back: isArabic ? "العودة لمقدمي الخدمة" : "Back to Providers",
    providersList: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",
    refresh: isArabic ? "تحديث" : "Refresh",
    print: isArabic ? "طباعة PDF" : "Print PDF",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    edit: isArabic ? "تعديل البيانات" : "Edit Details",
    save: isArabic ? "حفظ التعديلات" : "Save Changes",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    cancel: isArabic ? "إلغاء" : "Cancel",
    open: isArabic ? "فتح" : "Open",
    upload: isArabic ? "رفع ملف" : "Upload File",
    uploading: isArabic ? "جاري الرفع..." : "Uploading...",
    noDocuments: isArabic ? "لا توجد مرفقات بعد" : "No documents yet",
    uploadLogo: isArabic ? "رفع الشعار" : "Upload Logo",
    uploadImage: isArabic ? "رفع الصورة" : "Upload Image",
    uploadCr: isArabic ? "رفع السجل التجاري" : "Upload CR",
    uploadTax: isArabic ? "رفع الشهادة الضريبية" : "Upload Tax Certificate",
    uploadProduct: isArabic ? "رفع صورة منتج" : "Upload Product Image",
    uploadContract: isArabic ? "رفع ملف عقد" : "Upload Contract",
    uploadOther: isArabic ? "رفع مرفق آخر" : "Upload Other",
    uploadSuccess: isArabic ? "تم رفع الملف بنجاح." : "File uploaded successfully.",
    uploadError: isArabic ? "تعذر رفع الملف." : "Unable to upload file.",

    overview: isArabic ? "نظرة عامة" : "Overview",
    overviewDesc: isArabic
      ? "بيانات مقدم الخدمة الأساسية والحالة التشغيلية."
      : "Basic provider data and operational status.",

    identity: isArabic ? "الهوية والبيانات النظامية" : "Identity & Legal Data",
    identityDesc: isArabic
      ? "الاسم العربي والإنجليزي والسجل التجاري والرقم الضريبي."
      : "Arabic and English names, commercial registration, and tax number.",

    media: isArabic ? "الشعار والصورة" : "Logo & Image",
    mediaDesc: isArabic
      ? "الهوية البصرية ومجلد Google Drive الخاص بمقدم الخدمة."
      : "Visual identity and the provider Google Drive folder.",

    contact: isArabic ? "بيانات التواصل" : "Contact Information",
    contactDesc: isArabic
      ? "الهاتف والجوال والبريد ومسؤول التواصل."
      : "Phone, mobile, email, and contact person.",

    location: isArabic ? "الموقع والعنوان" : "Location & Address",
    locationDesc: isArabic
      ? "المنطقة والمدينة والحي والعنوان ورابط الخريطة."
      : "Region, city, area, address, and map link.",

    documents: isArabic ? "مرفقات مقدم الخدمة" : "Provider Documents",
    documentsDesc: isArabic
      ? "الملفات المرفوعة على Google Drive والمرتبطة بمقدم الخدمة."
      : "Files uploaded to Google Drive and linked to this provider.",

    contracts: isArabic ? "العقود والخصومات" : "Contracts & Discounts",
    contractsDesc: isArabic
      ? "العقود ونسب الخصم ونسبة النظام عند توفرها من الباكند."
      : "Contracts, discounts, and system commission when available from backend.",

    products: isArabic ? "المنتجات والخدمات" : "Products & Services",
    productsDesc: isArabic
      ? "المنتجات أو الخدمات المرتبطة بالعقود أو بمقدم الخدمة عند توفرها."
      : "Products or services linked to contracts or to this provider when available.",

    orders: isArabic ? "الطلبات" : "Orders",
    ordersDesc: isArabic
      ? "الطلبات المرتبطة بمقدم الخدمة عند توفرها."
      : "Orders linked to this provider when available.",

    operational: isArabic ? "بيانات تشغيلية" : "Operational Data",
    operationalDesc: isArabic
      ? "حالة التمييز والملاحظات التشغيلية."
      : "Featured status and operational notes.",

    notes: isArabic ? "الملاحظات" : "Notes",
    notesDesc: isArabic
      ? "ملاحظات تشغيلية مرتبطة بمقدم الخدمة."
      : "Operational notes related to this provider.",

    quickInfo: isArabic ? "معلومات سريعة" : "Quick Info",
    copy: isArabic ? "نسخ" : "Copy",
    copied: isArabic ? "تم النسخ بنجاح" : "Copied successfully",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض الصفحة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تفاصيل مقدمي الخدمة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view provider details. Contact your system administrator if you need access.",

    notFoundTitle: isArabic ? "مقدم الخدمة غير موجود" : "Provider not found",
    notFoundText: isArabic
      ? "لم يتم العثور على مقدم الخدمة المطلوب أو قد يكون غير متاح."
      : "The requested provider could not be found or may not be available.",

    loadError: isArabic
      ? "تعذر تحميل تفاصيل مقدم الخدمة."
      : "Unable to load provider details.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    refreshSuccess: isArabic
      ? "تم تحديث تفاصيل مقدم الخدمة بنجاح."
      : "Provider details refreshed successfully.",
    updateSuccess: isArabic
      ? "تم حفظ تعديلات مقدم الخدمة بنجاح."
      : "Provider updated successfully.",
    updateError: isArabic
      ? "تعذر حفظ تعديلات مقدم الخدمة."
      : "Unable to save provider changes.",
    validationToast: isArabic
      ? "يرجى تصحيح الحقول المطلوبة قبل الحفظ."
      : "Please fix the required fields before saving.",
    confirmCancel: isArabic
      ? "لديك تعديلات غير محفوظة. هل تريد إلغاء التعديل؟"
      : "You have unsaved changes. Cancel editing?",
    printReady: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

    fields: {
      id: isArabic ? "المعرف" : "ID",
      code: isArabic ? "الكود" : "Code",
      name: isArabic ? "الاسم العام" : "General Name",
      nameAr: isArabic ? "اسم مقدم الخدمة بالعربي" : "Arabic Name",
      nameEn: isArabic ? "اسم مقدم الخدمة بالإنجليزي" : "English Name",
      type: isArabic ? "التصنيف" : "Type",
      status: isArabic ? "الحالة" : "Status",
      commercialRegistration: isArabic ? "السجل التجاري" : "Commercial Registration",
      taxNumber: isArabic ? "الرقم الضريبي" : "Tax Number",
      logo: isArabic ? "الشعار" : "Logo",
      image: isArabic ? "الصورة" : "Image",
      driveFolder: isArabic ? "مجلد Google Drive" : "Google Drive Folder",
      contactPerson: isArabic ? "مسؤول التواصل" : "Contact Person",
      phone: isArabic ? "الهاتف" : "Phone",
      mobile: isArabic ? "الجوال" : "Mobile",
      email: isArabic ? "البريد الإلكتروني" : "Email",
      website: isArabic ? "الموقع الإلكتروني" : "Website",
      region: isArabic ? "المنطقة" : "Region",
      city: isArabic ? "المدينة" : "City",
      area: isArabic ? "الحي / المنطقة" : "Area",
      street: isArabic ? "الشارع" : "Street",
      address: isArabic ? "العنوان" : "Address",
      googleMapsLink: isArabic ? "رابط الخريطة" : "Map Link",
      sourceCategory: isArabic ? "التصنيف من المصدر" : "Source Category",
      externalReference: isArabic ? "المرجع الخارجي" : "External Reference",
      notes: isArabic ? "الملاحظات" : "Notes",
      featured: isArabic ? "مميز" : "Featured",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isArabic ? "آخر تحديث" : "Updated At",
      ordersCount: isArabic ? "عدد الطلبات" : "Orders Count",
      documentType: isArabic ? "نوع الملف" : "File Type",
      documentTitle: isArabic ? "عنوان الملف" : "File Title",
      documentSize: isArabic ? "الحجم" : "Size",
      documentDate: isArabic ? "تاريخ الرفع" : "Uploaded At",
      contract: isArabic ? "العقد" : "Contract",
      discount: isArabic ? "نسبة الخصم" : "Discount",
      systemCommission: isArabic ? "نسبة النظام" : "System Commission",
      product: isArabic ? "المنتج / الخدمة" : "Product / Service",
      priceBeforeDiscount: isArabic ? "السعر قبل الخصم" : "Before Discount",
      priceAfterDiscount: isArabic ? "السعر بعد الخصم" : "After Discount",
      order: isArabic ? "الطلب" : "Order",
      customer: isArabic ? "العميل" : "Customer",
      total: isArabic ? "الإجمالي" : "Total",
    },

    validation: {
      name: isArabic
        ? "يجب إدخال اسم عربي أو إنجليزي لمقدم الخدمة."
        : "Arabic or English provider name is required.",
      code: isArabic ? "كود مقدم الخدمة مطلوب." : "Provider code is required.",
      codeLength: isArabic
        ? "الكود يجب ألا يتجاوز 50 حرفًا."
        : "Code must not exceed 50 characters.",
      email: isArabic
        ? "صيغة البريد الإلكتروني غير صحيحة."
        : "Email format is invalid.",
      website: isArabic
        ? "رابط الموقع يجب أن يبدأ بـ http:// أو https://."
        : "Website URL must start with http:// or https://.",
      maps: isArabic
        ? "رابط الخريطة يجب أن يبدأ بـ http:// أو https://."
        : "Map link must start with http:// or https://.",
      phone: isArabic
        ? "رقم التواصل يجب أن يحتوي أرقامًا فقط مع السماح بعلامة +."
        : "Contact number must contain digits only, with optional +.",
      crLength: isArabic
        ? "السجل التجاري يجب ألا يتجاوز 100 حرف."
        : "Commercial registration must not exceed 100 characters.",
      taxLength: isArabic
        ? "الرقم الضريبي يجب ألا يتجاوز 100 حرف."
        : "Tax number must not exceed 100 characters.",
    },

    statuses: {
      ACTIVE: isArabic ? "نشط" : "Active",
      INACTIVE: isArabic ? "غير نشط" : "Inactive",
      SUSPENDED: isArabic ? "موقوف" : "Suspended",
      DRAFT: isArabic ? "مسودة" : "Draft",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<ProviderStatus, string>,

    editableStatuses: {
      ACTIVE: isArabic ? "نشط" : "Active",
      INACTIVE: isArabic ? "غير نشط" : "Inactive",
      SUSPENDED: isArabic ? "موقوف" : "Suspended",
      DRAFT: isArabic ? "مسودة" : "Draft",
    } satisfies Record<EditableProviderStatus, string>,

    typeLabels: {
      HOSPITAL: isArabic ? "مستشفى" : "Hospital",
      MEDICAL_CENTER: isArabic ? "مركز طبي" : "Medical Center",
      PHARMACY: isArabic ? "صيدلية" : "Pharmacy",
      PARTNER: isArabic ? "شريك" : "Partner",
      LAB: isArabic ? "مختبر" : "Lab",
      CLINIC: isArabic ? "عيادة" : "Clinic",
      OTHER: isArabic ? "أخرى" : "Other",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<ProviderType, string>,

    editableTypeLabels: {
      HOSPITAL: isArabic ? "مستشفى" : "Hospital",
      MEDICAL_CENTER: isArabic ? "مركز طبي" : "Medical Center",
      PHARMACY: isArabic ? "صيدلية" : "Pharmacy",
      PARTNER: isArabic ? "شريك" : "Partner",
      LAB: isArabic ? "مختبر" : "Lab",
      CLINIC: isArabic ? "عيادة" : "Clinic",
      OTHER: isArabic ? "أخرى" : "Other",
    } satisfies Record<EditableProviderType, string>,

    documentTypes: {
      logo: isArabic ? "شعار مقدم الخدمة" : "Provider Logo",
      image: isArabic ? "صورة مقدم الخدمة" : "Provider Image",
      product_image: isArabic ? "صورة منتج / خدمة" : "Product / Service Image",
      contract_file: isArabic ? "ملف عقد" : "Contract File",
      commercial_registration: isArabic ? "ملف السجل التجاري" : "CR File",
      tax_certificate: isArabic ? "الشهادة الضريبية" : "Tax Certificate",
      license: isArabic ? "ترخيص" : "License",
      other: isArabic ? "مرفق آخر" : "Other Document",
    } satisfies Record<ProviderDocumentType, string>,

    badges: {
      featured: isArabic ? "مميز" : "Featured",
      notFeatured: isArabic ? "غير مميز" : "Not Featured",
      hasContact: isArabic ? "بيانات تواصل متوفرة" : "Contact Available",
      noContact: isArabic ? "لا توجد بيانات تواصل" : "No Contact",
      hasLocation: isArabic ? "بيانات موقع متوفرة" : "Location Available",
      noLocation: isArabic ? "لا توجد بيانات موقع" : "No Location",
      hasLegal: isArabic ? "بيانات نظامية متوفرة" : "Legal Data Available",
      noLegal: isArabic ? "بيانات نظامية غير مكتملة" : "Legal Data Missing",
      hasDrive: isArabic ? "مجلد Drive متوفر" : "Drive Folder Available",
      noDrive: isArabic ? "لا يوجد مجلد Drive" : "No Drive Folder",
    },

    empty: isArabic ? "لا توجد بيانات" : "No data",
    noContracts: isArabic ? "لا توجد عقود مرتبطة في الاستجابة الحالية." : "No linked contracts in the current response.",
    noProducts: isArabic ? "لا توجد منتجات أو خدمات مرتبطة في الاستجابة الحالية." : "No linked products or services in the current response.",
    noOrders: isArabic ? "لا توجد طلبات مرتبطة في الاستجابة الحالية." : "No linked orders in the current response.",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
  };
}

/* ============================================================
   UI Helpers
============================================================ */

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

function formatNumber(value: number | string): string {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return String(value || "-");

  return new Intl.NumberFormat("en-US").format(numberValue);
}

function formatFileSize(sizeBytes: number) {
  if (!sizeBytes) return "-";

  if (sizeBytes < 1024) return `${formatNumber(sizeBytes)} B`;

  const kb = sizeBytes / 1024;
  if (kb < 1024) return `${formatNumber(kb.toFixed(1))} KB`;

  const mb = kb / 1024;
  return `${formatNumber(mb.toFixed(1))} MB`;
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

function statusLabel(status: ProviderStatus, locale: AppLocale) {
  return dictionary(locale).statuses[status];
}

function typeLabel(type: ProviderType, locale: AppLocale) {
  return dictionary(locale).typeLabels[type];
}

function documentTypeLabel(type: string, locale: AppLocale) {
  const labels = dictionary(locale).documentTypes;
  return labels[type as ProviderDocumentType] || labels.other;
}

function providerIcon(type: ProviderType): ComponentType<{ className?: string }> {
  if (type === "HOSPITAL") return Hospital;
  if (type === "MEDICAL_CENTER") return Stethoscope;
  if (type === "PHARMACY") return ShieldCheck;
  if (type === "LAB") return Layers3;
  if (type === "CLINIC") return Stethoscope;

  return Building2;
}

function statusBadge(status: ProviderStatus, locale: AppLocale) {
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

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="space-y-4 p-5">
          <SkeletonLine className="h-24 w-full rounded-2xl" />
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

function copyToClipboard(value: string, successMessage: string) {
  if (!value || value === "-") return;

  navigator.clipboard.writeText(value);
  toast.success(successMessage);
}

function CurrencyValue({ value }: { value: string | number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{value || "-"}</span>
      {value && value !== "-" ? (
        <img
          src="/currency/sar.svg"
          alt="SAR"
          className="h-3.5 w-3.5 object-contain"
        />
      ) : null}
    </span>
  );
}

function InfoRow({
  label,
  value,
  copyable,
  copiedMessage,
  link,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  copiedMessage: string;
  link?: string;
}) {
  return (
    <TableRow>
      <TableCell className="w-[230px] text-muted-foreground">{label}</TableCell>
      <TableCell>
        <div className="flex items-center justify-between gap-3">
          {link && value ? (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-w-0 items-center gap-2 break-all font-medium text-primary hover:underline"
            >
              <span>{value || "-"}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          ) : (
            <span className="break-words font-medium">{value || "-"}</span>
          )}

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

function EditableInfoRow({
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
    <TableRow>
      <TableCell className="w-[230px] text-muted-foreground">
        <Label className="text-sm font-normal text-muted-foreground">
          {label}
          {required ? <span className="ms-1 text-destructive">*</span> : null}
        </Label>
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          {children}
          {error ? (
            <p className="text-xs font-medium text-destructive">{error}</p>
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

function EditableTextSection({
  label,
  value,
  error,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <Label className="text-sm font-semibold">{label}</Label>
      <Textarea
        value={value}
        disabled={disabled}
        className="mt-2 min-h-28 rounded-xl"
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <p className="mt-2 text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

function UploadButton({
  label,
  fileType,
  disabled,
  isUploading,
  inputRef,
  onChange,
}: {
  label: string;
  fileType: UploadFileType;
  disabled?: boolean;
  isUploading?: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (fileType: UploadFileType, file: File) => void;
}) {
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={
          fileType === "logo" || fileType === "image" || fileType === "product_image"
            ? "image/png,image/jpeg,image/webp"
            : ".pdf,.doc,.docx,.xls,.xlsx,image/png,image/jpeg,image/webp"
        }
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";

          if (!file) return;

          onChange(fileType, file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="rounded-xl"
        disabled={disabled || isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? (
          <Loader2 className="me-2 h-4 w-4 animate-spin" />
        ) : (
          <UploadCloud className="me-2 h-4 w-4" />
        )}
        {label}
      </Button>
    </>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-background p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

/* ============================================================
   Print
============================================================ */

function buildPrintHtml({
  provider,
  locale,
}: {
  provider: ProviderDetail;
  locale: AppLocale;
}) {
  const t = dictionary(locale);
  const isArabic = locale === "ar";
  const now = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  const rows: Array<[string, string]> = [
    [t.fields.id, String(provider.id || "-")],
    [t.fields.code, provider.code],
    [t.fields.nameAr, provider.nameAr || provider.displayNameAr],
    [t.fields.nameEn, provider.nameEn || provider.displayNameEn],
    [t.fields.type, typeLabel(provider.providerType, locale)],
    [t.fields.status, statusLabel(provider.status, locale)],
    [t.fields.commercialRegistration, provider.commercialRegistration],
    [t.fields.taxNumber, provider.taxNumber],
    [t.fields.contactPerson, provider.contactPerson],
    [t.fields.phone, provider.phone],
    [t.fields.mobile, provider.mobile],
    [t.fields.email, provider.email],
    [t.fields.website, provider.website],
    [t.fields.region, provider.region],
    [t.fields.city, provider.city],
    [t.fields.area, provider.area],
    [t.fields.street, provider.street],
    [t.fields.address, provider.address],
    [t.fields.sourceCategory, provider.sourceCategory],
    [t.fields.externalReference, provider.externalReference],
    [t.fields.ordersCount, String(provider.ordersCount || 0)],
    [t.fields.driveFolder, provider.driveFolderUrl || provider.driveFolderId],
    [t.fields.createdAt, formatDate(provider.createdAt)],
    [t.fields.updatedAt, formatDate(provider.updatedAt)],
  ];

  const documentsRows = provider.documents
    .map(
      (document) => `
        <tr>
          <td>${escapeHtml(documentTypeLabel(document.fileType, locale))}</td>
          <td>${escapeHtml(document.title || document.originalFilename || "-")}</td>
          <td>${escapeHtml(formatFileSize(document.sizeBytes))}</td>
          <td>${escapeHtml(formatDate(document.createdAt))}</td>
        </tr>
      `,
    )
    .join("");

  const contractsRows = provider.contracts
    .map(
      (contract) => `
        <tr>
          <td>${escapeHtml(contract.title)}</td>
          <td>${escapeHtml(contract.status)}</td>
          <td>${escapeHtml(contract.discount)}</td>
          <td>${escapeHtml(contract.systemCommission)}</td>
          <td>${escapeHtml(formatDate(contract.startDate))}</td>
          <td>${escapeHtml(formatDate(contract.endDate))}</td>
        </tr>
      `,
    )
    .join("");

  const productsRows = provider.products
    .map(
      (product) => `
        <tr>
          <td>${escapeHtml(product.title)}</td>
          <td>${escapeHtml(product.type)}</td>
          <td>${escapeHtml(product.priceBeforeDiscount)}</td>
          <td>${escapeHtml(product.discount)}</td>
          <td>${escapeHtml(product.priceAfterDiscount)}</td>
          <td>${escapeHtml(product.ordersCount)}</td>
        </tr>
      `,
    )
    .join("");

  const ordersRows = provider.orders
    .map(
      (order) => `
        <tr>
          <td>${escapeHtml(order.number || order.id)}</td>
          <td>${escapeHtml(order.customer)}</td>
          <td>${escapeHtml(order.status)}</td>
          <td>${escapeHtml(order.total)}</td>
          <td>${escapeHtml(formatDate(order.createdAt))}</td>
        </tr>
      `,
    )
    .join("");

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
            padding: 28px;
            color: #111827;
            background: #ffffff;
            font-family: ${
              isArabic
                ? "'Tahoma', 'Arial', sans-serif"
                : "'Inter', 'Arial', sans-serif"
            };
          }
          .header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
            padding-bottom: 18px;
            border-bottom: 2px solid #e5e7eb;
            margin-bottom: 18px;
          }
          .identity {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .logo {
            width: 74px;
            height: 74px;
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            object-fit: contain;
            padding: 8px;
          }
          h1 { margin: 0; font-size: 24px; }
          .muted { color: #6b7280; font-size: 12px; margin-top: 6px; }
          .badge {
            border: 1px solid #d1d5db;
            border-radius: 999px;
            padding: 8px 14px;
            font-size: 12px;
            color: #374151;
          }
          .section-title {
            margin: 22px 0 10px;
            font-weight: 700;
            font-size: 15px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            page-break-inside: avoid;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 9px 10px;
            vertical-align: top;
            font-size: 12px;
            text-align: ${isArabic ? "right" : "left"};
          }
          th {
            width: 28%;
            background: #f9fafb;
            color: #374151;
            font-weight: 700;
          }
          .text-block {
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 12px;
            min-height: 58px;
            color: #374151;
            white-space: pre-wrap;
            font-size: 12px;
            line-height: 1.8;
          }
          @media print {
            body { padding: 18px; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="identity">
            ${
              provider.logoUrl
                ? `<img class="logo" src="${escapeHtml(provider.logoUrl)}" alt="logo" />`
                : ""
            }
            <div>
              <h1>${escapeHtml(provider.nameAr || provider.name || "-")}</h1>
              <div class="muted">${escapeHtml(provider.nameEn || provider.code || "-")}</div>
              <div class="muted">${escapeHtml(t.fields.code)}: ${escapeHtml(provider.code)}</div>
              <div class="muted">${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <div class="section-title">${escapeHtml(t.identity)}</div>
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

        <div class="section-title">${escapeHtml(t.documents)}</div>
        ${
          documentsRows
            ? `<table>
                <thead>
                  <tr>
                    <th>${escapeHtml(t.fields.documentType)}</th>
                    <th>${escapeHtml(t.fields.documentTitle)}</th>
                    <th>${escapeHtml(t.fields.documentSize)}</th>
                    <th>${escapeHtml(t.fields.documentDate)}</th>
                  </tr>
                </thead>
                <tbody>${documentsRows}</tbody>
              </table>`
            : `<div class="text-block">${escapeHtml(t.noDocuments)}</div>`
        }

        <div class="section-title">${escapeHtml(t.contracts)}</div>
        ${
          contractsRows
            ? `<table>
                <thead>
                  <tr>
                    <th>${escapeHtml(t.fields.contract)}</th>
                    <th>${escapeHtml(t.fields.status)}</th>
                    <th>${escapeHtml(t.fields.discount)}</th>
                    <th>${escapeHtml(t.fields.systemCommission)}</th>
                    <th>${escapeHtml(t.fields.createdAt)}</th>
                    <th>${escapeHtml(t.fields.updatedAt)}</th>
                  </tr>
                </thead>
                <tbody>${contractsRows}</tbody>
              </table>`
            : `<div class="text-block">${escapeHtml(t.noContracts)}</div>`
        }

        <div class="section-title">${escapeHtml(t.products)}</div>
        ${
          productsRows
            ? `<table>
                <thead>
                  <tr>
                    <th>${escapeHtml(t.fields.product)}</th>
                    <th>${escapeHtml(t.fields.type)}</th>
                    <th>${escapeHtml(t.fields.priceBeforeDiscount)}</th>
                    <th>${escapeHtml(t.fields.discount)}</th>
                    <th>${escapeHtml(t.fields.priceAfterDiscount)}</th>
                    <th>${escapeHtml(t.fields.ordersCount)}</th>
                  </tr>
                </thead>
                <tbody>${productsRows}</tbody>
              </table>`
            : `<div class="text-block">${escapeHtml(t.noProducts)}</div>`
        }

        <div class="section-title">${escapeHtml(t.orders)}</div>
        ${
          ordersRows
            ? `<table>
                <thead>
                  <tr>
                    <th>${escapeHtml(t.fields.order)}</th>
                    <th>${escapeHtml(t.fields.customer)}</th>
                    <th>${escapeHtml(t.fields.status)}</th>
                    <th>${escapeHtml(t.fields.total)}</th>
                    <th>${escapeHtml(t.fields.createdAt)}</th>
                  </tr>
                </thead>
                <tbody>${ordersRows}</tbody>
              </table>`
            : `<div class="text-block">${escapeHtml(t.noOrders)}</div>`
        }

        <div class="section-title">${escapeHtml(t.fields.notes)}</div>
        <div class="text-block">${escapeHtml(provider.notes || "-")}</div>

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

export default function SystemProviderDetailsPage() {
  const params = useParams();
  const auth = useAuth() as unknown;

  const providerId = String(params?.id || "");

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [provider, setProvider] = useState<ProviderDetail | null>(null);
  const [formData, setFormData] = useState<ProviderFormData | null>(null);
  const [formSnapshot, setFormSnapshot] = useState("");
  const [formErrors, setFormErrors] = useState<ProviderFormErrors>({});
  const [submitError, setSubmitError] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingType, setIsUploadingType] = useState<UploadFileType | "">("");
  const [errorMessage, setErrorMessage] = useState("");
  const [notFound, setNotFound] = useState(false);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const crInputRef = useRef<HTMLInputElement | null>(null);
  const taxInputRef = useRef<HTMLInputElement | null>(null);
  const productInputRef = useRef<HTMLInputElement | null>(null);
  const contractInputRef = useRef<HTMLInputElement | null>(null);
  const otherInputRef = useRef<HTMLInputElement | null>(null);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const authResolving = isAuthResolving(auth);

  const canViewProviders = hasSafePermission(
    auth,
    ["providers.view", "providers.detail", "providers.list"],
    "view",
  );

  const canViewProvidersList = hasSafePermission(
    auth,
    ["providers.view", "providers.list"],
    "view",
  );

  const canEditProviders = hasSafePermission(
    auth,
    ["providers.edit", "providers.update"],
    "action",
  );

  const canUploadProviderFiles = hasSafePermission(
    auth,
    ["providers.upload", "providers.files.upload", "providers.edit", "providers.update"],
    "action",
  );

  const canPrintProviders = hasSafePermission(
    auth,
    ["providers.print", "reports.print"],
    "action",
  );

  const ProviderIcon = provider ? providerIcon(provider.providerType) : Building2;

  const isDirty = useMemo(() => {
    if (!formData) return false;
    return JSON.stringify(formData) !== formSnapshot;
  }, [formData, formSnapshot]);

  const loadProvider = useCallback(
    async (showToast = false) => {
      if (!canViewProviders) {
        setIsLoading(false);
        setProvider(null);
        return;
      }

      if (!isValidId(providerId)) {
        setIsLoading(false);
        setProvider(null);
        setNotFound(true);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        setSubmitError("");
        setNotFound(false);

        const response = await fetch(
          apiUrl(`/api/providers/${encodeURIComponent(providerId)}/`),
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const payload = (await response.json().catch(() => null)) as
          | ProviderDetailResponse
          | null;

        if (response.status === 404) {
          setProvider(null);
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

        const normalized = normalizeProviderDetail(payload);

        if (!isValidId(normalized.id)) {
          setProvider(null);
          setNotFound(true);
          return;
        }

        const nextFormData = providerToFormData(normalized);

        setProvider(normalized);
        setFormData(nextFormData);
        setFormSnapshot(JSON.stringify(nextFormData));
        setFormErrors({});

        if (showToast) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Failed to load provider details:", error);
        setProvider(null);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canViewProviders, providerId, t.loadError, t.refreshSuccess],
  );

  function updateField<K extends keyof ProviderFormData>(
    key: K,
    value: ProviderFormData[K],
  ) {
    setFormData((current) => {
      if (!current) return current;

      return {
        ...current,
        [key]: value,
      };
    });

    setFormErrors((current) => ({
      ...current,
      [key]: undefined,
    }));

    if (submitError) {
      setSubmitError("");
    }
  }

  function validateForm() {
    if (!formData) return false;

    const nextErrors: ProviderFormErrors = {};

    if (!formData.name.trim() && !formData.name_ar.trim() && !formData.name_en.trim()) {
      nextErrors.name_ar = t.validation.name;
    }

    if (!formData.code.trim()) {
      nextErrors.code = t.validation.code;
    }

    if (formData.code.trim().length > 50) {
      nextErrors.code = t.validation.codeLength;
    }

    if (formData.commercial_registration.trim().length > 100) {
      nextErrors.commercial_registration = t.validation.crLength;
    }

    if (formData.tax_number.trim().length > 100) {
      nextErrors.tax_number = t.validation.taxLength;
    }

    if (!isValidEmail(formData.email)) {
      nextErrors.email = t.validation.email;
    }

    if (!isValidUrl(formData.website)) {
      nextErrors.website = t.validation.website;
    }

    if (!isValidUrl(formData.google_maps_link)) {
      nextErrors.google_maps_link = t.validation.maps;
    }

    if (!isValidPhone(formData.phone)) {
      nextErrors.phone = t.validation.phone;
    }

    if (!isValidPhone(formData.mobile)) {
      nextErrors.mobile = t.validation.phone;
    }

    setFormErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  function startEdit() {
    if (!provider) return;

    const nextFormData = providerToFormData(provider);

    setFormData(nextFormData);
    setFormSnapshot(JSON.stringify(nextFormData));
    setFormErrors({});
    setSubmitError("");
    setIsEditing(true);
  }

  function cancelEdit() {
    if (isDirty && !window.confirm(t.confirmCancel)) return;

    if (provider) {
      const nextFormData = providerToFormData(provider);
      setFormData(nextFormData);
      setFormSnapshot(JSON.stringify(nextFormData));
    }

    setFormErrors({});
    setSubmitError("");
    setIsEditing(false);
  }

  async function saveChanges() {
    if (!providerId || !formData || !canEditProviders || isSaving) return;

    setSubmitError("");

    if (!validateForm()) {
      toast.error(t.validationToast);
      return;
    }

    try {
      setIsSaving(true);

      const csrfToken = readCookie("csrftoken");

      const response = await fetch(
        apiUrl(`/api/providers/${encodeURIComponent(providerId)}/`),
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
          },
          body: JSON.stringify(normalizePayload(formData)),
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | ProviderDetailResponse
        | null;

      if (!response.ok || payload?.ok === false) {
        const apiErrors = mapApiFieldErrors(payload?.errors);
        const message =
          normalizeApiErrors(payload?.errors) ||
          payload?.message ||
          payload?.detail ||
          payload?.error ||
          t.updateError;

        setFormErrors((current) => ({
          ...current,
          ...apiErrors,
        }));
        setSubmitError(message);
        toast.error(t.updateError, {
          description: message,
        });
        return;
      }

      const normalized = normalizeProviderDetail(payload);
      const nextFormData = providerToFormData(normalized);

      setProvider(normalized);
      setFormData(nextFormData);
      setFormSnapshot(JSON.stringify(nextFormData));
      setFormErrors({});
      setIsEditing(false);
      toast.success(t.updateSuccess);
    } catch (error) {
      console.error("Failed to update provider:", error);
      setSubmitError(t.updateError);
      toast.error(t.updateError);
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadProviderFile(fileType: UploadFileType, file: File) {
    if (!providerId || !canUploadProviderFiles || isUploadingType) return;

    try {
      setIsUploadingType(fileType);

      const csrfToken = readCookie("csrftoken");
      const data = new FormData();

      data.append("file", file);
      data.append("file_type", fileType);
      data.append("title", file.name);
      data.append(
        "is_primary",
        fileType === "logo" || fileType === "image" ? "true" : "false",
      );

      const response = await fetch(
        apiUrl(`/api/providers/${encodeURIComponent(providerId)}/upload/`),
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
          },
          body: data,
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | ProviderDetailResponse
        | null;

      if (!response.ok || payload?.ok === false) {
        const message =
          normalizeApiErrors(payload?.errors) ||
          payload?.message ||
          payload?.detail ||
          payload?.error ||
          t.uploadError;

        toast.error(t.uploadError, {
          description: message,
        });
        return;
      }

      const wrapper = asRecord(payload);
      const dataObj = asRecord(wrapper.data);
      const normalized = normalizeProviderDetail(
        dataObj.provider || wrapper.data || payload,
      );
      const nextFormData = providerToFormData(normalized);

      setProvider(normalized);
      setFormData(nextFormData);
      setFormSnapshot(JSON.stringify(nextFormData));
      toast.success(t.uploadSuccess);
    } catch (error) {
      console.error("Failed to upload provider file:", error);
      toast.error(t.uploadError);
    } finally {
      setIsUploadingType("");
    }
  }

  function printProvider() {
    if (!provider || !canPrintProviders) return;

    try {
      const printWindow = window.open("", "_blank", "width=980,height=760");

      if (!printWindow) {
        toast.error(t.printError);
        return;
      }

      printWindow.document.open();
      printWindow.document.write(buildPrintHtml({ provider, locale }));
      printWindow.document.close();
      toast.success(t.printReady);
    } catch (error) {
      console.error("Print provider error:", error);
      toast.error(t.printError);
    }
  }

  useEffect(() => {
    const nextLocale = readLocale();
    setLocale(nextLocale);
    applyDocumentLocale(nextLocale);
  }, []);

  useEffect(() => {
    if (authResolving) return;
    loadProvider(false);
  }, [authResolving, loadProvider]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty || !isEditing) return;

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);

    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, isEditing]);

  if (!authResolving && !canViewProviders) {
    return (
      <div className="w-full space-y-4">
        <Card className="rounded-2xl border-destructive/30">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <XCircle className="h-10 w-10 text-destructive" />
            <div>
              <h2 className="text-lg font-bold">{t.accessDeniedTitle}</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {t.accessDeniedText}
              </p>
            </div>
            {canViewProvidersList ? (
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/system/providers">
                  <ArrowLeft className="me-2 h-4 w-4" />
                  {t.back}
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || authResolving) {
    return (
      <div className="w-full space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SkeletonLine className="h-10 w-52" />
          <SkeletonLine className="h-10 w-72" />
        </div>
        <DetailSkeleton />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="w-full space-y-4">
        <Card className="rounded-2xl border-destructive/30">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <XCircle className="h-10 w-10 text-destructive" />
            <div>
              <h2 className="text-lg font-bold">{errorMessage}</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {t.loadErrorHint}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => loadProvider(true)}
              >
                <RefreshCcw className="me-2 h-4 w-4" />
                {t.retry}
              </Button>
              {canViewProvidersList ? (
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href="/system/providers/list">
                    <ArrowLeft className="me-2 h-4 w-4" />
                    {t.providersList}
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (notFound || !provider || !formData) {
    return (
      <div className="w-full space-y-4">
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-bold">{t.notFoundTitle}</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {t.notFoundText}
              </p>
            </div>
            {canViewProvidersList ? (
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/system/providers/list">
                  <ArrowLeft className="me-2 h-4 w-4" />
                  {t.providersList}
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasContact = Boolean(provider.phone || provider.mobile || provider.email);
  const hasLocation = Boolean(provider.region || provider.city || provider.area || provider.address);
  const hasLegal = Boolean(provider.commercialRegistration || provider.taxNumber);
  const hasDrive = Boolean(provider.driveFolderId || provider.driveFolderUrl);

  return (
    <div className="w-full space-y-4" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {canViewProvidersList ? (
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/system/providers">
                  <ArrowLeft className="me-2 h-4 w-4" />
                  {t.back}
                </Link>
              </Button>
            ) : null}
            {statusBadge(provider.status, locale)}
            {provider.isFeatured ? (
              <Badge className="rounded-full border-violet-200 bg-violet-50 px-3 py-1 text-violet-700 hover:bg-violet-50 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300">
                <Sparkles className="me-1 h-3.5 w-3.5" />
                {t.badges.featured}
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {t.badges.notFeatured}
              </Badge>
            )}
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => loadProvider(true)}
          >
            <RefreshCcw className="me-2 h-4 w-4" />
            {t.refresh}
          </Button>

          {canPrintProviders ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={printProvider}
            >
              <Printer className="me-2 h-4 w-4" />
              {t.print}
            </Button>
          ) : null}

          {canEditProviders && !isEditing ? (
            <Button type="button" className="rounded-xl" onClick={startEdit}>
              <Edit3 className="me-2 h-4 w-4" />
              {t.edit}
            </Button>
          ) : null}

          {canEditProviders && isEditing ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={isSaving}
                onClick={cancelEdit}
              >
                <X className="me-2 h-4 w-4" />
                {t.cancel}
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                disabled={isSaving || !isDirty}
                onClick={saveChanges}
              >
                {isSaving ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="me-2 h-4 w-4" />
                )}
                {isSaving ? t.saving : t.save}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {submitError ? (
        <Card className="rounded-2xl border-destructive/30">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-destructive">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{submitError}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="relative h-32 bg-muted">
              {provider.imageUrl ? (
                <img
                  src={provider.imageUrl}
                  alt={provider.displayNameAr || provider.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-9 w-9" />
                </div>
              )}

              <div className="absolute -bottom-8 start-5 flex h-20 w-20 items-center justify-center rounded-2xl border bg-background p-2 shadow-sm">
                {provider.logoUrl ? (
                  <img
                    src={provider.logoUrl}
                    alt={provider.displayNameAr || provider.name}
                    className="h-full w-full rounded-xl object-contain"
                  />
                ) : (
                  <ProviderIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
            </div>

            <CardContent className="space-y-4 p-5 pt-12">
              <div>
                <h2 className="break-words text-xl font-bold">
                  {provider.nameAr || provider.displayNameAr || provider.name}
                </h2>
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {provider.nameEn || provider.displayNameEn || provider.code}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full">
                  {typeLabel(provider.providerType, locale)}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {provider.code}
                </Badge>
              </div>

              <div className="grid gap-2">
                <QuickInfoItem
                  icon={ClipboardList}
                  label={t.fields.commercialRegistration}
                  value={provider.commercialRegistration || "-"}
                />
                <QuickInfoItem
                  icon={ShieldCheck}
                  label={t.fields.taxNumber}
                  value={provider.taxNumber || "-"}
                />
                <QuickInfoItem
                  icon={Phone}
                  label={t.fields.mobile}
                  value={provider.mobile || provider.phone || "-"}
                />
                <QuickInfoItem
                  icon={MapPin}
                  label={t.fields.city}
                  value={[provider.region, provider.city, provider.area]
                    .filter(Boolean)
                    .join(" / ")}
                />
                <QuickInfoItem
                  icon={PackageCheck}
                  label={t.fields.ordersCount}
                  value={formatNumber(provider.ordersCount)}
                />
                <QuickInfoItem
                  icon={CalendarDays}
                  label={t.fields.createdAt}
                  value={formatDate(provider.createdAt)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{t.quickInfo}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant={hasContact ? "secondary" : "outline"} className="rounded-full">
                {hasContact ? t.badges.hasContact : t.badges.noContact}
              </Badge>
              <Badge variant={hasLocation ? "secondary" : "outline"} className="rounded-full">
                {hasLocation ? t.badges.hasLocation : t.badges.noLocation}
              </Badge>
              <Badge variant={hasLegal ? "secondary" : "outline"} className="rounded-full">
                {hasLegal ? t.badges.hasLegal : t.badges.noLegal}
              </Badge>
              <Badge variant={hasDrive ? "secondary" : "outline"} className="rounded-full">
                {hasDrive ? t.badges.hasDrive : t.badges.noDrive}
              </Badge>
            </CardContent>
          </Card>

          {canUploadProviderFiles ? (
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">{t.upload}</CardTitle>
                <CardDescription>{t.documentsDesc}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                <UploadButton
                  label={t.uploadLogo}
                  fileType="logo"
                  inputRef={logoInputRef}
                  isUploading={isUploadingType === "logo"}
                  disabled={Boolean(isUploadingType)}
                  onChange={uploadProviderFile}
                />
                <UploadButton
                  label={t.uploadImage}
                  fileType="image"
                  inputRef={imageInputRef}
                  isUploading={isUploadingType === "image"}
                  disabled={Boolean(isUploadingType)}
                  onChange={uploadProviderFile}
                />
                <UploadButton
                  label={t.uploadCr}
                  fileType="commercial_registration"
                  inputRef={crInputRef}
                  isUploading={isUploadingType === "commercial_registration"}
                  disabled={Boolean(isUploadingType)}
                  onChange={uploadProviderFile}
                />
                <UploadButton
                  label={t.uploadTax}
                  fileType="tax_certificate"
                  inputRef={taxInputRef}
                  isUploading={isUploadingType === "tax_certificate"}
                  disabled={Boolean(isUploadingType)}
                  onChange={uploadProviderFile}
                />
                <UploadButton
                  label={t.uploadProduct}
                  fileType="product_image"
                  inputRef={productInputRef}
                  isUploading={isUploadingType === "product_image"}
                  disabled={Boolean(isUploadingType)}
                  onChange={uploadProviderFile}
                />
                <UploadButton
                  label={t.uploadContract}
                  fileType="contract_file"
                  inputRef={contractInputRef}
                  isUploading={isUploadingType === "contract_file"}
                  disabled={Boolean(isUploadingType)}
                  onChange={uploadProviderFile}
                />
                <UploadButton
                  label={t.uploadOther}
                  fileType="other"
                  inputRef={otherInputRef}
                  isUploading={isUploadingType === "other"}
                  disabled={Boolean(isUploadingType)}
                  onChange={uploadProviderFile}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              icon={ClipboardList}
              label={t.fields.ordersCount}
              value={formatNumber(provider.ordersCount)}
            />
            <MetricCard
              icon={FileText}
              label={t.documents}
              value={formatNumber(provider.documents.length)}
            />
            <MetricCard
              icon={Layers3}
              label={t.contracts}
              value={formatNumber(provider.contracts.length)}
            />
            <MetricCard
              icon={PackageCheck}
              label={t.products}
              value={formatNumber(provider.products.length)}
            />
          </div>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{t.identity}</CardTitle>
              <CardDescription>{t.identityDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {isEditing ? (
                    <>
                      <EditableInfoRow
                        label={t.fields.nameAr}
                        error={formErrors.name_ar}
                        required
                      >
                        <Input
                          value={formData.name_ar}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) => updateField("name_ar", event.target.value)}
                        />
                      </EditableInfoRow>
                      <EditableInfoRow label={t.fields.nameEn} error={formErrors.name_en}>
                        <Input
                          value={formData.name_en}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) => updateField("name_en", event.target.value)}
                        />
                      </EditableInfoRow>
                      <EditableInfoRow label={t.fields.name} error={formErrors.name}>
                        <Input
                          value={formData.name}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) => updateField("name", event.target.value)}
                        />
                      </EditableInfoRow>
                      <EditableInfoRow
                        label={t.fields.code}
                        error={formErrors.code}
                        required
                      >
                        <Input
                          value={formData.code}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) => updateField("code", event.target.value)}
                        />
                      </EditableInfoRow>
                      <EditableInfoRow label={t.fields.type}>
                        <select
                          value={formData.provider_type}
                          disabled={isSaving}
                          className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                          onChange={(event) =>
                            updateField(
                              "provider_type",
                              event.target.value as EditableProviderType,
                            )
                          }
                        >
                          {Object.entries(t.editableTypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </EditableInfoRow>
                      <EditableInfoRow label={t.fields.status}>
                        <select
                          value={formData.status}
                          disabled={isSaving}
                          className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                          onChange={(event) =>
                            updateField(
                              "status",
                              event.target.value as EditableProviderStatus,
                            )
                          }
                        >
                          {Object.entries(t.editableStatuses).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </EditableInfoRow>
                      <EditableInfoRow
                        label={t.fields.commercialRegistration}
                        error={formErrors.commercial_registration}
                      >
                        <Input
                          value={formData.commercial_registration}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) =>
                            updateField("commercial_registration", event.target.value)
                          }
                        />
                      </EditableInfoRow>
                      <EditableInfoRow
                        label={t.fields.taxNumber}
                        error={formErrors.tax_number}
                      >
                        <Input
                          value={formData.tax_number}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) => updateField("tax_number", event.target.value)}
                        />
                      </EditableInfoRow>
                      <EditableInfoRow label={t.fields.featured}>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={formData.is_featured}
                            disabled={isSaving}
                            onCheckedChange={(checked) =>
                              updateField("is_featured", Boolean(checked))
                            }
                          />
                          <span className="text-sm text-muted-foreground">
                            {t.badges.featured}
                          </span>
                        </div>
                      </EditableInfoRow>
                    </>
                  ) : (
                    <>
                      <InfoRow
                        label={t.fields.nameAr}
                        value={provider.nameAr || provider.displayNameAr}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.nameEn}
                        value={provider.nameEn || provider.displayNameEn}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.name}
                        value={provider.name}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.code}
                        value={provider.code}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.type}
                        value={typeLabel(provider.providerType, locale)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.status}
                        value={statusLabel(provider.status, locale)}
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.commercialRegistration}
                        value={provider.commercialRegistration}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.taxNumber}
                        value={provider.taxNumber}
                        copyable
                        copiedMessage={t.copied}
                      />
                    </>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{t.media}</CardTitle>
              <CardDescription>{t.mediaDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <InfoRow
                    label={t.fields.logo}
                    value={provider.logoUrl || "-"}
                    link={provider.logoUrl}
                    copyable
                    copiedMessage={t.copied}
                  />
                  <InfoRow
                    label={t.fields.image}
                    value={provider.imageUrl || "-"}
                    link={provider.imageUrl}
                    copyable
                    copiedMessage={t.copied}
                  />
                  <InfoRow
                    label={t.fields.driveFolder}
                    value={provider.driveFolderUrl || provider.driveFolderId || "-"}
                    link={provider.driveFolderUrl}
                    copyable
                    copiedMessage={t.copied}
                  />
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{t.contact}</CardTitle>
              <CardDescription>{t.contactDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {isEditing ? (
                    <>
                      <EditableInfoRow
                        label={t.fields.contactPerson}
                        error={formErrors.contact_person}
                      >
                        <Input
                          value={formData.contact_person}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) =>
                            updateField("contact_person", event.target.value)
                          }
                        />
                      </EditableInfoRow>
                      <EditableInfoRow label={t.fields.phone} error={formErrors.phone}>
                        <Input
                          value={formData.phone}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) => updateField("phone", event.target.value)}
                        />
                      </EditableInfoRow>
                      <EditableInfoRow label={t.fields.mobile} error={formErrors.mobile}>
                        <Input
                          value={formData.mobile}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) => updateField("mobile", event.target.value)}
                        />
                      </EditableInfoRow>
                      <EditableInfoRow label={t.fields.email} error={formErrors.email}>
                        <Input
                          value={formData.email}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) => updateField("email", event.target.value)}
                        />
                      </EditableInfoRow>
                      <EditableInfoRow label={t.fields.website} error={formErrors.website}>
                        <Input
                          value={formData.website}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) => updateField("website", event.target.value)}
                        />
                      </EditableInfoRow>
                    </>
                  ) : (
                    <>
                      <InfoRow
                        label={t.fields.contactPerson}
                        value={provider.contactPerson}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.phone}
                        value={provider.phone}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.mobile}
                        value={provider.mobile}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.email}
                        value={provider.email}
                        link={provider.email ? `mailto:${provider.email}` : ""}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.website}
                        value={provider.website}
                        link={provider.website}
                        copyable
                        copiedMessage={t.copied}
                      />
                    </>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{t.location}</CardTitle>
              <CardDescription>{t.locationDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {isEditing ? (
                    <>
                      <EditableInfoRow label={t.fields.region} error={formErrors.region}>
                        <Input
                          value={formData.region}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) => updateField("region", event.target.value)}
                        />
                      </EditableInfoRow>
                      <EditableInfoRow label={t.fields.city} error={formErrors.city}>
                        <Input
                          value={formData.city}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) => updateField("city", event.target.value)}
                        />
                      </EditableInfoRow>
                      <EditableInfoRow label={t.fields.area} error={formErrors.area}>
                        <Input
                          value={formData.area}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) => updateField("area", event.target.value)}
                        />
                      </EditableInfoRow>
                      <EditableInfoRow label={t.fields.street} error={formErrors.street}>
                        <Input
                          value={formData.street}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) => updateField("street", event.target.value)}
                        />
                      </EditableInfoRow>
                      <EditableInfoRow label={t.fields.address} error={formErrors.address}>
                        <Input
                          value={formData.address}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) => updateField("address", event.target.value)}
                        />
                      </EditableInfoRow>
                      <EditableInfoRow
                        label={t.fields.googleMapsLink}
                        error={formErrors.google_maps_link}
                      >
                        <Input
                          value={formData.google_maps_link}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) =>
                            updateField("google_maps_link", event.target.value)
                          }
                        />
                      </EditableInfoRow>
                      <EditableInfoRow
                        label={t.fields.sourceCategory}
                        error={formErrors.source_category}
                      >
                        <Input
                          value={formData.source_category}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) =>
                            updateField("source_category", event.target.value)
                          }
                        />
                      </EditableInfoRow>
                      <EditableInfoRow
                        label={t.fields.externalReference}
                        error={formErrors.external_reference}
                      >
                        <Input
                          value={formData.external_reference}
                          disabled={isSaving}
                          className="rounded-xl"
                          onChange={(event) =>
                            updateField("external_reference", event.target.value)
                          }
                        />
                      </EditableInfoRow>
                    </>
                  ) : (
                    <>
                      <InfoRow
                        label={t.fields.region}
                        value={provider.region}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.city}
                        value={provider.city}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.area}
                        value={provider.area}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.street}
                        value={provider.street}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.address}
                        value={provider.address}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.googleMapsLink}
                        value={provider.googleMapsLink}
                        link={provider.googleMapsLink}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.sourceCategory}
                        value={provider.sourceCategory}
                        copyable
                        copiedMessage={t.copied}
                      />
                      <InfoRow
                        label={t.fields.externalReference}
                        value={provider.externalReference}
                        copyable
                        copiedMessage={t.copied}
                      />
                    </>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{t.documents}</CardTitle>
              <CardDescription>{t.documentsDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {provider.documents.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.fields.documentType}</TableHead>
                        <TableHead>{t.fields.documentTitle}</TableHead>
                        <TableHead>{t.fields.documentSize}</TableHead>
                        <TableHead>{t.fields.documentDate}</TableHead>
                        <TableHead className="text-end">{t.open}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {provider.documents.map((document) => (
                        <TableRow key={`${document.id}-${document.fileUrl}`}>
                          <TableCell className="font-medium">
                            {documentTypeLabel(document.fileType, locale)}
                          </TableCell>
                          <TableCell>
                            {document.title || document.originalFilename || "-"}
                          </TableCell>
                          <TableCell>{formatFileSize(document.sizeBytes)}</TableCell>
                          <TableCell>{formatDate(document.createdAt)}</TableCell>
                          <TableCell className="text-end">
                            {document.fileUrl ? (
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="rounded-xl"
                              >
                                <a
                                  href={document.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <ExternalLink className="me-2 h-4 w-4" />
                                  {t.open}
                                </a>
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyBox text={t.noDocuments} />
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{t.contracts}</CardTitle>
              <CardDescription>{t.contractsDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {provider.contracts.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.fields.contract}</TableHead>
                        <TableHead>{t.fields.status}</TableHead>
                        <TableHead>{t.fields.discount}</TableHead>
                        <TableHead>{t.fields.systemCommission}</TableHead>
                        <TableHead>{t.fields.createdAt}</TableHead>
                        <TableHead>{t.fields.updatedAt}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {provider.contracts.map((contract) => (
                        <TableRow key={contract.id}>
                          <TableCell className="font-medium">{contract.title}</TableCell>
                          <TableCell>{contract.status}</TableCell>
                          <TableCell>{contract.discount}</TableCell>
                          <TableCell>{contract.systemCommission}</TableCell>
                          <TableCell>{formatDate(contract.startDate)}</TableCell>
                          <TableCell>{formatDate(contract.endDate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyBox text={t.noContracts} />
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{t.products}</CardTitle>
              <CardDescription>{t.productsDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {provider.products.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.fields.product}</TableHead>
                        <TableHead>{t.fields.type}</TableHead>
                        <TableHead>{t.fields.priceBeforeDiscount}</TableHead>
                        <TableHead>{t.fields.discount}</TableHead>
                        <TableHead>{t.fields.priceAfterDiscount}</TableHead>
                        <TableHead>{t.fields.ordersCount}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {provider.products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.title}</TableCell>
                          <TableCell>{product.type}</TableCell>
                          <TableCell>
                            <CurrencyValue value={product.priceBeforeDiscount} />
                          </TableCell>
                          <TableCell>{product.discount}</TableCell>
                          <TableCell>
                            <CurrencyValue value={product.priceAfterDiscount} />
                          </TableCell>
                          <TableCell>{product.ordersCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyBox text={t.noProducts} />
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{t.orders}</CardTitle>
              <CardDescription>{t.ordersDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {provider.orders.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.fields.order}</TableHead>
                        <TableHead>{t.fields.customer}</TableHead>
                        <TableHead>{t.fields.status}</TableHead>
                        <TableHead>{t.fields.total}</TableHead>
                        <TableHead>{t.fields.createdAt}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {provider.orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            {order.number || order.id}
                          </TableCell>
                          <TableCell>{order.customer}</TableCell>
                          <TableCell>{order.status}</TableCell>
                          <TableCell>
                            <CurrencyValue value={order.total} />
                          </TableCell>
                          <TableCell>{formatDate(order.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyBox text={t.noOrders} />
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{t.notes}</CardTitle>
              <CardDescription>{t.notesDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <EditableTextSection
                  label={t.fields.notes}
                  value={formData.notes}
                  error={formErrors.notes}
                  disabled={isSaving}
                  onChange={(value) => updateField("notes", value)}
                />
              ) : (
                <TextSection
                  label={t.fields.notes}
                  value={provider.notes}
                  empty={t.empty}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}