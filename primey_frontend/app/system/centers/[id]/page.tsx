"use client";

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
  Edit3Icon,
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
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";

/* ============================================================
   📂 app/system/centers/[id]/page.tsx
   🧠 Primey Care | Center Detail Page
   ------------------------------------------------------------
   ✅ تصميم قريب من صفحة التفاصيل المدفوعة المرفقة
   ✅ استخدام UI الداخلي فقط
   ✅ ربط حقيقي مع GET /api/providers/<id>/
   ✅ دعم عربي / إنجليزي
   ✅ بدون localhost hardcoded
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

type CenterDetail = {
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
   🌐 Locale Helpers
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
   🔁 API Normalizers
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

function normalizeCenterDetail(payload: unknown): CenterDetail {
  const wrapper = (payload || {}) as ProviderDetailResponse;
  const obj = ((wrapper.data ||
    wrapper.provider ||
    wrapper.center ||
    payload ||
    {}) as Record<string, unknown>);

  return {
    id: (obj.id ?? "-") as number | string,
    name: String(obj.name ?? "-"),
    code: String(obj.code ?? "-"),
    providerType: normalizeProviderType(obj.provider_type),
    status: normalizeStatus(obj.status),
    contactPerson: String(obj.contact_person ?? ""),
    phone: String(obj.phone ?? ""),
    mobile: String(obj.mobile ?? ""),
    email: String(obj.email ?? ""),
    website: String(obj.website ?? ""),
    city: String(obj.city ?? ""),
    area: String(obj.area ?? ""),
    address: String(obj.address ?? ""),
    googleMapsLink: String(obj.google_maps_link ?? ""),
    notes: String(obj.notes ?? ""),
    isFeatured: Boolean(obj.is_featured),
    createdAt: String(obj.created_at ?? ""),
    updatedAt: String(obj.updated_at ?? ""),
    raw: obj,
  };
}

/* ============================================================
   📚 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "تفاصيل المركز" : "Center Details",
    subtitle: isArabic
      ? "عرض الملف الكامل للمركز أو مقدم الخدمة مع بيانات التواصل، الموقع، الحالة، والروابط التشغيلية."
      : "View the full center/provider profile with contact, location, status, and operational links.",

    back: isArabic ? "قائمة المراكز" : "Centers List",
    refresh: isArabic ? "تحديث" : "Refresh",
    edit: isArabic ? "تعديل" : "Edit",
    delete: isArabic ? "حذف" : "Delete",

    confirmDelete: isArabic
      ? "هل أنت متأكد من حذف هذا المركز؟"
      : "Are you sure you want to delete this center?",

    apiError: isArabic
      ? "تعذر تحميل تفاصيل المركز."
      : "Unable to load center details.",
    deleteError: isArabic
      ? "تعذر حذف المركز."
      : "Unable to delete center.",
    deleteSuccess: isArabic
      ? "تم حذف المركز بنجاح."
      : "Center deleted successfully.",
    refreshSuccess: isArabic
      ? "تم تحديث بيانات المركز بنجاح."
      : "Center details refreshed successfully.",

    loading: isArabic ? "جاري تحميل بيانات المركز..." : "Loading center details...",
    notFound: isArabic ? "لم يتم العثور على بيانات المركز" : "Center data was not found",

    seller: isArabic ? "المسؤول" : "Contact",
    published: isArabic ? "تاريخ الإنشاء" : "Published",
    sku: isArabic ? "الكود" : "Code",

    profile: isArabic ? "ملف المركز" : "Center Profile",
    profileDesc: isArabic
      ? "البيانات الأساسية للمركز كما هي محفوظة في providers API."
      : "Core center data stored in providers API.",

    indicators: isArabic ? "المؤشرات" : "Indicators",
    details: isArabic ? "البيانات التفصيلية" : "Detailed Information",
    operationalLinks: isArabic ? "الروابط التشغيلية" : "Operational Links",
    operationalDesc: isArabic
      ? "روابط مستقبلية لربط المركز بالعقود والخدمات والمدفوعات."
      : "Future links to connect the center with contracts, services, and payments.",

    activityTitle: isArabic ? "النشاط التشغيلي" : "Operational Activity",
    activityDesc: isArabic
      ? "مؤشرات مبدئية سيتم ربطها لاحقًا بالطلبات والفواتير."
      : "Initial indicators that will later connect to orders and invoices.",

    notes: isArabic ? "ملاحظات" : "Notes",
    noNotes: isArabic ? "لا توجد ملاحظات." : "No notes available.",

    fields: {
      id: isArabic ? "رقم المركز" : "Center ID",
      name: isArabic ? "اسم المركز" : "Center Name",
      code: isArabic ? "الكود" : "Code",
      providerType: isArabic ? "نوع الجهة" : "Provider Type",
      status: isArabic ? "الحالة" : "Status",
      contactPerson: isArabic ? "الشخص المسؤول" : "Contact Person",
      phone: isArabic ? "الهاتف" : "Phone",
      mobile: isArabic ? "الجوال" : "Mobile",
      email: isArabic ? "البريد الإلكتروني" : "Email",
      website: isArabic ? "الموقع الإلكتروني" : "Website",
      city: isArabic ? "المدينة" : "City",
      area: isArabic ? "الحي / المنطقة" : "Area",
      address: isArabic ? "العنوان" : "Address",
      maps: isArabic ? "خرائط جوجل" : "Google Maps",
      featured: isArabic ? "مركز مميز" : "Featured Center",
      createdAt: isArabic ? "تاريخ الإنشاء" : "Created At",
      updatedAt: isArabic ? "آخر تحديث" : "Updated At",
    },

    active: isArabic ? "نشط" : "Active",
    inactive: isArabic ? "غير نشط" : "Inactive",
    suspended: isArabic ? "موقوف" : "Suspended",
    draft: isArabic ? "مسودة" : "Draft",
    unknown: isArabic ? "غير محدد" : "Unknown",

    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",

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

    cards: {
      contracts: isArabic ? "العقود" : "Contracts",
      services: isArabic ? "الخدمات" : "Services",
      payments: isArabic ? "المدفوعات" : "Payments",
      orders: isArabic ? "الطلبات" : "Orders",
      contractsDesc: isArabic ? "ربط عقود المركز لاحقًا" : "Link center contracts later",
      servicesDesc: isArabic ? "ربط الخدمات لاحقًا" : "Link services later",
      paymentsDesc: isArabic ? "ربط المدفوعات لاحقًا" : "Link payments later",
      ordersDesc: isArabic ? "ربط الطلبات لاحقًا" : "Link orders later",
    },
  };
}

/* ============================================================
   🎨 UI Helpers
============================================================ */

