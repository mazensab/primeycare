"use client";

/* ============================================================
   📂 app/system/treasury/settings/page.tsx
   🧠 Primey Care | Treasury Settings Page

   ✅ المسار:
      app/system/treasury/settings/page.tsx

   ✅ العمل:
      صفحة إعدادات الخزينة داخل النظام.
      تضبط الحسابات الافتراضية، سياسات الأرصدة، الترحيل، أرقام السندات، وإعدادات التشغيل المالي.

   ✅ الإصدار:
      Phase 17 UX Refinement + Treasury Settings Build

   ✅ يعتمد على:
      - /api/treasury/settings/
      - /api/treasury/settings/update/
      - /api/treasury/accounts/
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Treasury overview page
      - Treasury accounts pages
      - Treasury transactions pages
      - Treasury transfers page
      - Treasury reports page
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - عرض إعدادات الخزينة.
      - ضبط الصندوق الافتراضي.
      - ضبط البنك الافتراضي.
      - ضبط السماح بالرصيد السالب.
      - ضبط التأكيد التلقائي للحركات.
      - ضبط الترحيل المحاسبي التلقائي.
      - ضبط إلزام المرجع.
      - ضبط بادئات سندات القبض والصرف والتحويل.
      - ضبط تاريخ قفل الخزينة.
      - ضبط حد التنبيه للرصيد.
      - تحميل حسابات الخزينة.
      - حفظ الإعدادات عند توفر الصلاحية.
      - حماية مغادرة الصفحة عند وجود تغييرات غير محفوظة.
      - Error State مستقل.
      - Skeleton Loading.
      - صلاحيات آمنة بدون كسر system_admin/superuser.
      - أرقام إنجليزية دائمًا.
      - رمز SAR من /currency/sar.svg بعد الرقم.
      - استخدام sonner للتنبيهات.

   ------------------------------------------------------------
   تحسينات هذا الإصدار:
      - الملف المرفق كان شبه فارغ، وتم بناء الصفحة كاملة من الصفر.
      - الالتزام بالقاعدة: w-full space-y-4 بدون main/min-h-screen/max-w.
      - عدم عرض أي مسارات أو عبارات تقنية داخل واجهة المستخدم.
      - إخفاء أزرار الحفظ غير المصرح بها بدل تعطيلها.
      - إزالة أي localhost أو API base ثابت.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
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
import { Input } from "@/components/ui/input";

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";
type Dict = Record<string, unknown>;

type AccountType = "CASHBOX" | "BANK" | "WALLET" | "OTHER";

type TreasuryAccountOption = {
  id: string;
  name: string;
  code: string;
  account_type: AccountType;
  current_balance: number;
  is_default: boolean;
};

type TreasurySettingsState = {
  defaultCashboxId: string;
  defaultBankId: string;
  allowNegativeBalance: boolean;
  autoConfirmTransactions: boolean;
  autoPostAccounting: boolean;
  requireReference: boolean;
  lockConfirmedTransactions: boolean;
  receiptPrefix: string;
  paymentPrefix: string;
  transferPrefix: string;
  adjustmentPrefix: string;
  fiscalLockDate: string;
  lowBalanceAlertAmount: string;
  notes: string;
};

type ApiEnvelope<T> = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  data?: T;
  settings?: unknown;
  results?: unknown[];
  items?: unknown[];
  rows?: unknown[];
  accounts?: unknown[];
};

const SAR_ICON_PATH = "/currency/sar.svg";

const DEFAULT_SETTINGS: TreasurySettingsState = {
  defaultCashboxId: "",
  defaultBankId: "",
  allowNegativeBalance: false,
  autoConfirmTransactions: true,
  autoPostAccounting: true,
  requireReference: false,
  lockConfirmedTransactions: true,
  receiptPrefix: "RCV",
  paymentPrefix: "PAY",
  transferPrefix: "TRF",
  adjustmentPrefix: "ADJ",
  fiscalLockDate: "",
  lowBalanceAlertAmount: "0",
  notes: "",
};

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

    if (parts.length === 2) {
      return parts.pop()?.split(";").shift() || "";
    }

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
    title: isArabic ? "إعدادات الخزينة" : "Treasury Settings",
    subtitle: isArabic
      ? "ضبط سياسات الخزينة والحسابات الافتراضية والترحيل وأرقام السندات."
      : "Configure treasury policies, default accounts, posting, and voucher numbering.",

    back: isArabic ? "الخزينة" : "Treasury",
    accounts: isArabic ? "حسابات الخزينة" : "Treasury Accounts",
    transactions: isArabic ? "الحركات المالية" : "Transactions",
    reports: isArabic ? "تقارير الخزينة" : "Treasury Reports",
    refresh: isArabic ? "تحديث" : "Refresh",
    save: isArabic ? "حفظ الإعدادات" : "Save Settings",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    reset: isArabic ? "استعادة القيم" : "Reset Values",
    retry: isArabic ? "إعادة المحاولة" : "Retry",

    accountsSection: isArabic ? "الحسابات الافتراضية" : "Default Accounts",
    accountsSectionDesc: isArabic
      ? "حدد الصندوق والبنك الافتراضي لاستخدامهما في العمليات اليومية."
      : "Choose the default cashbox and bank used in daily operations.",

    policySection: isArabic ? "سياسات التشغيل" : "Operational Policies",
    policySectionDesc: isArabic
      ? "اضبط قواعد تأكيد الحركات، الأرصدة، والترحيل المحاسبي."
      : "Configure confirmation, balance, and accounting posting rules.",

    numberingSection: isArabic ? "ترقيم السندات" : "Voucher Numbering",
    numberingSectionDesc: isArabic
      ? "حدد بادئات سندات القبض والصرف والتحويل والتسويات."
      : "Set prefixes for receipt, payment, transfer, and adjustment vouchers.",

    lockSection: isArabic ? "القفل والتنبيهات" : "Locking and Alerts",
    lockSectionDesc: isArabic
      ? "حدد تاريخ قفل الخزينة وحد التنبيه للرصيد المنخفض."
      : "Set treasury lock date and low balance alert threshold.",

    summarySection: isArabic ? "ملخص الإعدادات" : "Settings Summary",
    summarySectionDesc: isArabic
      ? "مراجعة سريعة للإعدادات الحالية قبل الحفظ."
      : "Quick review of current settings before saving.",

    defaultCashbox: isArabic ? "الصندوق الافتراضي" : "Default Cashbox",
    defaultBank: isArabic ? "البنك الافتراضي" : "Default Bank",
    notSet: isArabic ? "غير محدد" : "Not set",
    currentBalance: isArabic ? "الرصيد الحالي" : "Current Balance",

    allowNegativeBalance: isArabic
      ? "السماح بالرصيد السالب"
      : "Allow Negative Balance",
    allowNegativeBalanceDesc: isArabic
      ? "يفضل إبقاؤها غير مفعلة إلا عند وجود سياسة مالية واضحة."
      : "Keep disabled unless there is a clear financial policy.",

    autoConfirmTransactions: isArabic
      ? "تأكيد الحركات تلقائيًا"
      : "Auto Confirm Transactions",
    autoConfirmTransactionsDesc: isArabic
      ? "عند التفعيل يتم إنشاء الحركة مؤكدة مباشرة عند الحفظ."
      : "When enabled, transactions are created as confirmed immediately.",

    autoPostAccounting: isArabic
      ? "الترحيل المحاسبي التلقائي"
      : "Automatic Accounting Posting",
    autoPostAccountingDesc: isArabic
      ? "يرحل أثر الحركة محاسبيًا عند التأكيد حسب ربط المحاسبة."
      : "Posts accounting impact on confirmation according to accounting integration.",

    requireReference: isArabic
      ? "إلزام المرجع في الحركات"
      : "Require Transaction Reference",
    requireReferenceDesc: isArabic
      ? "يفيد في تتبع الحوالات والمراجع الخارجية."
      : "Useful for tracking transfers and external references.",

    lockConfirmedTransactions: isArabic
      ? "قفل الحركات المؤكدة"
      : "Lock Confirmed Transactions",
    lockConfirmedTransactionsDesc: isArabic
      ? "يمنع تعديل الحركات المؤكدة ويجعل الإلغاء هو الإجراء الآمن."
      : "Prevents editing confirmed transactions and keeps cancellation as the safe action.",

    receiptPrefix: isArabic ? "بادئة سند القبض" : "Receipt Prefix",
    paymentPrefix: isArabic ? "بادئة سند الصرف" : "Payment Prefix",
    transferPrefix: isArabic ? "بادئة التحويل" : "Transfer Prefix",
    adjustmentPrefix: isArabic ? "بادئة التسوية" : "Adjustment Prefix",
    fiscalLockDate: isArabic ? "تاريخ قفل الخزينة" : "Treasury Lock Date",
    lowBalanceAlertAmount: isArabic
      ? "حد التنبيه للرصيد المنخفض"
      : "Low Balance Alert",
    notes: isArabic ? "ملاحظات داخلية" : "Internal Notes",

    enabled: isArabic ? "مفعل" : "Enabled",
    disabled: isArabic ? "غير مفعل" : "Disabled",
    active: isArabic ? "نشط" : "Active",
    cashbox: isArabic ? "صندوق" : "Cashbox",
    bank: isArabic ? "بنك" : "Bank",
    wallet: isArabic ? "محفظة" : "Wallet",
    other: isArabic ? "أخرى" : "Other",

    accessDeniedTitle: isArabic
      ? "غير مصرح بعرض إعدادات الخزينة"
      : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض إعدادات الخزينة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view treasury settings. Contact your system administrator if you need access.",

    readOnlyNotice: isArabic
      ? "يمكنك عرض الإعدادات الحالية، لكن حفظ التعديلات يحتاج صلاحية إدارة الخزينة."
      : "You can view current settings, but saving changes requires treasury management permission.",

    loadError: isArabic
      ? "تعذر تحميل إعدادات الخزينة."
      : "Unable to load treasury settings.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث إعدادات الخزينة بنجاح."
      : "Treasury settings refreshed successfully.",

    saveSuccess: isArabic
      ? "تم حفظ إعدادات الخزينة بنجاح."
      : "Treasury settings saved successfully.",
    saveError: isArabic
      ? "تعذر حفظ إعدادات الخزينة."
      : "Unable to save treasury settings.",

    validationTitle: isArabic ? "راجع الإعدادات" : "Review settings",
    invalidLowBalance: isArabic
      ? "حد التنبيه يجب أن يكون رقمًا صحيحًا أو صفر."
      : "Low balance alert must be a valid number or zero.",

    confirmReset: isArabic
      ? "هل تريد استعادة القيم قبل التعديل؟"
      : "Reset values before changes?",
    unsavedChanges: isArabic
      ? "لديك تغييرات غير محفوظة. هل تريد المغادرة؟"
      : "You have unsaved changes. Do you want to leave?",
  };
}

/* ============================================================
   Helpers
============================================================ */

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: unknown): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function normalizeMoneyInput(value: string) {
  const cleaned = value.replace(/[^\d.-]/g, "");
  const parts = cleaned.split(".");
  const integerPart = parts[0] || "";
  const decimalPart = parts.slice(1).join("");

  if (parts.length > 1) {
    return `${integerPart}.${decimalPart.slice(0, 2)}`;
  }

  return integerPart;
}

