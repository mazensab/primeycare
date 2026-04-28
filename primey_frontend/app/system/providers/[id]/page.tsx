"use client";

/* ============================================================
   📂 app/system/providers/[id]/page.tsx
   🧠 Primey Care | Provider Details
   ------------------------------------------------------------
   ✅ المسار: /system/providers/[id]
   ✅ الإصدار: v1.0.0
   ✅ العمل: عرض تفاصيل مقدم خدمة
   ✅ API:
      - GET    /api/providers/{id}/
      - DELETE /api/providers/{id}/
   ✅ متوافق مع:
      - /system/providers
      - /system/providers/list
      - /system/providers/create
      - /system/providers/reports
      - /system/providers/[id]
   ------------------------------------------------------------
   تحسينات هذا الإصدار:
   - توثيق مختصر أعلى الملف
   - عرض تفاصيل مقدم الخدمة من API فعلي
   - حذف مقدم الخدمة مع CSRF
   - تجهيز أقسام العقود والخدمات والمدفوعات والطلبات
   - دعم عربي / إنجليزي عبر primey-locale
   - الأرقام والتواريخ دائمًا بالإنجليزي
   - استخدام sonner للتنبيهات
   - بدون localhost hardcoded
   - الحفاظ على التصميم السابق بدون كسر الواجهة
============================================================ */

import type { ComponentType } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCcw,
  ShieldCheck,
  Star,
  Trash2Icon,
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

type ProviderStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "DRAFT"
  | "UNKNOWN";

type ProviderType =
  | "HOSPITAL"
  | "MEDICAL_CENTER"
  | "PHARMACY"
  | "PARTNER"
  | "LAB"
  | "CLINIC"
  | "OTHER"
  | "UNKNOWN";

type ProviderDetail = {
  id: number | string;
  name: string;
  code: string;
  providerType: ProviderType;
  status: ProviderStatus;
  contactPerson: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  city: string;
  area: string;
  address: string;
  googleMapsLink: string;
  notes: string;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, unknown>;
};

type ProviderDetailResponse = {
  ok?: boolean;
  message?: string;
  data?: unknown;
  provider?: unknown;
  center?: unknown;
};

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

function getCookie(name: string) {
  if (typeof document === "undefined") return "";

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || "";
  }

  return "";
}

