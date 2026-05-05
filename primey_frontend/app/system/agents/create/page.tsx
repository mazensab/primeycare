"use client";

/* ============================================================
   📂 app/system/agents/create/page.tsx
   🧠 Primey Care | Create Agent
   ------------------------------------------------------------
   ✅ المسار: /system/agents/create
   ✅ الإصدار: v2.0.0 - Centers Pattern + Safe Permissions

   ✅ العمل:
      إنشاء مندوب جديد مع بيانات التواصل، كود الإحالة،
      إعدادات العمولة، والبيانات البنكية.

   ✅ Backend:
      POST /api/agents/create/

   ✅ المعيار:
      - مبني بصريًا على نمط المراكز والعملاء المعتمد.
      - دمج UX Refinement مع حماية المرحلة 2.
      - لا يتم إظهار مسارات تقنية أو API داخل الواجهة.
      - الصفحة ممتدة على عرض المساحة وليست متمركزة.
      - Main Form + Sidebar Summary.
      - حماية زر الإنشاء حسب صلاحية agents.create.
      - إخفاء روابط غير مصرح بها بدل تعطيلها.
      - عدم كسر system_admin / superadmin.
      - تحذير عند مغادرة الصفحة وفيها بيانات غير محفوظة.
      - beforeunload protection.
      - Error Alert داخلي عند فشل الحفظ.
      - Field-level validation.
      - تعطيل الحقول أثناء الحفظ.
      - تنظيف البيانات قبل الإرسال.
      - حفظ مسودة محليًا بدون إرسال.
      - تأكيد تفريغ النموذج.
      - دعم عربي / إنجليزي عبر primey-locale.
      - استخدام sonner للتنبيهات.
      - استخدام /currency/sar.svg.
      - الأرقام بالإنجليزية.
      - بدون localhost hardcoded.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileText,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Save,
  ShieldCheck,
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

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";

type AgentStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DRAFT";
type CommissionType = "PERCENTAGE" | "FIXED";

type AuthRecord = Record<string, unknown>;

type AgentFormData = {
  full_name: string;
  agent_code: string;
  referral_code: string;
  status: AgentStatus;
  phone: string;
  email: string;
  city: string;
  address: string;
  default_commission_type: CommissionType;
  default_commission_value: string;
  bank_name: string;
  bank_account_name: string;
  iban: string;
  notes: string;
};

type AgentFormErrors = Partial<Record<keyof AgentFormData, string>>;

type CreateAgentApiResponse = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[] | string>;
  id?: number | string;
  agent?: {
    id?: number | string;
  };
  data?: {
    id?: number | string;
    agent?: {
      id?: number | string;
    };
  };
};

const SAR_ICON_PATH = "/currency/sar.svg";
const DRAFT_STORAGE_KEY = "primey-care-agent-create-draft";

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
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "إنشاء مندوب جديد" : "Create New Agent",
    pageSubtitle: isArabic
      ? "إضافة مندوب جديد داخل Primey Care وربطه لاحقًا بالعملاء والطلبات والعمولات."
      : "Add a new agent in Primey Care and later connect it with customers, orders, and commissions.",

    createAgent: isArabic ? "إنشاء المندوب" : "Create Agent",
    saveDraft: isArabic ? "حفظ كمسودة محلية" : "Save Local Draft",
    restoreDraft: isArabic ? "استعادة المسودة" : "Restore Draft",
    clearForm: isArabic ? "تفريغ النموذج" : "Clear Form",
    backToAgents: isArabic ? "العودة للمندوبين" : "Back to Agents",
    agentsList: isArabic ? "قائمة المندوبين" : "Agents List",

    basicData: isArabic ? "البيانات الأساسية" : "Basic Information",
    basicDataDesc: isArabic
      ? "اسم المندوب، كود المندوب، كود الإحالة، وحالة التشغيل."
      : "Agent name, agent code, referral code, and operational status.",

    contactData: isArabic ? "بيانات التواصل" : "Contact Information",
    contactDataDesc: isArabic
      ? "رقم الجوال، البريد الإلكتروني، المدينة، والعنوان."
      : "Phone, email, city, and address.",

    commissionData: isArabic ? "إعدادات العمولة" : "Commission Settings",
    commissionDataDesc: isArabic
      ? "نوع العمولة والقيمة الافتراضية للمندوب."
      : "Default commission type and value for the agent.",

    bankData: isArabic ? "البيانات البنكية" : "Bank Information",
    bankDataDesc: isArabic
      ? "اسم البنك، اسم صاحب الحساب، والآيبان."
      : "Bank name, account holder name, and IBAN.",

    notesData: isArabic ? "ملاحظات تشغيلية" : "Operational Notes",
    notesDataDesc: isArabic
      ? "أي ملاحظات داخلية مرتبطة بالمندوب."
      : "Any internal notes related to this agent.",

    summaryTitle: isArabic ? "ملخص المندوب" : "Agent Summary",
    summarySubtitle: isArabic
      ? "مراجعة سريعة للبيانات قبل الحفظ."
      : "Quick review before saving.",

    formErrorTitle: isArabic ? "تعذر حفظ البيانات" : "Unable to save data",
    accessDeniedTitle: isArabic ? "غير مصرح بإنشاء مندوب" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية إنشاء المندوبين. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to create agents. Contact your system administrator if you need access.",

    fields: {
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
      bankName: isArabic ? "اسم البنك" : "Bank Name",
      bankAccountName: isArabic ? "اسم صاحب الحساب" : "Account Holder Name",
      iban: isArabic ? "IBAN" : "IBAN",
      notes: isArabic ? "الملاحظات" : "Notes",
    },

    placeholders: {
      fullName: isArabic ? "مثال: محمد أحمد" : "Example: Mohammed Ahmed",
      agentCode: isArabic ? "مثال: AGT-001" : "Example: AGT-001",
      referralCode: isArabic ? "مثال: REF-001" : "Example: REF-001",
      phone: isArabic ? "05xxxxxxxx" : "05xxxxxxxx",
      email: isArabic ? "agent@example.com" : "agent@example.com",
      city: isArabic ? "مثال: جدة" : "Example: Jeddah",
      address: isArabic ? "اكتب العنوان التفصيلي" : "Enter full address",
      commissionValue: isArabic ? "مثال: 10" : "Example: 10",
      bankName: isArabic ? "مثال: مصرف الراجحي" : "Example: Al Rajhi Bank",
      bankAccountName: isArabic ? "مثال: محمد أحمد" : "Example: Mohammed Ahmed",
      iban: isArabic ? "SAxxxxxxxxxxxxxxxxxxxxxx" : "SAxxxxxxxxxxxxxxxxxxxxxx",
      notes: isArabic
        ? "أي ملاحظات تشغيلية عن المندوب..."
        : "Any operational notes about the agent...",
    },

    statuses: {
      ACTIVE: isArabic ? "نشط" : "Active",
      INACTIVE: isArabic ? "غير نشط" : "Inactive",
      SUSPENDED: isArabic ? "موقوف" : "Suspended",
      DRAFT: isArabic ? "مسودة" : "Draft",
    } satisfies Record<AgentStatus, string>,

    commissionTypes: {
      PERCENTAGE: isArabic ? "نسبة مئوية" : "Percentage",
      FIXED: isArabic ? "مبلغ ثابت" : "Fixed Amount",
    } satisfies Record<CommissionType, string>,

    validation: {
      fullName: isArabic ? "اسم المندوب مطلوب." : "Agent name is required.",
      agentCode: isArabic ? "كود المندوب مطلوب." : "Agent code is required.",
      referralCode: isArabic ? "كود الإحالة مطلوب." : "Referral code is required.",
      email: isArabic ? "صيغة البريد غير صحيحة." : "Invalid email format.",
      commissionValue: isArabic
        ? "قيمة العمولة يجب أن تكون رقمًا صحيحًا."
        : "Commission value must be a valid number.",
      commissionPercentage: isArabic
        ? "نسبة العمولة يجب أن تكون بين 0 و 100."
        : "Commission percentage must be between 0 and 100.",
      iban: isArabic
        ? "صيغة الآيبان غير صحيحة."
        : "Invalid IBAN format.",
    },

    success: isArabic
      ? "تم إنشاء المندوب بنجاح."
      : "Agent created successfully.",
    draftSaved: isArabic
      ? "تم حفظ المسودة محليًا."
      : "Draft saved locally.",
    draftRestored: isArabic
      ? "تمت استعادة المسودة."
      : "Draft restored.",
    noDraft: isArabic
      ? "لا توجد مسودة محفوظة."
      : "No saved draft found.",
    formCleared: isArabic
      ? "تم تفريغ النموذج."
      : "Form cleared.",
    apiError: isArabic
      ? "تعذر إنشاء المندوب. تحقق من البيانات وحاول مرة أخرى."
      : "Unable to create agent. Please check the data and try again.",
    validationToast: isArabic
      ? "يرجى تصحيح الحقول المطلوبة قبل المتابعة."
      : "Please fix the required fields before continuing.",
    confirmLeave: isArabic
      ? "لديك بيانات غير محفوظة. هل تريد المغادرة؟"
      : "You have unsaved changes. Do you want to leave?",
    confirmClear: isArabic
      ? "سيتم تفريغ النموذج الحالي. هل تريد المتابعة؟"
      : "The current form will be cleared. Do you want to continue?",

    completion: isArabic ? "نسبة الاكتمال" : "Completion",
    ready: isArabic ? "جاهز للحفظ" : "Ready to save",
    missingData: isArabic ? "ينقصه بيانات أساسية" : "Missing required data",
    commissionSummary: isArabic ? "إعداد العمولة" : "Commission Setup",
    bankSummary: isArabic ? "البيانات البنكية" : "Bank Details",
    contactSummary: isArabic ? "بيانات التواصل" : "Contact Details",

    quickNotesTitle: isArabic ? "ملاحظات مهمة" : "Important Notes",
    quickNotes: [
      isArabic
        ? "كود المندوب وكود الإحالة يجب أن يكونا فريدين."
        : "Agent code and referral code must be unique.",
      isArabic
        ? "نسبة العمولة لا يمكن أن تتجاوز 100% عند اختيار العمولة كنسبة."
        : "Percentage commission cannot exceed 100%.",
      isArabic
        ? "يمكن حفظ البيانات كمسودة محلية قبل الإرسال."
        : "You can save the form as a local draft before submitting.",
      isArabic
        ? "سيتم استخدام بيانات المندوب لاحقًا في الطلبات والعمولات."
        : "Agent data will later be used in orders and commissions.",
    ],
  };
}

/* ============================================================
   Defaults / Validation
============================================================ */