function isValidAmountOrZero(value: string) {
  if (!value.trim()) return true;

  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0;
}

function getNestedValue(obj: Dict, keys: string[]): unknown {
  for (const key of keys) {
    const value = obj[key];

    if (value !== undefined && value !== null && value !== "") return value;
  }

  for (const container of ["settings", "treasury_settings", "account", "data"]) {
    const nested = obj[container];

    if (nested && typeof nested === "object") {
      const value = getNestedValue(nested as Dict, keys);

      if (value !== undefined && value !== null && value !== "") return value;
    }
  }

  return undefined;
}

function extractRows(payload: ApiEnvelope<unknown> | null): unknown[] {
  if (!payload) return [];

  const data = asDict(payload.data);

  if (Array.isArray(payload.accounts)) return payload.accounts;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.rows)) return payload.rows;

  if (Array.isArray(data.accounts)) return data.accounts as unknown[];
  if (Array.isArray(data.results)) return data.results as unknown[];
  if (Array.isArray(data.items)) return data.items as unknown[];
  if (Array.isArray(data.rows)) return data.rows as unknown[];

  if (Array.isArray(payload.data)) return payload.data;

  return [];
}

function extractSettings(payload: ApiEnvelope<unknown> | null): Dict {
  if (!payload) return {};

  const data = asDict(payload.data);

  if (payload.settings && typeof payload.settings === "object") {
    return payload.settings as Dict;
  }

  if (data.settings && typeof data.settings === "object") {
    return data.settings as Dict;
  }

  if (data.treasury_settings && typeof data.treasury_settings === "object") {
    return data.treasury_settings as Dict;
  }

  return Object.keys(data).length > 0 ? data : asDict(payload);
}