function formatNumber(value: number | string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "0";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatDate(value: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

/* ============================================================
   Normalizers
============================================================ */

function normalizeStatus(value: unknown): ProviderStatus {
  const status = String(value || "").toUpperCase();

  if (status === "ACTIVE") return "ACTIVE";
  if (status === "INACTIVE") return "INACTIVE";
  if (status === "SUSPENDED") return "SUSPENDED";
  if (status === "DRAFT") return "DRAFT";

  if (value === true) return "ACTIVE";
  if (value === false) return "INACTIVE";

  return "UNKNOWN";
}

function normalizeProviderType(value: unknown): ProviderType {
  const providerType = String(value || "").toUpperCase();

  if (providerType === "HOSPITAL") return "HOSPITAL";
  if (providerType === "MEDICAL_CENTER") return "MEDICAL_CENTER";
  if (providerType === "PHARMACY") return "PHARMACY";
  if (providerType === "PARTNER") return "PARTNER";
  if (providerType === "LAB") return "LAB";
  if (providerType === "CLINIC") return "CLINIC";
  if (providerType === "OTHER") return "OTHER";

  return "UNKNOWN";
}

function normalizeProvider(item: unknown): ProviderDetail {
  const obj = (item || {}) as Record<string, unknown>;

  return {
    id: (obj.id ?? "-") as number | string,
    name: String(obj.name ?? obj.title ?? "-"),
    code: String(obj.code ?? obj.provider_code ?? "-"),
    providerType: normalizeProviderType(
      obj.provider_type ?? obj.type ?? obj.category,
    ),
    status: normalizeStatus(obj.status ?? obj.is_active),
    contactPerson: String(obj.contact_person ?? obj.contact_name ?? ""),
    phone: String(obj.phone ?? ""),
    mobile: String(obj.mobile ?? obj.phone_number ?? ""),
    email: String(obj.email ?? ""),
    website: String(obj.website ?? ""),
    city: String(obj.city ?? ""),
    area: String(obj.area ?? obj.region ?? ""),
    address: String(obj.address ?? ""),
    googleMapsLink: String(obj.google_maps_link ?? obj.map_url ?? ""),
    notes: String(obj.notes ?? ""),
    isFeatured: Boolean(obj.is_featured ?? obj.featured),
    createdAt: String(obj.created_at ?? ""),
    updatedAt: String(obj.updated_at ?? ""),
    raw: obj,
  };
}

function extractProvider(payload: ProviderDetailResponse | unknown) {
  const response = (payload || {}) as ProviderDetailResponse;

  return response.data ?? response.provider ?? response.center ?? payload;
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "تفاصيل مقدم الخدمة" : "Provider Details",
    subtitle: isArabic
      ? "عرض ملف مقدم الخدمة، بيانات التواصل، الموقع، الحالة التشغيلية، والروابط المرتبطة."
      : "View provider profile, contact details, location, operational status, and linked areas.",

    back: isArabic ? "رجوع" : "Back",
    refresh: isArabic ? "تحديث" : "Refresh",
    delete: isArabic ? "حذف" : "Delete",
    list: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",

    overview: isArabic ? "نظرة عامة" : "Overview",
    details: isArabic ? "البيانات التفصيلية" : "Detailed Information",
    profileDesc: isArabic
      ? "جميع بيانات مقدم الخدمة الحالية من قاعدة البيانات."
      : "All current provider data from the database.",

    operationalLinks: isArabic ? "الروابط التشغيلية" : "Operational Links",
    operationalDesc: isArabic
      ? "الأقسام التي سيتم ربط مقدم الخدمة بها داخل النظام."
      : "Sections that this provider can be linked with inside the system.",

    notes: isArabic ? "الملاحظات" : "Notes",
    noNotes: isArabic ? "لا توجد ملاحظات مسجلة." : "No notes recorded.",

    profileCompletion: isArabic ? "اكتمال الملف" : "Profile Completion",

    loading: isArabic
      ? "جاري تحميل تفاصيل مقدم الخدمة..."
      : "Loading provider details...",
    notFound: isArabic
      ? "لم يتم العثور على مقدم الخدمة"
      : "Provider not found",
    notFoundDesc: isArabic
      ? "قد يكون السجل محذوفًا أو الرابط غير صحيح."
      : "The record may have been deleted or the link is invalid.",
    apiError: isArabic
      ? "تعذر تحميل تفاصيل مقدم الخدمة."
      : "Unable to load provider details.",
    refreshSuccess: isArabic
      ? "تم تحديث تفاصيل مقدم الخدمة بنجاح"
      : "Provider details refreshed successfully",
    deleteConfirm: isArabic
      ? "هل تريد حذف مقدم الخدمة؟ لا يمكن التراجع عن العملية."
      : "Do you want to delete this provider? This action cannot be undone.",
    deleteSuccess: isArabic
      ? "تم حذف مقدم الخدمة بنجاح"
      : "Provider deleted successfully",
    deleteError: isArabic
      ? "تعذر حذف مقدم الخدمة"
      : "Unable to delete provider",

    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",

    fields: {
      id: isArabic ? "المعرف" : "ID",
      name: isArabic ? "اسم مقدم الخدمة" : "Provider Name",
      code: isArabic ? "الكود" : "Code",
      providerType: isArabic ? "نوع مقدم الخدمة" : "Provider Type",
      status: isArabic ? "الحالة" : "Status",
      contactPerson: isArabic ? "الشخص المسؤول" : "Contact Person",
      phone: isArabic ? "الهاتف" : "Phone",
      mobile: isArabic ? "الجوال" : "Mobile",
      email: isArabic ? "البريد الإلكتروني" : "Email",
      website: isArabic ? "الموقع الإلكتروني" : "Website",
      city: isArabic ? "المدينة" : "City",
      area: isArabic ? "المنطقة / الحي" : "Area",
      address: isArabic ? "العنوان" : "Address",
      maps: isArabic ? "رابط الخرائط" : "Maps Link",
      featured: isArabic ? "مميز" : "Featured",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isArabic ? "آخر تحديث" : "Updated At",
    },

    cards: {
      contracts: isArabic ? "العقود" : "Contracts",
      contractsDesc: isArabic
        ? "ربط مقدم الخدمة بعقود الخصومات والخدمات."
        : "Link the provider with discount and service contracts.",
      services: isArabic ? "الخدمات" : "Services",
      servicesDesc: isArabic
        ? "تعريف الخدمات والأسعار والخصومات المرتبطة."
        : "Define linked services, prices, and discounts.",
      payments: isArabic ? "المدفوعات" : "Payments",
      paymentsDesc: isArabic
        ? "متابعة المستحقات والحركات المالية."
        : "Track dues and financial movements.",
      orders: isArabic ? "الطلبات" : "Orders",
      ordersDesc: isArabic
        ? "متابعة الطلبات المرتبطة بمقدم الخدمة."
        : "Track orders linked with the provider.",
    },

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

    statusLabels: {
      ACTIVE: isArabic ? "نشط" : "Active",
      INACTIVE: isArabic ? "غير نشط" : "Inactive",
      SUSPENDED: isArabic ? "موقوف" : "Suspended",
      DRAFT: isArabic ? "مسودة" : "Draft",
      UNKNOWN: isArabic ? "غير محدد" : "Unknown",
    } satisfies Record<ProviderStatus, string>,
  };
}

/* ============================================================
   UI Helpers
============================================================ */

function statusBadge(status: ProviderStatus, locale: AppLocale) {
  const isArabic = locale === "ar";

  if (status === "ACTIVE") {
    return (
      <Badge className="rounded-full px-3 py-1">
        {isArabic ? "نشط" : "Active"}
      </Badge>
    );
  }

  if (status === "DRAFT") {
    return (
      <Badge variant="secondary" className="rounded-full px-3 py-1">
        {isArabic ? "مسودة" : "Draft"}
      </Badge>
    );
  }

  if (status === "SUSPENDED") {
    return (
      <Badge variant="destructive" className="rounded-full px-3 py-1">
        {isArabic ? "موقوف" : "Suspended"}
      </Badge>
    );
  }

  if (status === "INACTIVE") {
    return (
      <Badge variant="outline" className="rounded-full px-3 py-1">
        {isArabic ? "غير نشط" : "Inactive"}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {isArabic ? "غير محدد" : "Unknown"}
    </Badge>
  );
}

function calculateProfileCompleteness(provider: ProviderDetail) {
  const fields = [
    provider.name,
    provider.code,
    provider.providerType,
    provider.status,
    provider.contactPerson,
    provider.phone || provider.mobile,
    provider.email,
    provider.website,
    provider.city,
    provider.area,
    provider.address,
    provider.googleMapsLink,
    provider.notes,
  ];

  const completed = fields.filter((field) => String(field || "").trim()).length;

  return Math.round((completed / fields.length) * 100);
}

function isValidExternalLink(value?: string) {
  if (!value) return false;
  return value.startsWith("https://") || value.startsWith("http://");
}

/* ============================================================
   Page
============================================================ */

export default function SystemProviderDetailPage() {
  const params = useParams<{ id?: string }>();
  const router = useRouter();

  const providerId = params?.id;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [provider, setProvider] = useState<ProviderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);

  const profileCompleteness = useMemo(() => {
    if (!provider) return 0;
    return calculateProfileCompleteness(provider);
  }, [provider]);

  const syncLocale = useCallback(() => {
    const nextLocale = readLocale();

    setLocale(nextLocale);
    applyDocumentLocale(nextLocale);
  }, []);

  const loadProvider = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!providerId) return;

      try {
        if (options?.silent) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const response = await fetch(`/api/providers/${providerId}/`, {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Provider API failed with status ${response.status}`);
        }

        const payload = (await response.json()) as ProviderDetailResponse;
        const rawProvider = extractProvider(payload);

        if (!rawProvider) {
          setProvider(null);
          return;
        }

        setProvider(normalizeProvider(rawProvider));

        if (options?.silent) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Load provider detail error:", error);
        setProvider(null);
        toast.error(t.apiError);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [providerId, t.apiError, t.refreshSuccess],
  );

  async function handleDelete() {
    if (!providerId) return;

    const confirmed = window.confirm(t.deleteConfirm);
    if (!confirmed) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/providers/${providerId}/`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
      });

      const payload = (await response.json().catch(() => null)) as
        | ProviderDetailResponse
        | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message || t.deleteError);
      }

      toast.success(t.deleteSuccess);
      router.push("/system/providers/list");
      router.refresh();
    } catch (error) {
      console.error("Delete provider error:", error);
      toast.error(t.deleteError, {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    syncLocale();

    const handleLocaleChange = () => syncLocale();

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "primey-locale") syncLocale();
    };

    window.addEventListener("primey-locale-changed", handleLocaleChange);
    window.addEventListener("storage", handleStorageChange);

    const timer = window.setTimeout(syncLocale, 50);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("primey-locale-changed", handleLocaleChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [syncLocale]);

  useEffect(() => {
    loadProvider();
  }, [loadProvider]);

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t.loading}</span>
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="space-y-6">
        <div className="flex justify-start">
          <Link href="/system/providers/list">
            <Button variant="outline" className="rounded-xl">
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>
        </div>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>

            <h1 className="text-xl font-bold">{t.notFound}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.notFoundDesc}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="order-2 flex flex-wrap items-center gap-2 lg:order-1">
          <Link href="/system/providers/list">
            <Button variant="outline" className="rounded-xl">
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => loadProvider({ silent: true })}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          <Button
            variant="destructive"
            className="rounded-xl"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2Icon className="h-4 w-4" />
            )}
            <span>{t.delete}</span>
          </Button>
        </div>

        <div className="order-1 max-w-3xl space-y-2 text-right lg:order-2">
          <div className="flex justify-end gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {t.list}
            </Badge>

            <Badge variant="outline" className="rounded-full px-3 py-1">
              {provider.code && provider.code !== "-"
                ? provider.code
                : `#${provider.id}`}
            </Badge>
          </div>

          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t.title}
          </h1>

          <p className="text-sm leading-7 text-muted-foreground md:text-base">
            {t.subtitle}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.42fr_1fr]">
        {/* Left Profile */}
        <div className="space-y-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-5 p-6">
              <div className="flex justify-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-muted shadow-sm">
                  <Building2 className="h-14 w-14 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-2 text-center">
                <h2 className="text-lg font-bold">{provider.name}</h2>

                <p className="text-sm text-muted-foreground">
                  {t.typeLabels[provider.providerType]}
                </p>

                <div className="flex justify-center">
                  {statusBadge(provider.status, locale)}
                </div>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {t.profileCompletion}
                  </p>

                  <Badge variant="outline" className="rounded-full">
                    {formatNumber(profileCompleteness)}%
                  </Badge>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${profileCompleteness}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <MiniInfo
                  icon={Phone}
                  label={t.fields.mobile}
                  value={provider.mobile || provider.phone || "-"}
                />

                <MiniInfo
                  icon={Mail}
                  label={t.fields.email}
                  value={provider.email || "-"}
                />

                <MiniInfo
                  icon={MapPin}
                  label={t.fields.city}
                  value={provider.city || provider.area || "-"}
                />

                <MiniInfo
                  icon={Globe}
                  label={t.fields.website}
                  value={provider.website || "-"}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Details */}
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={ShieldCheck}
              label={t.fields.status}
              value={t.statusLabels[provider.status]}
            />

            <MetricCard
              icon={Building2}
              label={t.fields.providerType}
              value={t.typeLabels[provider.providerType]}
            />

            <MetricCard
              icon={Star}
              label={t.fields.featured}
              value={provider.isFeatured ? t.yes : t.no}
            />

            <MetricCard
              icon={CalendarDays}
              label={t.fields.updatedAt}
              value={formatDate(provider.updatedAt)}
            />
          </div>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3 text-right">
              <CardTitle className="text-base font-bold">
                {t.details}
              </CardTitle>
              <CardDescription>{t.profileDesc}</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableBody>
                    <DetailRow label={t.fields.id} value={String(provider.id)} />
                    <DetailRow label={t.fields.name} value={provider.name} />
                    <DetailRow label={t.fields.code} value={provider.code} />

                    <DetailRow
                      label={t.fields.providerType}
                      value={t.typeLabels[provider.providerType]}
                    />

                    <DetailRow
                      label={t.fields.status}
                      value={t.statusLabels[provider.status]}
                    />

                    <DetailRow
                      label={t.fields.contactPerson}
                      value={provider.contactPerson || "-"}
                    />

                    <DetailRow
                      label={t.fields.phone}
                      value={provider.phone || "-"}
                    />

                    <DetailRow
                      label={t.fields.mobile}
                      value={provider.mobile || "-"}
                    />

                    <DetailRow
                      label={t.fields.email}
                      value={provider.email || "-"}
                    />

                    <DetailRow
                      label={t.fields.website}
                      value={provider.website || "-"}
                      link={provider.website}
                    />

                    <DetailRow
                      label={t.fields.city}
                      value={provider.city || "-"}
                    />

                    <DetailRow
                      label={t.fields.area}
                      value={provider.area || "-"}
                    />

                    <DetailRow
                      label={t.fields.address}
                      value={provider.address || "-"}
                    />

                    <DetailRow
                      label={t.fields.maps}
                      value={provider.googleMapsLink || "-"}
                      link={provider.googleMapsLink}
                    />

                    <DetailRow
                      label={t.fields.createdAt}
                      value={formatDate(provider.createdAt)}
                    />

                    <DetailRow
                      label={t.fields.updatedAt}
                      value={formatDate(provider.updatedAt)}
                    />
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3 text-right">
              <CardTitle className="text-base font-bold">
                {t.operationalLinks}
              </CardTitle>
              <CardDescription>{t.operationalDesc}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <OperationCard
                icon={FileText}
                title={t.cards.contracts}
                description={t.cards.contractsDesc}
              />

              <OperationCard
                icon={Activity}
                title={t.cards.services}
                description={t.cards.servicesDesc}
              />

              <OperationCard
                icon={Wallet}
                title={t.cards.payments}
                description={t.cards.paymentsDesc}
              />

              <OperationCard
                icon={CheckCircle2}
                title={t.cards.orders}
                description={t.cards.ordersDesc}
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3 text-right">
              <CardTitle className="text-base font-bold">{t.notes}</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="rounded-xl border bg-background p-4 text-right text-sm leading-7 text-muted-foreground">
                {provider.notes || t.noNotes}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Small Components
============================================================ */

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="hover:border-primary/30 grid auto-cols-max grid-flow-col gap-4 rounded-lg border bg-muted p-4">
      <Icon className="size-6 opacity-40" />

      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="truncate text-lg font-semibold">{value}</span>
      </div>
    </div>
  );
}

function MiniInfo({
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
        <p className="mt-1 truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  link,
}: {
  label: string;
  value: string;
  link?: string;
}) {
  const hasLink = isValidExternalLink(link);

  return (
    <TableRow>
      <TableCell className="w-[220px] bg-muted/50 font-medium">
        {label}
      </TableCell>

      <TableCell>
        {hasLink ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-2 text-primary hover:underline"
          >
            <span className="max-w-[420px] truncate">{value}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span>{value}</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function OperationCard({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-5 w-5" />
      </div>

      <p className="font-semibold">{title}</p>

      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}