const initialFormData: AgentFormData = {
  full_name: "",
  agent_code: "",
  referral_code: "",
  status: "ACTIVE",
  phone: "",
  email: "",
  city: "",
  address: "",
  default_commission_type: "PERCENTAGE",
  default_commission_value: "",
  bank_name: "",
  bank_account_name: "",
  iban: "",
  notes: "",
};

function isValidEmail(value: string) {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidOptionalIban(value: string) {
  if (!value.trim()) return true;

  const clean = value.replace(/\s+/g, "").toUpperCase();

  return /^SA\d{22}$/.test(clean);
}

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-_]/g, "");
}

function normalizePhoneValue(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function normalizeIban(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function normalizeMoneyValue(value: string) {
  const clean = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  const parsed = Number(clean);

  if (!Number.isFinite(parsed)) return "0.00";

  return parsed.toFixed(2);
}

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

function normalizePayload(formData: AgentFormData) {
  return {
    full_name: formData.full_name.trim(),
    agent_code: normalizeCode(formData.agent_code),
    referral_code: normalizeCode(formData.referral_code),
    status: formData.status,
    phone: normalizePhoneValue(formData.phone),
    email: formData.email.trim().toLowerCase(),
    city: formData.city.trim(),
    address: formData.address.trim(),
    default_commission_type: formData.default_commission_type,
    default_commission_value: normalizeMoneyValue(
      formData.default_commission_value,
    ),
    bank_name: formData.bank_name.trim(),
    bank_account_name: formData.bank_account_name.trim(),
    iban: normalizeIban(formData.iban),
    notes: formData.notes.trim(),
  };
}

function hasFormChanges(formData: AgentFormData) {
  return JSON.stringify(formData) !== JSON.stringify(initialFormData);
}

function resolveCreatedId(result: CreateAgentApiResponse) {
  return (
    result.agent?.id ||
    result.data?.agent?.id ||
    result.data?.id ||
    result.id ||
    null
  );
}

function mapApiFieldErrors(
  errors: CreateAgentApiResponse["errors"],
): AgentFormErrors {
  const nextErrors: AgentFormErrors = {};

  if (!errors) return nextErrors;

  Object.entries(errors).forEach(([key, value]) => {
    const message = Array.isArray(value) ? value[0] : value;

    if (!message) return;

    if (key === "full_name") nextErrors.full_name = String(message);
    if (key === "agent_code") nextErrors.agent_code = String(message);
    if (key === "referral_code") nextErrors.referral_code = String(message);
    if (key === "status") nextErrors.status = String(message);
    if (key === "phone") nextErrors.phone = String(message);
    if (key === "email") nextErrors.email = String(message);
    if (key === "city") nextErrors.city = String(message);
    if (key === "address") nextErrors.address = String(message);
    if (key === "default_commission_type") {
      nextErrors.default_commission_type = String(message);
    }
    if (key === "default_commission_value") {
      nextErrors.default_commission_value = String(message);
    }
    if (key === "bank_name") nextErrors.bank_name = String(message);
    if (key === "bank_account_name") {
      nextErrors.bank_account_name = String(message);
    }
    if (key === "iban") nextErrors.iban = String(message);
    if (key === "notes") nextErrors.notes = String(message);
  });

  return nextErrors;
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

/* ============================================================
   Small UI
============================================================ */

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="mt-1 text-xs font-medium text-destructive">{message}</p>;
}

function RequiredMark() {
  return <span className="text-destructive">*</span>;
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-background p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold">{value || "-"}</p>
      </div>
    </div>
  );
}

/* ============================================================
   Page
============================================================ */

export default function SystemCreateAgentPage() {
  const router = useRouter();
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [formData, setFormData] = useState<AgentFormData>(initialFormData);
  const [errors, setErrors] = useState<AgentFormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const isDirty = useMemo(() => hasFormChanges(formData), [formData]);

  const authResolving = isAuthResolving(auth);

  const canCreateAgents = hasSafePermission(
    auth,
    ["agents.create"],
    "action",
  );

  const canViewAgents = hasSafePermission(
    auth,
    ["agents.view", "agents.list"],
    "view",
  );

  const completedFields = useMemo(() => {
    const keys: Array<keyof AgentFormData> = [
      "full_name",
      "agent_code",
      "referral_code",
      "status",
      "phone",
      "email",
      "city",
      "default_commission_type",
      "default_commission_value",
      "bank_name",
      "iban",
    ];

    return keys.filter((key) => {
      const value = formData[key];
      return String(value || "").trim().length > 0;
    }).length;
  }, [formData]);

  const progressPercent = Math.round((completedFields / 11) * 100);

  const commissionValue = Number(
    formData.default_commission_value.replace(/,/g, ""),
  );

  const isReadyToSave =
    formData.full_name.trim().length > 0 &&
    formData.agent_code.trim().length > 0 &&
    formData.referral_code.trim().length > 0 &&
    Number.isFinite(commissionValue);

  function updateField<K extends keyof AgentFormData>(
    key: K,
    value: AgentFormData[K],
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
    const nextErrors: AgentFormErrors = {};
    const numericCommission = Number(
      formData.default_commission_value.replace(/,/g, ""),
    );

    if (!formData.full_name.trim()) {
      nextErrors.full_name = t.validation.fullName;
    }

    if (!formData.agent_code.trim()) {
      nextErrors.agent_code = t.validation.agentCode;
    }

    if (!formData.referral_code.trim()) {
      nextErrors.referral_code = t.validation.referralCode;
    }

    if (!isValidEmail(formData.email)) {
      nextErrors.email = t.validation.email;
    }

    if (
      formData.default_commission_value.trim() &&
      !Number.isFinite(numericCommission)
    ) {
      nextErrors.default_commission_value = t.validation.commissionValue;
    }

    if (
      formData.default_commission_type === "PERCENTAGE" &&
      Number.isFinite(numericCommission) &&
      (numericCommission < 0 || numericCommission > 100)
    ) {
      nextErrors.default_commission_value = t.validation.commissionPercentage;
    }

    if (!isValidOptionalIban(formData.iban)) {
      nextErrors.iban = t.validation.iban;
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function submitForm() {
    setSubmitError("");

    if (!validateForm()) {
      toast.error(t.validationToast);
      return;
    }

    try {
      setIsSubmitting(true);

      const csrfToken = readCookie("csrftoken");

      const response = await fetch(apiUrl("/api/agents/create/"), {
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
        | CreateAgentApiResponse
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
        router.push(`/system/agents/${createdId}`);
        return;
      }

      router.push("/system/agents/list");
    } catch (error) {
      console.error("Create agent error:", error);
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
      console.error("Save draft error:", error);
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

      const parsed = JSON.parse(rawDraft) as AgentFormData;

      setFormData({
        ...initialFormData,
        ...parsed,
      });

      setErrors({});
      setSubmitError("");
      toast.success(t.draftRestored);
    } catch (error) {
      console.error("Restore draft error:", error);
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

  if (!authResolving && !canCreateAgents) {
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
            {t.pageTitle}
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {t.pageSubtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl sm:w-auto"
            disabled={isSubmitting}
            onClick={() => confirmNavigate("/system/agents")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.backToAgents}</span>
          </Button>

          {canViewAgents ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
              disabled={isSubmitting}
              onClick={() => confirmNavigate("/system/agents/list")}
            >
              <ClipboardList className="h-4 w-4" />
              <span>{t.agentsList}</span>
            </Button>
          ) : null}

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
            <span>{t.createAgent}</span>
          </Button>
        </div>
      </div>

      {/* Submit Error */}
      {submitError ? (
        <Alert className="rounded-2xl border-destructive/20 bg-destructive/5 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t.formErrorTitle}</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main Form */}
        <div className="space-y-4">
          {/* Basic Data */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <IdCard className="h-5 w-5" />
                {t.basicData}
              </CardTitle>
              <CardDescription>{t.basicDataDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t.fields.fullName} <RequiredMark />
                </label>
                <Input
                  value={formData.full_name}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.fullName}
                  className="h-11 rounded-xl"
                  onChange={(event) =>
                    updateField("full_name", event.target.value)
                  }
                />
                <FieldError message={errors.full_name} />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t.fields.agentCode} <RequiredMark />
                </label>
                <Input
                  value={formData.agent_code}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.agentCode}
                  className="h-11 rounded-xl"
                  onChange={(event) =>
                    updateField("agent_code", event.target.value)
                  }
                  onBlur={() =>
                    updateField("agent_code", normalizeCode(formData.agent_code))
                  }
                />
                <FieldError message={errors.agent_code} />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t.fields.referralCode} <RequiredMark />
                </label>
                <Input
                  value={formData.referral_code}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.referralCode}
                  className="h-11 rounded-xl"
                  onChange={(event) =>
                    updateField("referral_code", event.target.value)
                  }
                  onBlur={() =>
                    updateField(
                      "referral_code",
                      normalizeCode(formData.referral_code),
                    )
                  }
                />
                <FieldError message={errors.referral_code} />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t.fields.status}
                </label>
                <select
                  value={formData.status}
                  disabled={isSubmitting}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) =>
                    updateField("status", event.target.value as AgentStatus)
                  }
                >
                  {Object.entries(t.statuses).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.status} />
              </div>
            </CardContent>
          </Card>

          {/* Contact Data */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Phone className="h-5 w-5" />
                {t.contactData}
              </CardTitle>
              <CardDescription>{t.contactDataDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t.fields.phone}
                </label>
                <Input
                  value={formData.phone}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.phone}
                  className="h-11 rounded-xl"
                  onChange={(event) => updateField("phone", event.target.value)}
                  onBlur={() =>
                    updateField("phone", normalizePhoneValue(formData.phone))
                  }
                />
                <FieldError message={errors.phone} />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t.fields.email}
                </label>
                <Input
                  value={formData.email}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.email}
                  className="h-11 rounded-xl"
                  onChange={(event) => updateField("email", event.target.value)}
                  onBlur={() =>
                    updateField("email", formData.email.trim().toLowerCase())
                  }
                />
                <FieldError message={errors.email} />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t.fields.city}
                </label>
                <Input
                  value={formData.city}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.city}
                  className="h-11 rounded-xl"
                  onChange={(event) => updateField("city", event.target.value)}
                />
                <FieldError message={errors.city} />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t.fields.address}
                </label>
                <Input
                  value={formData.address}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.address}
                  className="h-11 rounded-xl"
                  onChange={(event) => updateField("address", event.target.value)}
                />
                <FieldError message={errors.address} />
              </div>
            </CardContent>
          </Card>

          {/* Commission Data */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <CircleDollarSign className="h-5 w-5" />
                {t.commissionData}
              </CardTitle>
              <CardDescription>{t.commissionDataDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t.fields.commissionType}
                </label>
                <select
                  value={formData.default_commission_type}
                  disabled={isSubmitting}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) =>
                    updateField(
                      "default_commission_type",
                      event.target.value as CommissionType,
                    )
                  }
                >
                  {Object.entries(t.commissionTypes).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.default_commission_type} />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t.fields.commissionValue}
                </label>
                <div className="relative">
                  <Input
                    value={formData.default_commission_value}
                    disabled={isSubmitting}
                    placeholder={t.placeholders.commissionValue}
                    className={`h-11 rounded-xl ${
                      formData.default_commission_type === "FIXED"
                        ? isArabic
                          ? "pl-10"
                          : "pr-10"
                        : ""
                    }`}
                    onChange={(event) =>
                      updateField("default_commission_value", event.target.value)
                    }
                  />

                  {formData.default_commission_type === "FIXED" ? (
                    <Image
                      src={SAR_ICON_PATH}
                      alt=""
                      width={16}
                      height={16}
                      className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                        isArabic ? "left-3" : "right-3"
                      }`}
                    />
                  ) : null}
                </div>
                <FieldError message={errors.default_commission_value} />
              </div>
            </CardContent>
          </Card>

          {/* Bank Data */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Banknote className="h-5 w-5" />
                {t.bankData}
              </CardTitle>
              <CardDescription>{t.bankDataDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t.fields.bankName}
                </label>
                <Input
                  value={formData.bank_name}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.bankName}
                  className="h-11 rounded-xl"
                  onChange={(event) =>
                    updateField("bank_name", event.target.value)
                  }
                />
                <FieldError message={errors.bank_name} />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t.fields.bankAccountName}
                </label>
                <Input
                  value={formData.bank_account_name}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.bankAccountName}
                  className="h-11 rounded-xl"
                  onChange={(event) =>
                    updateField("bank_account_name", event.target.value)
                  }
                />
                <FieldError message={errors.bank_account_name} />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">
                  {t.fields.iban}
                </label>
                <Input
                  value={formData.iban}
                  disabled={isSubmitting}
                  placeholder={t.placeholders.iban}
                  dir="ltr"
                  className="h-11 rounded-xl text-left"
                  onChange={(event) => updateField("iban", event.target.value)}
                  onBlur={() => updateField("iban", normalizeIban(formData.iban))}
                />
                <FieldError message={errors.iban} />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <FileText className="h-5 w-5" />
                {t.notesData}
              </CardTitle>
              <CardDescription>{t.notesDataDesc}</CardDescription>
            </CardHeader>

            <CardContent>
              <label className="mb-2 block text-sm font-medium">
                {t.fields.notes}
              </label>
              <textarea
                value={formData.notes}
                disabled={isSubmitting}
                placeholder={t.placeholders.notes}
                className="min-h-28 w-full rounded-2xl border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                onChange={(event) => updateField("notes", event.target.value)}
              />
              <FieldError message={errors.notes} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Summary */}
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">
                {t.summaryTitle}
              </CardTitle>
              <CardDescription>{t.summarySubtitle}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                    <BadgeCheck className="h-5 w-5" />
                  </div>

                  <div className="text-end">
                    <p className="text-xs text-muted-foreground">
                      {t.completion}
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      {formatNumber(progressPercent)}%
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
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
                icon={UserRound}
                label={t.fields.fullName}
                value={formData.full_name}
              />

              <SummaryItem
                icon={IdCard}
                label={t.fields.agentCode}
                value={normalizeCode(formData.agent_code)}
              />

              <SummaryItem
                icon={ShieldCheck}
                label={t.fields.referralCode}
                value={normalizeCode(formData.referral_code)}
              />

              <SummaryItem
                icon={Phone}
                label={t.contactSummary}
                value={formData.phone || formData.email || "-"}
              />

              <SummaryItem
                icon={MapPin}
                label={t.fields.city}
                value={formData.city}
              />

              <SummaryItem
                icon={WalletCards}
                label={t.commissionSummary}
                value={
                  formData.default_commission_type === "PERCENTAGE"
                    ? `${formData.default_commission_value || "0"}%`
                    : formatMoney(formData.default_commission_value || "0")
                }
              />

              {formData.default_commission_type === "FIXED" ? (
                <div className="rounded-2xl border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.fields.commissionValue}
                  </p>
                  <p className="mt-1 text-lg font-bold">
                    <SarAmount value={formData.default_commission_value || "0"} />
                  </p>
                </div>
              ) : null}

              <SummaryItem
                icon={Banknote}
                label={t.bankSummary}
                value={formData.bank_name || formData.iban}
              />

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
                  {t.createAgent}
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
            <CardHeader>
              <CardTitle className="text-base font-bold">
                {t.quickNotesTitle}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                {t.quickNotes.map((note) => (
                  <div key={note} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-sm leading-6 text-muted-foreground">
                      {note}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}