function normalizeAccountType(value: unknown): AccountType {
  const clean = String(value || "").toUpperCase();

  if (["CASHBOX", "CASH", "BOX"].includes(clean)) return "CASHBOX";
  if (["BANK", "BANK_ACCOUNT"].includes(clean)) return "BANK";
  if (["WALLET", "E_WALLET"].includes(clean)) return "WALLET";

  return "OTHER";
}

function normalizeAccount(item: unknown): TreasuryAccountOption {
  const obj = asDict(item);

  return {
    id: String(getNestedValue(obj, ["id", "uuid", "pk"]) || ""),
    name: String(getNestedValue(obj, ["name", "title", "label"]) || "-"),
    code: String(getNestedValue(obj, ["code", "account_code", "number"]) || "-"),
    account_type: normalizeAccountType(
      getNestedValue(obj, ["account_type", "type", "kind"]),
    ),
    current_balance: toNumber(
      getNestedValue(obj, ["current_balance", "balance", "available_balance"]),
    ),
    is_default: Boolean(getNestedValue(obj, ["is_default", "default"])),
  };
}

function normalizeSettings(
  source: Dict,
  accounts: TreasuryAccountOption[],
): TreasurySettingsState {
  const defaultCashbox =
    String(
      getNestedValue(source, [
        "default_cashbox_id",
        "default_cashbox",
        "cashbox_id",
      ]) || "",
    ) ||
    accounts.find((item) => item.account_type === "CASHBOX" && item.is_default)
      ?.id ||
    "";

  const defaultBank =
    String(
      getNestedValue(source, ["default_bank_id", "default_bank", "bank_id"]) ||
        "",
    ) ||
    accounts.find((item) => item.account_type === "BANK" && item.is_default)
      ?.id ||
    "";

  return {
    defaultCashboxId: defaultCashbox,
    defaultBankId: defaultBank,
    allowNegativeBalance: Boolean(
      getNestedValue(source, [
        "allow_negative_balance",
        "allowNegativeBalance",
      ]) ?? DEFAULT_SETTINGS.allowNegativeBalance,
    ),
    autoConfirmTransactions: Boolean(
      getNestedValue(source, [
        "auto_confirm_transactions",
        "autoConfirmTransactions",
      ]) ?? DEFAULT_SETTINGS.autoConfirmTransactions,
    ),
    autoPostAccounting: Boolean(
      getNestedValue(source, [
        "auto_post_accounting",
        "autoPostAccounting",
        "auto_accounting_posting",
      ]) ?? DEFAULT_SETTINGS.autoPostAccounting,
    ),
    requireReference: Boolean(
      getNestedValue(source, ["require_reference", "requireReference"]) ??
        DEFAULT_SETTINGS.requireReference,
    ),
    lockConfirmedTransactions: Boolean(
      getNestedValue(source, [
        "lock_confirmed_transactions",
        "lockConfirmedTransactions",
      ]) ?? DEFAULT_SETTINGS.lockConfirmedTransactions,
    ),
    receiptPrefix: String(
      getNestedValue(source, ["receipt_prefix", "receiptPrefix"]) ||
        DEFAULT_SETTINGS.receiptPrefix,
    ),
    paymentPrefix: String(
      getNestedValue(source, ["payment_prefix", "paymentPrefix"]) ||
        DEFAULT_SETTINGS.paymentPrefix,
    ),
    transferPrefix: String(
      getNestedValue(source, ["transfer_prefix", "transferPrefix"]) ||
        DEFAULT_SETTINGS.transferPrefix,
    ),
    adjustmentPrefix: String(
      getNestedValue(source, ["adjustment_prefix", "adjustmentPrefix"]) ||
        DEFAULT_SETTINGS.adjustmentPrefix,
    ),
    fiscalLockDate: String(
      getNestedValue(source, ["fiscal_lock_date", "treasury_lock_date"]) || "",
    ),
    lowBalanceAlertAmount: String(
      getNestedValue(source, [
        "low_balance_alert_amount",
        "lowBalanceAlertAmount",
      ]) ?? DEFAULT_SETTINGS.lowBalanceAlertAmount,
    ),
    notes: String(getNestedValue(source, ["notes", "description"]) || ""),
  };
}

