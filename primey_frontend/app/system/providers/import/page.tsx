"use client";

/* ============================================================
   📂 primey_frontend/app/system/providers/import/page.tsx
   🧠 Primey Care | Providers Excel Import Page
   ------------------------------------------------------------
   ✅ المرحلة 17 + المرحلة 2
   ✅ استيراد الشبكة الطبية لمقدمي الخدمة
   ✅ Dry Run قبل الحفظ
   ✅ تنفيذ الاستيراد الفعلي بعد المراجعة
   ✅ دعم الاسم العربي والإنجليزي
   ✅ دعم السجل التجاري والرقم الضريبي عند وجودها في Excel
   ✅ CSRF support for Django POST FormData
   ✅ Permission-safe actions
   ✅ Full width layout
   ✅ Error State مستقل
   ✅ Empty State ذكي
   ✅ Arabic / English عبر primey-locale
   ✅ استخدام toast من sonner
   ✅ بدون localhost hardcoded
   ✅ بدون نصوص تقنية ظاهرة في الواجهة
   ✅ الأرقام بالإنجليزية
============================================================ */

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  Globe2,
  Info,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  X,
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

type Locale = "ar" | "en";
type PermissionStatus = "checking" | "allowed" | "denied";
type ImportAction = "created" | "updated" | "skipped" | "failed";

type ImportSampleProvider = {
  id?: number | null;
  name?: string;
  name_ar?: string;
  name_en?: string;
  code?: string;
  city?: string;
  region?: string;
  source_category?: string;
  commercial_registration?: string;
  tax_number?: string;
};

type ImportSampleItem = {
  ok?: boolean;
  action?: ImportAction | string;
  row_number?: number;
  message?: string;
  provider?: ImportSampleProvider | null;
};

type ImportErrorItem = {
  row_number?: number;
  name?: string;
  message?: string;
  errors?: string[] | string;
};

type ImportSummary = {
  ok?: boolean;
  dry_run?: boolean;
  total_rows?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  failed?: number;
  errors?: ImportErrorItem[];
  sample?: ImportSampleItem[];
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  data?: ImportSummary;
  errors?: string[] | string | Record<string, unknown>;
};

type AuthRecord = Record<string, unknown>;

type WhoAmIResponse = {
  ok?: boolean;
  data?: unknown;
  user?: unknown;
  role?: string;
  user_type?: string;
  is_superuser?: boolean;
  permission_codes?: string[];
  permissions?: {
    codes?: string[];
  };
  profile_permissions?: {
    codes?: string[];
  };
};

const LOCALE_STORAGE_KEY = "primey-locale";
const API_ENDPOINT = "/api/providers/import-excel/";