function getStatusLabel(status: ProviderStatus, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<ProviderStatus, string> = {
    ACTIVE: t.active,
    INACTIVE: t.inactive,
    SUSPENDED: t.suspended,
    DRAFT: t.draft,
    UNKNOWN: t.unknown,
  };

  return labels[status];
}

function statusBadge(status: ProviderStatus, locale: AppLocale) {
  const label = getStatusLabel(status, locale);

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

function formatDate(value: string, locale: AppLocale) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

/* ============================================================
   ✅ Page
============================================================ */

export default function SystemCenterDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [center, setCenter] = useState<CenterDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const profileCompleteness = useMemo(() => {
    if (!center) return 0;

    const fields = [
      center.name,
      center.code,
      center.providerType,
      center.status,
      center.contactPerson,
      center.mobile || center.phone,
      center.email,
      center.city,
      center.area,
      center.address,
      center.website,
    ];

    const completed = fields.filter((item) => String(item || "").trim()).length;
    return Math.round((completed / fields.length) * 100);
  }, [center]);

  async function loadCenter(showToast = false) {
    if (!params?.id) return;

    try {
      setIsLoading(true);

      const response = await fetch(`/api/providers/${params.id}/`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ProviderDetailResponse;
      setCenter(normalizeCenterDetail(payload));

      if (showToast) {
        toast.success(t.refreshSuccess);
      }
    } catch (error) {
      console.error("Failed to load center details:", error);
      setCenter(null);
      toast.error(t.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteCenter() {
    if (!params?.id) return;

    const confirmed = window.confirm(t.confirmDelete);
    if (!confirmed) return;

    try {
      setIsDeleting(true);

      const response = await fetch(`/api/providers/${params.id}/`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      toast.success(t.deleteSuccess);
      router.push("/system/centers/list");
    } catch (error) {
      console.error("Failed to delete center:", error);
      toast.error(t.deleteError);
    } finally {
      setIsDeleting(false);
    }
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
    loadCenter(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id, locale]);

  if (isLoading) {
    return (
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.loading}
        </CardContent>
      </Card>
    );
  }

  if (!center) {
    return (
      <div className="space-y-4">
        <Link href="/system/centers/list">
          <Button variant="outline" className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
            {t.back}
          </Button>
        </Link>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-12 text-center">
            <p className="font-semibold">{t.notFound}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* =====================================================
          Header — Product Detail Reference Style
      ====================================================== */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              /system/centers/{center.id}
            </Badge>
            {statusBadge(center.status, locale)}
            {center.isFeatured ? (
              <Badge className="rounded-full">
                <Star className="h-3.5 w-3.5 fill-current" />
                {t.fields.featured}
              </Badge>
            ) : null}
          </div>

          <h1 className="font-display text-xl font-bold tracking-tight lg:text-2xl">
            {center.name}
          </h1>

          <div className="text-muted-foreground inline-flex flex-col gap-2 text-sm lg:flex-row lg:gap-4">
            <div>
              <span className="text-foreground font-semibold">{t.seller} :</span>{" "}
              {center.contactPerson || "-"}
            </div>
            <div>
              <span className="text-foreground font-semibold">
                {t.published} :
              </span>{" "}
              {formatDate(center.createdAt, locale)}
            </div>
            <div>
              <span className="text-foreground font-semibold">{t.sku} :</span>{" "}
              {center.code}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/system/centers/list">
            <Button variant="outline" className="rounded-xl">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden lg:inline">{t.back}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => loadCenter(true)}
          >
            <RefreshCcw className="h-4 w-4" />
            <span className="hidden lg:inline">{t.refresh}</span>
          </Button>

          <Button className="rounded-xl" disabled>
            <Edit3Icon className="h-4 w-4" />
            <span className="hidden lg:inline">{t.edit}</span>
          </Button>

          <Button
            variant="destructive"
            size="icon"
            className="rounded-xl"
            onClick={deleteCenter}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2Icon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* =====================================================
          Main Grid
      ====================================================== */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Left Profile Card */}
        <div className="min-w-0 xl:col-span-1">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-4 p-4">
              <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border bg-muted">
                <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-background shadow-sm">
                  <Building2 className="h-14 w-14 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-2 text-center">
                <h2 className="text-lg font-bold">{center.name}</h2>
                <p className="text-muted-foreground text-sm">
                  {t.typeLabels[center.providerType]}
                </p>
                <div className="flex justify-center">
                  {statusBadge(center.status, locale)}
                </div>
              </div>

              <div className="rounded-xl border bg-background p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {isArabic ? "اكتمال الملف" : "Profile Completion"}
                  </p>
                  <Badge variant="outline" className="rounded-full">
                    {profileCompleteness}%
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
                <MiniInfo icon={Phone} label={t.fields.mobile} value={center.mobile || center.phone || "-"} />
                <MiniInfo icon={Mail} label={t.fields.email} value={center.email || "-"} />
                <MiniInfo icon={MapPin} label={t.fields.city} value={center.city || center.area || "-"} />
                <MiniInfo icon={Globe} label={t.fields.website} value={center.website || "-"} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Details */}
        <div className="space-y-4 xl:col-span-2">
          {/* Indicators */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={ShieldCheck}
              label={t.fields.status}
              value={getStatusLabel(center.status, locale)}
            />
            <MetricCard
              icon={Building2}
              label={t.fields.providerType}
              value={t.typeLabels[center.providerType]}
            />
            <MetricCard
              icon={Star}
              label={t.fields.featured}
              value={center.isFeatured ? t.yes : t.no}
            />
            <MetricCard
              icon={CalendarDays}
              label={t.fields.updatedAt}
              value={formatDate(center.updatedAt, locale)}
            />
          </div>

          {/* Details Table */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">{t.details}</CardTitle>
              <CardDescription>{t.profileDesc}</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableBody>
                    <DetailRow label={t.fields.id} value={String(center.id)} />
                    <DetailRow label={t.fields.name} value={center.name} />
                    <DetailRow label={t.fields.code} value={center.code} />
                    <DetailRow
                      label={t.fields.providerType}
                      value={t.typeLabels[center.providerType]}
                    />
                    <DetailRow
                      label={t.fields.status}
                      value={getStatusLabel(center.status, locale)}
                    />
                    <DetailRow
                      label={t.fields.contactPerson}
                      value={center.contactPerson || "-"}
                    />
                    <DetailRow label={t.fields.phone} value={center.phone || "-"} />
                    <DetailRow
                      label={t.fields.mobile}
                      value={center.mobile || "-"}
                    />
                    <DetailRow label={t.fields.email} value={center.email || "-"} />
                    <DetailRow
                      label={t.fields.website}
                      value={center.website || "-"}
                      link={center.website}
                    />
                    <DetailRow label={t.fields.city} value={center.city || "-"} />
                    <DetailRow label={t.fields.area} value={center.area || "-"} />
                    <DetailRow
                      label={t.fields.address}
                      value={center.address || "-"}
                    />
                    <DetailRow
                      label={t.fields.maps}
                      value={center.googleMapsLink || "-"}
                      link={center.googleMapsLink}
                    />
                    <DetailRow
                      label={t.fields.createdAt}
                      value={formatDate(center.createdAt, locale)}
                    />
                    <DetailRow
                      label={t.fields.updatedAt}
                      value={formatDate(center.updatedAt, locale)}
                    />
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Operational Cards */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
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

          {/* Notes */}
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">{t.notes}</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="rounded-xl border bg-background p-4 text-sm leading-7 text-muted-foreground">
                {center.notes || t.noNotes}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   🔹 Small Components
============================================================ */

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="hover:border-primary/30 grid auto-cols-max grid-flow-col gap-4 rounded-lg border bg-muted p-4">
      <Icon className="size-6 opacity-40" />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-muted-foreground text-sm">{label}</span>
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
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-background p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
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
  const hasLink = link && (link.startsWith("https://") || link.startsWith("http://"));

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
            className="inline-flex items-center gap-2 text-primary hover:underline"
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
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="text-muted-foreground mt-1 text-xs leading-5">
        {description}
      </p>
    </div>
  );
}