function buildPayload(settings: TreasurySettingsState) {
  const lowBalance = toNumber(settings.lowBalanceAlertAmount);

  return {
    default_cashbox_id: settings.defaultCashboxId || null,
    default_bank_id: settings.defaultBankId || null,
    allow_negative_balance: settings.allowNegativeBalance,
    auto_confirm_transactions: settings.autoConfirmTransactions,
    auto_post_accounting: settings.autoPostAccounting,
    require_reference: settings.requireReference,
    lock_confirmed_transactions: settings.lockConfirmedTransactions,
    receipt_prefix: settings.receiptPrefix.trim(),
    payment_prefix: settings.paymentPrefix.trim(),
    transfer_prefix: settings.transferPrefix.trim(),
    adjustment_prefix: settings.adjustmentPrefix.trim(),
    fiscal_lock_date: settings.fiscalLockDate || null,
    low_balance_alert_amount: lowBalance,
    notes: settings.notes.trim(),
  };
}

function accountLabel(account: TreasuryAccountOption | null | undefined) {
  if (!account) return "-";

  return `${account.name}${account.code ? ` (${account.code})` : ""}`;
}

function accountTypeLabel(type: AccountType, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<AccountType, string> = {
    CASHBOX: t.cashbox,
    BANK: t.bank,
    WALLET: t.wallet,
    OTHER: t.other,
  };

  return labels[type];
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

function ToggleCard({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border bg-background p-4">
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-muted-foreground">
          {description}
        </span>
      </span>

      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 rounded border-muted-foreground/40 accent-primary disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="grid gap-4 p-5 md:grid-cols-2">
              {Array.from({ length: 4 }).map((__, itemIndex) => (
                <div
                  key={itemIndex}
                  className="rounded-2xl border bg-background p-4"
                >
                  <SkeletonLine className="h-3 w-24" />
                  <SkeletonLine className="mt-3 h-8 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="space-y-4 p-5">
          {Array.from({ length: 7 }).map((_, index) => (
            <SkeletonLine key={index} className="h-10 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================================================
   Page
============================================================ */

export default function TreasurySettingsPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [settings, setSettings] =
    useState<TreasurySettingsState>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] =
    useState<TreasurySettingsState>(DEFAULT_SETTINGS);
  const [accounts, setAccounts] = useState<TreasuryAccountOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    ["treasury.view", "treasury.settings.view"],
    "view",
  );

  const canManage = hasSafePermission(
    auth,
    ["treasury.settings", "treasury.settings.manage", "treasury.manage"],
    "action",
  );

  const cashboxAccounts = useMemo(
    () => accounts.filter((item) => item.account_type === "CASHBOX"),
    [accounts],
  );

  const bankAccounts = useMemo(
    () => accounts.filter((item) => item.account_type === "BANK"),
    [accounts],
  );

  const selectedCashbox = useMemo(
    () =>
      accounts.find((item) => item.id === settings.defaultCashboxId) || null,
    [accounts, settings.defaultCashboxId],
  );

  const selectedBank = useMemo(
    () => accounts.find((item) => item.id === settings.defaultBankId) || null,
    [accounts, settings.defaultBankId],
  );

  function updateSetting<K extends keyof TreasurySettingsState>(
    key: K,
    value: TreasurySettingsState[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
    setIsDirty(true);
    setSubmitError("");
  }

  const loadSettings = useCallback(
    async (showToast = false) => {
      if (!canView) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");
        setSubmitError("");

        const [settingsResponse, accountsResponse] = await Promise.allSettled([
          fetch(apiUrl("/api/treasury/settings/"), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          }),
          fetch(apiUrl("/api/treasury/accounts/?page_size=500"), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          }),
        ]);

        async function readJson(result: PromiseSettledResult<Response>) {
          if (result.status !== "fulfilled") return null;

          const response = result.value;
          const payload = (await response.json().catch(() => null)) as
            | ApiEnvelope<unknown>
            | null;

          if ([400, 404, 405].includes(response.status)) return null;

          if (
            !response.ok ||
            payload?.ok === false ||
            payload?.success === false
          ) {
            throw new Error(
              payload?.message ||
                payload?.detail ||
                payload?.error ||
                `HTTP ${response.status}`,
            );
          }

          return payload;
        }

        const settingsPayload = await readJson(settingsResponse);
        const accountsPayload = await readJson(accountsResponse);

        const normalizedAccounts = extractRows(accountsPayload)
          .map(normalizeAccount)
          .filter((item) => item.id && item.name);

        const normalizedSettings = normalizeSettings(
          extractSettings(settingsPayload),
          normalizedAccounts,
        );

        setAccounts(normalizedAccounts);
        setSettings(normalizedSettings);
        setOriginalSettings(normalizedSettings);
        setIsDirty(false);

        if (showToast) toast.success(t.loadSuccess);
      } catch (error) {
        console.error("Treasury settings load error:", error);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canView, t.loadError, t.loadSuccess],
  );

  async function saveSettings() {
    if (!canManage) return;

    if (!isValidAmountOrZero(settings.lowBalanceAlertAmount)) {
      setSubmitError(t.invalidLowBalance);
      toast.error(t.validationTitle);
      return;
    }

    try {
      setIsSaving(true);
      setSubmitError("");

      const csrfToken = getCookie("csrftoken");
      const payload = buildPayload(settings);

      const endpoints = [
        "/api/treasury/settings/update/",
        "/api/treasury/settings/",
      ];

      let saved = false;
      let lastMessage = "";

      for (const endpoint of endpoints) {
        const response = await fetch(apiUrl(endpoint), {
          method: "POST",
          credentials: "include",
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

        if ([404, 405].includes(response.status)) {
          lastMessage =
            responsePayload?.message ||
            responsePayload?.detail ||
            responsePayload?.error ||
            `HTTP ${response.status}`;
          continue;
        }

        if (response.status === 400) {
          lastMessage =
            responsePayload?.message ||
            responsePayload?.detail ||
            responsePayload?.error ||
            t.saveError;
          break;
        }

        if (
          !response.ok ||
          responsePayload?.ok === false ||
          responsePayload?.success === false
        ) {
          throw new Error(
            responsePayload?.message ||
              responsePayload?.detail ||
              responsePayload?.error ||
              `HTTP ${response.status}`,
          );
        }

        saved = true;
        break;
      }

      if (!saved) {
        throw new Error(lastMessage || t.saveError);
      }

      setOriginalSettings(settings);
      setIsDirty(false);
      toast.success(t.saveSuccess);
    } catch (error) {
      console.error("Treasury settings save error:", error);
      const message = error instanceof Error ? error.message : t.saveError;

      setSubmitError(message || t.saveError);
      toast.error(t.saveError);
    } finally {
      setIsSaving(false);
    }
  }

  function resetSettings() {
    if (isDirty && !window.confirm(t.confirmReset)) return;

    setSettings(originalSettings);
    setSubmitError("");
    setIsDirty(false);
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
    loadSettings(false);
  }, [authResolving, loadSettings]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty || isSaving) return;

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);

    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [isDirty, isSaving]);

  if (!authResolving && !canView) {
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
          <Link
            href="/system/treasury"
            onClick={(event) => {
              if (isDirty && !window.confirm(t.unsavedChanges)) {
                event.preventDefault();
              }
            }}
          >
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Link
            href="/system/treasury/accounts"
            onClick={(event) => {
              if (isDirty && !window.confirm(t.unsavedChanges)) {
                event.preventDefault();
              }
            }}
          >
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <Wallet className="h-4 w-4" />
              <span>{t.accounts}</span>
            </Button>
          </Link>

          <Link
            href="/system/treasury/transactions"
            onClick={(event) => {
              if (isDirty && !window.confirm(t.unsavedChanges)) {
                event.preventDefault();
              }
            }}
          >
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <CreditCard className="h-4 w-4" />
              <span>{t.transactions}</span>
            </Button>
          </Link>

          <Link
            href="/system/treasury/reports"
            onClick={(event) => {
              if (isDirty && !window.confirm(t.unsavedChanges)) {
                event.preventDefault();
              }
            }}
          >
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <Settings className="h-4 w-4" />
              <span>{t.reports}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadSettings(true)}
            disabled={isLoading || isSaving}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={resetSettings}
            disabled={isLoading || isSaving || !isDirty}
          >
            <RotateCcw className="h-4 w-4" />
            <span>{t.reset}</span>
          </Button>

          {canManage ? (
            <Button
              className="h-10 rounded-xl"
              onClick={saveSettings}
              disabled={isLoading || isSaving || !isDirty}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{isSaving ? t.saving : t.save}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {!canManage ? (
        <Card className="rounded-2xl border bg-amber-50/60 shadow-sm dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <ShieldCheck className="h-5 w-5" />
            </div>

            <p className="text-sm leading-6 text-muted-foreground">
              {t.readOnlyNotice}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <XCircle className="h-5 w-5" />
              </div>

              <div>
                <p className="font-semibold text-destructive">
                  {errorMessage}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.loadErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadSettings(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {submitError ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5" />
            </div>

            <div>
              <p className="font-semibold text-destructive">
                {t.validationTitle}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                {submitError}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <SettingsSkeleton />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Wallet className="h-4 w-4" />
                  {t.accountsSection}
                </CardTitle>
                <CardDescription>{t.accountsSectionDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t.defaultCashbox}
                  </label>
                  <select
                    value={settings.defaultCashboxId}
                    onChange={(event) =>
                      updateSetting("defaultCashboxId", event.target.value)
                    }
                    disabled={!canManage || isSaving}
                    className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">{t.notSet}</option>
                    {cashboxAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {accountLabel(account)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.defaultBank}</label>
                  <select
                    value={settings.defaultBankId}
                    onChange={(event) =>
                      updateSetting("defaultBankId", event.target.value)
                    }
                    disabled={!canManage || isSaving}
                    className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">{t.notSet}</option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {accountLabel(account)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.defaultCashbox}
                  </p>
                  <p className="mt-2 font-semibold">
                    {selectedCashbox ? accountLabel(selectedCashbox) : t.notSet}
                  </p>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <MoneyText value={selectedCashbox?.current_balance || 0} />
                  </div>
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.defaultBank}
                  </p>
                  <p className="mt-2 font-semibold">
                    {selectedBank ? accountLabel(selectedBank) : t.notSet}
                  </p>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <MoneyText value={selectedBank?.current_balance || 0} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <ShieldCheck className="h-4 w-4" />
                  {t.policySection}
                </CardTitle>
                <CardDescription>{t.policySectionDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2">
                <ToggleCard
                  title={t.allowNegativeBalance}
                  description={t.allowNegativeBalanceDesc}
                  checked={settings.allowNegativeBalance}
                  disabled={!canManage || isSaving}
                  onChange={(value) =>
                    updateSetting("allowNegativeBalance", value)
                  }
                />

                <ToggleCard
                  title={t.autoConfirmTransactions}
                  description={t.autoConfirmTransactionsDesc}
                  checked={settings.autoConfirmTransactions}
                  disabled={!canManage || isSaving}
                  onChange={(value) =>
                    updateSetting("autoConfirmTransactions", value)
                  }
                />

                <ToggleCard
                  title={t.autoPostAccounting}
                  description={t.autoPostAccountingDesc}
                  checked={settings.autoPostAccounting}
                  disabled={!canManage || isSaving}
                  onChange={(value) => updateSetting("autoPostAccounting", value)}
                />

                <ToggleCard
                  title={t.requireReference}
                  description={t.requireReferenceDesc}
                  checked={settings.requireReference}
                  disabled={!canManage || isSaving}
                  onChange={(value) => updateSetting("requireReference", value)}
                />

                <div className="md:col-span-2">
                  <ToggleCard
                    title={t.lockConfirmedTransactions}
                    description={t.lockConfirmedTransactionsDesc}
                    checked={settings.lockConfirmedTransactions}
                    disabled={!canManage || isSaving}
                    onChange={(value) =>
                      updateSetting("lockConfirmedTransactions", value)
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <CreditCard className="h-4 w-4" />
                  {t.numberingSection}
                </CardTitle>
                <CardDescription>{t.numberingSectionDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t.receiptPrefix}
                  </label>
                  <Input
                    value={settings.receiptPrefix}
                    onChange={(event) =>
                      updateSetting(
                        "receiptPrefix",
                        event.target.value.toUpperCase(),
                      )
                    }
                    disabled={!canManage || isSaving}
                    className="h-11 rounded-xl"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t.paymentPrefix}
                  </label>
                  <Input
                    value={settings.paymentPrefix}
                    onChange={(event) =>
                      updateSetting(
                        "paymentPrefix",
                        event.target.value.toUpperCase(),
                      )
                    }
                    disabled={!canManage || isSaving}
                    className="h-11 rounded-xl"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t.transferPrefix}
                  </label>
                  <Input
                    value={settings.transferPrefix}
                    onChange={(event) =>
                      updateSetting(
                        "transferPrefix",
                        event.target.value.toUpperCase(),
                      )
                    }
                    disabled={!canManage || isSaving}
                    className="h-11 rounded-xl"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t.adjustmentPrefix}
                  </label>
                  <Input
                    value={settings.adjustmentPrefix}
                    onChange={(event) =>
                      updateSetting(
                        "adjustmentPrefix",
                        event.target.value.toUpperCase(),
                      )
                    }
                    disabled={!canManage || isSaving}
                    className="h-11 rounded-xl"
                    dir="ltr"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <CalendarDays className="h-4 w-4" />
                  {t.lockSection}
                </CardTitle>
                <CardDescription>{t.lockSectionDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t.fiscalLockDate}
                  </label>
                  <Input
                    type="date"
                    value={settings.fiscalLockDate}
                    onChange={(event) =>
                      updateSetting("fiscalLockDate", event.target.value)
                    }
                    disabled={!canManage || isSaving}
                    className="h-11 rounded-xl"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t.lowBalanceAlertAmount}
                  </label>
                  <div className="relative">
                    <Input
                      value={settings.lowBalanceAlertAmount}
                      onChange={(event) =>
                        updateSetting(
                          "lowBalanceAlertAmount",
                          normalizeMoneyInput(event.target.value),
                        )
                      }
                      disabled={!canManage || isSaving}
                      inputMode="decimal"
                      className="h-11 rounded-xl pe-10"
                      dir="ltr"
                    />
                    <div className="absolute top-1/2 -translate-y-1/2 end-3">
                      <SarIcon className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">{t.notes}</label>
                  <textarea
                    value={settings.notes}
                    onChange={(event) =>
                      updateSetting("notes", event.target.value)
                    }
                    disabled={!canManage || isSaving}
                    rows={4}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <CheckCircle2 className="h-4 w-4" />
                  {t.summarySection}
                </CardTitle>
                <CardDescription>{t.summarySectionDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.defaultCashbox}
                  </p>
                  <p className="mt-2 font-semibold">
                    {selectedCashbox ? accountLabel(selectedCashbox) : t.notSet}
                  </p>
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.defaultBank}
                  </p>
                  <p className="mt-2 font-semibold">
                    {selectedBank ? accountLabel(selectedBank) : t.notSet}
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                  <span>{t.autoConfirmTransactions}</span>
                  <Badge variant="outline" className="rounded-full">
                    {settings.autoConfirmTransactions ? t.enabled : t.disabled}
                  </Badge>
                </div>

                <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                  <span>{t.autoPostAccounting}</span>
                  <Badge variant="outline" className="rounded-full">
                    {settings.autoPostAccounting ? t.enabled : t.disabled}
                  </Badge>
                </div>

                <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                  <span>{t.lockConfirmedTransactions}</span>
                  <Badge variant="outline" className="rounded-full">
                    {settings.lockConfirmedTransactions
                      ? t.enabled
                      : t.disabled}
                  </Badge>
                </div>

                <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                  <span>{t.lowBalanceAlertAmount}</span>
                  <MoneyText value={settings.lowBalanceAlertAmount || 0} />
                </div>

                <div className="grid gap-2 pt-2">
                  {canManage ? (
                    <Button
                      type="button"
                      className="h-11 rounded-2xl"
                      onClick={saveSettings}
                      disabled={isSaving || !isDirty}
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
                    variant="outline"
                    className="h-11 rounded-2xl"
                    onClick={resetSettings}
                    disabled={isSaving || !isDirty}
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t.reset}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Banknote className="h-4 w-4" />
                  {t.accountsSection}
                </div>

                <div className="grid gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2">
                    <span>{t.cashbox}</span>
                    <span className="font-semibold text-foreground">
                      {cashboxAccounts.length.toLocaleString("en-US")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2">
                    <span>{t.bank}</span>
                    <span className="font-semibold text-foreground">
                      {bankAccounts.length.toLocaleString("en-US")}
                    </span>
                  </div>

                  {selectedCashbox ? (
                    <div className="rounded-xl border bg-background px-3 py-2">
                      <p className="text-xs">{accountTypeLabel("CASHBOX", locale)}</p>
                      <div className="mt-1 font-semibold text-foreground">
                        <MoneyText value={selectedCashbox.current_balance} />
                      </div>
                    </div>
                  ) : null}

                  {selectedBank ? (
                    <div className="rounded-xl border bg-background px-3 py-2">
                      <p className="text-xs">{accountTypeLabel("BANK", locale)}</p>
                      <div className="mt-1 font-semibold text-foreground">
                        <MoneyText value={selectedBank.current_balance} />
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}