const dictionaries = {
  ar: {
    pageBadge: "شبكة الخدمة",
    title: "استيراد الشبكة الطبية",
    subtitle:
      "ارفع ملف Excel الخاص بالمراكز ومقدمي الخدمة، ثم راجع النتيجة قبل تنفيذ الحفظ.",
    back: "رجوع",
    providers: "مقدمو الخدمة",
    providersList: "قائمة مقدمي الخدمة",
    refresh: "تحديث",
    chooseFile: "اختيار ملف",
    removeFile: "إزالة الملف",
    noFile: "لم يتم اختيار ملف بعد",
    selectedFile: "الملف المحدد",
    supportedFormat: "الصيغة المعتمدة حاليًا هي Excel بصيغة .xlsx.",
    dropTitle: "اسحب ملف Excel هنا أو اختره من جهازك",
    dropSubtitle:
      "يفضل أن يحتوي الملف على: المنطقة، المدينة، الاسم العربي، الاسم الإنجليزي، التصنيف، السجل التجاري، الرقم الضريبي، العنوان، الحي، الشارع، الهاتف، الجوال، والملاحظات.",
    dryRun: "مراجعة قبل الحفظ",
    importNow: "تنفيذ الاستيراد",
    runningDryRun: "جاري المراجعة...",
    runningImport: "جاري الاستيراد...",
    permissionDeniedTitle: "لا توجد صلاحية كافية",
    permissionDeniedText:
      "لا يمكنك تنفيذ استيراد الشبكة الطبية من هذا الحساب.",
    uploadTitle: "ملف الاستيراد",
    uploadText:
      "ابدأ بالمراجعة قبل الحفظ للتأكد من عدد السجلات الجديدة والمحدّثة والمتجاهلة والفاشلة.",
    summaryTitle: "ملخص النتيجة",
    totalRows: "إجمالي الصفوف",
    created: "جديد",
    updated: "محدّث",
    skipped: "متجاهل",
    failed: "فاشل",
    dryRunBadge: "مراجعة فقط",
    savedBadge: "تم الحفظ",
    noResultTitle: "لم يتم تنفيذ أي مراجعة بعد",
    noResultText:
      "اختر ملف Excel ثم اضغط مراجعة قبل الحفظ لعرض ملخص البيانات.",
    errorsTitle: "ملاحظات وأخطاء الصفوف",
    sampleTitle: "عينة من النتائج",
    row: "صف",
    action: "الإجراء",
    provider: "مقدم الخدمة",
    nameAr: "الاسم العربي",
    nameEn: "الاسم الإنجليزي",
    city: "المدينة",
    category: "التصنيف",
    commercialRegistration: "السجل التجاري",
    taxNumber: "الرقم الضريبي",
    message: "الرسالة",
    createdAction: "جديد",
    updatedAction: "تحديث",
    skippedAction: "تجاهل",
    failedAction: "فشل",
    unknown: "غير محدد",
    emptyErrors: "لا توجد أخطاء في النتيجة الحالية.",
    invalidFileTitle: "صيغة الملف غير مناسبة",
    invalidFileText: "يرجى اختيار ملف Excel بصيغة .xlsx.",
    requestFailed: "تعذر تنفيذ العملية.",
    dryRunSuccess: "تمت مراجعة الملف بنجاح.",
    importSuccess: "تم استيراد البيانات بنجاح.",
    fileRequired: "اختر ملف Excel أولًا.",
    clear: "مسح النتيجة",
    tipsTitle: "تنبيهات مهمة",
    tipOne:
      "إعادة رفع نفس الملف ستحدّث السجلات بدل تكرارها عند تطابق مفتاح الاستيراد.",
    tipTwo:
      "يمكن أن يتكرر اسم مقدم الخدمة طبيعيًا حسب المدينة أو الفرع، لذلك يعتمد النظام على مفتاح استيراد آمن.",
    tipThree:
      "بعد الاستيراد يمكنك فتح صفحة التفاصيل ورفع الشعار والصورة والمرفقات إلى مجلد مقدم الخدمة في Google Drive.",
    tipFour:
      "إذا كان الملف يحتوي الاسم العربي والإنجليزي والسجل التجاري والرقم الضريبي فسيتم حفظها مباشرة عند الاستيراد.",
    legalReadiness: "البيانات النظامية",
    previewOnly: "المراجعة لا تحفظ البيانات حتى تضغط تنفيذ الاستيراد.",
    afterImport: "بعد الحفظ يمكنك مراجعة البيانات من قائمة مقدمي الخدمة.",
  },
  en: {
    pageBadge: "Service Network",
    title: "Import Medical Network",
    subtitle:
      "Upload the Excel file for centers and service providers, then review the result before saving.",
    back: "Back",
    providers: "Providers",
    providersList: "Providers List",
    refresh: "Refresh",
    chooseFile: "Choose file",
    removeFile: "Remove file",
    noFile: "No file selected yet",
    selectedFile: "Selected file",
    supportedFormat: "Currently supported format is .xlsx Excel.",
    dropTitle: "Drop the Excel file here or choose it from your device",
    dropSubtitle:
      "Recommended columns: region, city, Arabic name, English name, category, commercial registration, tax number, address, district, street, phone, mobile, and notes.",
    dryRun: "Review before saving",
    importNow: "Run import",
    runningDryRun: "Reviewing...",
    runningImport: "Importing...",
    permissionDeniedTitle: "Insufficient permission",
    permissionDeniedText:
      "This account cannot import the medical network.",
    uploadTitle: "Import file",
    uploadText:
      "Start with review before saving to verify created, updated, skipped, and failed rows.",
    summaryTitle: "Result summary",
    totalRows: "Total rows",
    created: "Created",
    updated: "Updated",
    skipped: "Skipped",
    failed: "Failed",
    dryRunBadge: "Review only",
    savedBadge: "Saved",
    noResultTitle: "No review has been run yet",
    noResultText:
      "Choose an Excel file, then review it before saving to see the summary.",
    errorsTitle: "Row notes and errors",
    sampleTitle: "Result sample",
    row: "Row",
    action: "Action",
    provider: "Provider",
    nameAr: "Arabic Name",
    nameEn: "English Name",
    city: "City",
    category: "Category",
    commercialRegistration: "Commercial Registration",
    taxNumber: "Tax Number",
    message: "Message",
    createdAction: "Created",
    updatedAction: "Updated",
    skippedAction: "Skipped",
    failedAction: "Failed",
    unknown: "Unknown",
    emptyErrors: "No errors in the current result.",
    invalidFileTitle: "Invalid file format",
    invalidFileText: "Please choose an .xlsx Excel file.",
    requestFailed: "The operation could not be completed.",
    dryRunSuccess: "File reviewed successfully.",
    importSuccess: "Data imported successfully.",
    fileRequired: "Choose an Excel file first.",
    clear: "Clear result",
    tipsTitle: "Important notes",
    tipOne:
      "Uploading the same file again updates records instead of duplicating them when the import key matches.",
    tipTwo:
      "Provider names may naturally repeat by city or branch, so the system uses a safe import key.",
    tipThree:
      "After import, open the detail page to upload the logo, image, and documents to the provider Google Drive folder.",
    tipFour:
      "If the file includes Arabic name, English name, commercial registration, and tax number, they will be stored during import.",
    legalReadiness: "Legal Data",
    previewOnly: "Review does not save data until you run the import.",
    afterImport: "After saving, review records from the providers list.",
  },
} as const;

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "ar";

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === "en" ? "en" : "ar";
}

function applyDocumentLocale(locale: Locale) {
  if (typeof document === "undefined") return;

  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  document.body.dir = locale === "ar" ? "rtl" : "ltr";
}

function getApiUrl(path: string): string {
  const rawBase =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  const base = rawBase.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (!base) return cleanPath;

  return `${base}${cleanPath}`;
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";

  const match = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.split("=")[1] || "") : "";
}

function asRecord(value: unknown): AuthRecord {
  return value && typeof value === "object" ? (value as AuthRecord) : {};
}

function asNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatNumber(value: unknown): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(asNumber(value));
}

function isXlsxFile(file: File | null): boolean {
  if (!file) return false;
  return file.name.toLowerCase().endsWith(".xlsx");
}

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";

  const kb = size / 1024;

  if (kb < 1024) {
    return `${new Intl.NumberFormat("en-US").format(Math.ceil(kb))} KB`;
  }

  const mb = kb / 1024;

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(mb)} MB`;
}

function normalizeErrors(errors: unknown): string {
  if (!errors) return "";

  if (Array.isArray(errors)) {
    return errors.filter(Boolean).join("، ");
  }

  if (typeof errors === "string") return errors;

  if (typeof errors === "object") {
    return Object.entries(errors as Record<string, unknown>)
      .map(([key, value]) => {
        if (Array.isArray(value)) return `${key}: ${value.join("، ")}`;
        return `${key}: ${String(value)}`;
      })
      .join("، ");
  }

  return "";
}

function getActionLabel(action: string | undefined, locale: Locale): string {
  const t = dictionaries[locale];

  if (action === "created") return t.createdAction;
  if (action === "updated") return t.updatedAction;
  if (action === "skipped") return t.skippedAction;
  if (action === "failed") return t.failedAction;

  return t.unknown;
}

function getActionBadgeClass(action: string | undefined): string {
  if (action === "created") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (action === "updated") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (action === "skipped") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (action === "failed") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function collectPermissionCodes(value: unknown): string[] {
  const codes = new Set<string>();

  const visit = (item: unknown) => {
    if (!item) return;

    if (typeof item === "string") {
      codes.add(item);
      return;
    }

    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }

    if (typeof item === "object") {
      const record = item as Record<string, unknown>;

      visit(record.permission_codes);
      visit(record.permissions);
      visit(record.profile_permissions);
      visit(record.codes);

      const nestedCodes = asRecord(record.permissions).codes;
      const profileCodes = asRecord(record.profile_permissions).codes;

      visit(nestedCodes);
      visit(profileCodes);

      if (typeof record.code === "string") {
        codes.add(record.code);
      }
    }
  };

  visit(value);

  return Array.from(codes);
}

function getRoleFlags(value: unknown): {
  isSystemAdmin: boolean;
  isSuperuser: boolean;
} {
  const payload = asRecord(value);
  const nested = asRecord(payload.data);
  const user = asRecord(payload.user || nested.user);

  const role = String(
    payload.role || nested.role || user.role || "",
  ).toLowerCase();

  const userType = String(
    payload.user_type || nested.user_type || user.user_type || "",
  ).toLowerCase();

  const roles = [
    role,
    userType,
    ...String(payload.roles || "")
      .split(",")
      .map((item) => item.trim().toLowerCase()),
  ];

  return {
    isSystemAdmin: roles.some((item) =>
      [
        "system_admin",
        "superuser",
        "super_admin",
        "superadmin",
        "admin",
        "administrator",
      ].includes(item),
    ),
    isSuperuser:
      payload.is_superuser === true ||
      nested.is_superuser === true ||
      user.is_superuser === true,
  };
}

function canImportProvidersFromWhoami(payload: unknown): PermissionStatus {
  if (!payload) return "allowed";

  const flags = getRoleFlags(payload);

  if (flags.isSuperuser || flags.isSystemAdmin) {
    return "allowed";
  }

  const codes = collectPermissionCodes(payload);
  const hasCodes = codes.length > 0;

  if (!hasCodes) {
    return "allowed";
  }

  const allowedCodes = new Set([
    "providers.import",
    "providers.create",
    "providers.edit",
    "providers.view",
  ]);

  return codes.some((code) => allowedCodes.has(code)) ? "allowed" : "denied";
}

function getSampleProviderName(item: ImportSampleItem, locale: Locale) {
  const provider = item.provider;

  if (!provider) return dictionaries[locale].unknown;

  return (
    provider.name_ar ||
    provider.name ||
    provider.name_en ||
    dictionaries[locale].unknown
  );
}

function getSampleProviderEnglishName(item: ImportSampleItem, locale: Locale) {
  const provider = item.provider;

  if (!provider) return dictionaries[locale].unknown;

  return provider.name_en || "-";
}

function getSampleProviderLegalData(item: ImportSampleItem, locale: Locale) {
  const provider = item.provider;
  const t = dictionaries[locale];

  if (!provider) return t.unknown;

  const cr = provider.commercial_registration || "-";
  const tax = provider.tax_number || "-";

  return `${t.commercialRegistration}: ${cr} | ${t.taxNumber}: ${tax}`;
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: unknown;
  icon: typeof FileSpreadsheet;
  tone: string;
}) {
  return (
    <Card className={`rounded-2xl border bg-gradient-to-br ${tone}`}>
      <CardContent className="flex items-center justify-between gap-4 p-4 sm:p-5">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">
            {formatNumber(value)}
          </p>
        </div>
        <div className="rounded-2xl bg-background/80 p-3 text-[#432a58] shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function SystemProvidersImportPage() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus>("checking");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [pageError, setPageError] = useState<string>("");
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const t = dictionaries[locale];
  const isRtl = locale === "ar";
  const isBusy = isDryRunning || isImporting;
  const isAllowed = permissionStatus !== "denied";
  const hasValidFile = isXlsxFile(file);

  const summaryCards = useMemo(
    () => [
      {
        label: t.totalRows,
        value: result?.total_rows,
        icon: FileSpreadsheet,
        tone: "from-slate-50 to-white",
      },
      {
        label: t.created,
        value: result?.created,
        icon: CheckCircle2,
        tone: "from-emerald-50 to-white",
      },
      {
        label: t.updated,
        value: result?.updated,
        icon: RefreshCcw,
        tone: "from-blue-50 to-white",
      },
      {
        label: t.skipped,
        value: result?.skipped,
        icon: Info,
        tone: "from-amber-50 to-white",
      },
      {
        label: t.failed,
        value: result?.failed,
        icon: AlertCircle,
        tone: "from-red-50 to-white",
      },
    ],
    [result, t],
  );

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = getInitialLocale();

      setLocale(nextLocale);
      applyDocumentLocale(nextLocale);
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
    let mounted = true;

    async function checkPermission() {
      try {
        const response = await fetch(getApiUrl("/api/auth/whoami/"), {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        if (!mounted) return;

        if (!response.ok) {
          setPermissionStatus("allowed");
          return;
        }

        const payload = (await response.json()) as WhoAmIResponse;
        setPermissionStatus(canImportProvidersFromWhoami(payload));
      } catch {
        if (mounted) {
          setPermissionStatus("allowed");
        }
      }
    }

    checkPermission();

    return () => {
      mounted = false;
    };
  }, []);

  const clearSelection = useCallback(() => {
    setFile(null);
    setResult(null);
    setPageError("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  const selectFile = useCallback(
    (nextFile: File | null) => {
      setPageError("");
      setResult(null);

      if (!nextFile) {
        setFile(null);
        return;
      }

      if (!isXlsxFile(nextFile)) {
        setFile(null);
        toast.error(t.invalidFileTitle, {
          description: t.invalidFileText,
        });

        if (inputRef.current) {
          inputRef.current.value = "";
        }

        return;
      }

      setFile(nextFile);
    },
    [t.invalidFileText, t.invalidFileTitle],
  );

  const runImportRequest = useCallback(
    async (dryRun: boolean) => {
      if (!file) {
        toast.error(t.fileRequired);
        return;
      }

      if (!isXlsxFile(file)) {
        toast.error(t.invalidFileTitle, {
          description: t.invalidFileText,
        });
        return;
      }

      if (!isAllowed) {
        toast.error(t.permissionDeniedTitle, {
          description: t.permissionDeniedText,
        });
        return;
      }

      setPageError("");

      if (dryRun) {
        setIsDryRunning(true);
      } else {
        setIsImporting(true);
      }

      try {
        const csrfToken = readCookie("csrftoken");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("dry_run", dryRun ? "true" : "false");

        const response = await fetch(getApiUrl(API_ENDPOINT), {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
          },
          body: formData,
        });

        const payload = (await response.json().catch(() => ({}))) as ApiResponse;

        if (!response.ok || payload.ok === false) {
          const errorMessage =
            normalizeErrors(payload.errors) ||
            payload.message ||
            t.requestFailed;

          setPageError(errorMessage);
          toast.error(t.requestFailed, {
            description: errorMessage,
          });
          return;
        }

        const nextResult = payload.data || null;
        setResult(nextResult);

        toast.success(dryRun ? t.dryRunSuccess : t.importSuccess);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t.requestFailed;

        setPageError(message);
        toast.error(t.requestFailed, {
          description: message,
        });
      } finally {
        setIsDryRunning(false);
        setIsImporting(false);
      }
    },
    [
      file,
      isAllowed,
      t.dryRunSuccess,
      t.fileRequired,
      t.importSuccess,
      t.invalidFileText,
      t.invalidFileTitle,
      t.permissionDeniedText,
      t.permissionDeniedTitle,
      t.requestFailed,
    ],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);

      const nextFile = event.dataTransfer.files?.[0] || null;
      selectFile(nextFile);
    },
    [selectFile],
  );

  if (permissionStatus === "checking") {
    return (
      <div className="w-full space-y-4" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between gap-3">
          <SkeletonLine className="h-10 w-60" />
          <SkeletonLine className="h-10 w-40" />
        </div>
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="space-y-3 p-5">
            <SkeletonLine className="h-8 w-72" />
            <SkeletonLine className="h-4 w-full" />
            <SkeletonLine className="h-64 w-full rounded-3xl" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full border border-[#432a58]/15 bg-[#432a58]/10 px-3 py-1 text-[#432a58] hover:bg-[#432a58]/10">
              {t.pageBadge}
            </Badge>

            {result ? (
              <Badge
                className={
                  result.dry_run
                    ? "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50"
                    : "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50"
                }
              >
                {result.dry_run ? t.dryRunBadge : t.savedBadge}
              </Badge>
            ) : null}
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
              {t.title}
            </h1>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
              {t.subtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button asChild variant="outline" className="h-10 rounded-xl">
            <Link href="/system/providers">
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-10 rounded-xl">
            <Link href="/system/providers/list">
              <ClipboardList className="h-4 w-4" />
              <span>{t.providersList}</span>
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            disabled={isBusy}
            onClick={() => {
              setResult(null);
              setPageError("");
              toast.success(t.refresh);
            }}
          >
            <RefreshCcw className="h-4 w-4" />
            <span>{t.refresh}</span>
          </Button>
        </div>
      </div>

      {permissionStatus === "denied" ? (
        <Card className="rounded-2xl border border-amber-200 bg-amber-50/70 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-amber-100 p-2 text-amber-700">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-amber-900">
                  {t.permissionDeniedTitle}
                </h2>
                <p className="text-sm leading-6 text-amber-800">
                  {t.permissionDeniedText}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {pageError ? (
        <Card className="rounded-2xl border border-red-200 bg-red-50/70 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4 sm:p-5">
            <div className="rounded-2xl bg-red-100 p-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="font-semibold text-red-900">
                {t.requestFailed}
              </h2>
              <p className="text-sm leading-6 text-red-800">{pageError}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UploadCloud className="h-5 w-5 text-[#432a58]" />
              {t.uploadTitle}
            </CardTitle>
            <CardDescription>{t.uploadText}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  inputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={[
                "flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed p-6 text-center transition",
                isDragging
                  ? "border-[#432a58] bg-[#432a58]/10"
                  : "border-border bg-background hover:border-[#432a58]/50 hover:bg-[#432a58]/5",
              ].join(" ")}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                disabled={isBusy || !isAllowed}
                onChange={(event) => {
                  selectFile(event.target.files?.[0] || null);
                }}
              />

              <div className="mb-4 rounded-3xl bg-[#432a58]/10 p-4 text-[#432a58]">
                <FileSpreadsheet className="h-10 w-10" />
              </div>

              <h2 className="text-lg font-semibold">{t.dropTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                {t.dropSubtitle}
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  className="rounded-xl bg-[#432a58] text-white hover:bg-[#432a58]/90"
                  disabled={isBusy || !isAllowed}
                  onClick={(event) => {
                    event.stopPropagation();
                    inputRef.current?.click();
                  }}
                >
                  <UploadCloud className="h-4 w-4" />
                  {t.chooseFile}
                </Button>

                {file ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    disabled={isBusy}
                    onClick={(event) => {
                      event.stopPropagation();
                      clearSelection();
                    }}
                  >
                    <X className="h-4 w-4" />
                    {t.removeFile}
                  </Button>
                ) : null}
              </div>
            </div>

            <Card className="rounded-2xl border bg-muted/40">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    {file ? t.selectedFile : t.noFile}
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {file
                      ? `${file.name} • ${formatFileSize(file.size)}`
                      : t.supportedFormat}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    disabled={!hasValidFile || isBusy || !isAllowed}
                    onClick={() => runImportRequest(true)}
                  >
                    {isDryRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Info className="h-4 w-4" />
                    )}
                    {isDryRunning ? t.runningDryRun : t.dryRun}
                  </Button>

                  <Button
                    type="button"
                    className="rounded-xl bg-[#432a58] text-white hover:bg-[#432a58]/90"
                    disabled={!hasValidFile || isBusy || !isAllowed}
                    onClick={() => runImportRequest(false)}
                  >
                    {isImporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {isImporting ? t.runningImport : t.importNow}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Info className="h-5 w-5 text-[#432a58]" />
                {t.tipsTitle}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {[t.tipOne, t.tipTwo, t.tipThree, t.tipFour].map((tip) => (
                <div
                  key={tip}
                  className="flex gap-3 rounded-2xl border bg-background p-3"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#432a58]" />
                  <p className="text-sm leading-6 text-muted-foreground">
                    {tip}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start gap-3 rounded-2xl border bg-background p-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 text-[#432a58]" />
                <p className="text-sm leading-6 text-muted-foreground">
                  {t.previewOnly}
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border bg-background p-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-[#432a58]" />
                <p className="text-sm leading-6 text-muted-foreground">
                  {t.afterImport}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <SummaryCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
          />
        ))}
      </div>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">{t.summaryTitle}</CardTitle>
            <CardDescription>
              {result ? t.sampleTitle : t.noResultText}
            </CardDescription>
          </div>

          {result ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setResult(null);
                setPageError("");
              }}
            >
              <X className="h-4 w-4" />
              {t.clear}
            </Button>
          ) : null}
        </CardHeader>

        <CardContent>
          {!result ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-3xl border border-dashed bg-muted/30 p-6 text-center">
              <div className="mb-3 rounded-3xl bg-background p-4 text-[#432a58] shadow-sm">
                <FileSpreadsheet className="h-8 w-8" />
              </div>
              <h2 className="text-base font-semibold">{t.noResultTitle}</h2>
              <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
                {t.noResultText}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-start font-semibold">
                        {t.row}
                      </th>
                      <th className="px-4 py-3 text-start font-semibold">
                        {t.action}
                      </th>
                      <th className="px-4 py-3 text-start font-semibold">
                        {t.nameAr}
                      </th>
                      <th className="px-4 py-3 text-start font-semibold">
                        {t.nameEn}
                      </th>
                      <th className="px-4 py-3 text-start font-semibold">
                        {t.city}
                      </th>
                      <th className="px-4 py-3 text-start font-semibold">
                        {t.category}
                      </th>
                      <th className="px-4 py-3 text-start font-semibold">
                        {t.legalReadiness}
                      </th>
                      <th className="px-4 py-3 text-start font-semibold">
                        {t.message}
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y bg-background">
                    {(result.sample || []).length > 0 ? (
                      (result.sample || []).map((item, index) => (
                        <tr
                          key={`${item.row_number || index}-${
                            item.action || "row"
                          }`}
                        >
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatNumber(item.row_number || index + 1)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={`rounded-full px-3 py-1 ${getActionBadgeClass(
                                item.action,
                              )}`}
                            >
                              {getActionLabel(item.action, locale)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {getSampleProviderName(item, locale)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {getSampleProviderEnglishName(item, locale)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {item.provider?.city || t.unknown}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {item.provider?.source_category || t.unknown}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {getSampleProviderLegalData(item, locale)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {item.message || t.unknown}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          className="px-4 py-10 text-center text-muted-foreground"
                          colSpan={8}
                        >
                          {t.noResultText}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {result ? (
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5 text-[#432a58]" />
              {t.errorsTitle}
            </CardTitle>
          </CardHeader>

          <CardContent>
            {(result.errors || []).length === 0 ? (
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-800">
                {t.emptyErrors}
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-muted/60 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-start font-semibold">
                          {t.row}
                        </th>
                        <th className="px-4 py-3 text-start font-semibold">
                          {t.provider}
                        </th>
                        <th className="px-4 py-3 text-start font-semibold">
                          {t.message}
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y bg-background">
                      {(result.errors || []).map((item, index) => (
                        <tr key={`${item.row_number || index}-${item.message}`}>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatNumber(item.row_number || index + 1)}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {item.name || t.unknown}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {item.message || normalizeErrors(item.errors) || t.unknown}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}