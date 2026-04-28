"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Building2,
  Eye,
  FileText,
  Filter,
  ListChecks,
  Loader2,
  MapPin,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
  Stethoscope,
  Users,
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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ============================================================
   📂 app/system/providers/page.tsx
   🧠 Primey Care | System Providers Dashboard
   ------------------------------------------------------------
   ✅ نفس تصميم صفحة المراكز المعتمدة
   ✅ مقدمو الخدمة كوحدة مستقلة
   ✅ استخدام UI الداخلي فقط
   ✅ ربط حقيقي مع /api/providers/
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ الأرقام دائمًا بالإنجليزي
   ✅ بدون hardcoded localhost
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

type Provider = {
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

type ProvidersApiResponse = {
  ok?: boolean;
  message?: string;
  results?: unknown[];
  data?: unknown[] | { results?: unknown[]; items?: unknown[] };
  items?: unknown[];
  providers?: unknown[];
  centers?: unknown[];
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

function formatNumber(value: number | string): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "0";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(numericValue);
}

/* ============================================================
   🔁 API Normalizers
============================================================ */

function normalizeApiList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const data = payload as ProvidersApiResponse;

    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.providers)) return data.providers;
    if (Array.isArray(data.centers)) return data.centers;
    if (Array.isArray(data.data)) return data.data;

    if (
      data.data &&
      typeof data.data === "object" &&
      Array.isArray(data.data.results)
    ) {
      return data.data.results;
    }

    if (
      data.data &&
      typeof data.data === "object" &&
      Array.isArray(data.data.items)
    ) {
      return data.data.items;
    }
  }

  return [];
}

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

function normalizeProvider(item: unknown): Provider {
  const obj = (item || {}) as Record<string, unknown>;

  return {
    id: (obj.id ?? "-") as number | string,
    name: String(obj.name ?? obj.title ?? "-"),
    code: String(obj.code ?? obj.provider_code ?? "-"),
    providerType: normalizeProviderType(
      obj.provider_type ?? obj.type ?? obj.category
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

/* ============================================================
   📚 Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "إدارة مقدمي الخدمة" : "Providers Management",
    pageSubtitle: isArabic
      ? "متابعة مقدمي الخدمة، حالة التفعيل، المدن، والروابط التشغيلية من بيانات حقيقية."
      : "Monitor providers, activation status, cities, and operational links from live data.",

    addProvider: isArabic ? "إنشاء مقدم خدمة" : "Create Provider",
    providersList: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",
    reports: isArabic ? "التقارير" : "Reports",
    refresh: isArabic ? "تحديث" : "Refresh",

    featuredProviders: isArabic
      ? "مقدمو الخدمة المميزون"
      : "Featured Providers",
    featuredSubtitle: isArabic
      ? "عرض مختصر لأهم مقدمي الخدمة حسب حالة التمييز أو أحدث السجلات."
      : "A compact view of important providers based on featured status or latest records.",

    trackStatus: isArabic ? "حالة مقدمي الخدمة" : "Providers Status",
    trackSubtitle: isArabic
      ? "تحليل سريع لحالة مقدمي الخدمة."
      : "Quick analysis of providers status.",

    filterPlaceholder: isArabic
      ? "ابحث في مقدمي الخدمة..."
      : "Search providers...",
    columns: isArabic ? "الأعمدة" : "Columns",
    previous: isArabic ? "السابق" : "Previous",
    next: isArabic ? "التالي" : "Next",

    total: isArabic ? "الإجمالي" : "Total",
    active: isArabic ? "نشط" : "Active",
    draft: isArabic ? "مسودة" : "Draft",
    suspended: isArabic ? "موقوف" : "Suspended",
    inactive: isArabic ? "غير نشط" : "Inactive",
    unknown: isArabic ? "غير محدد" : "Unknown",

    emptyTitle: isArabic
      ? "لا يوجد مقدمو خدمة بعد"
      : "No providers yet",
    emptyText: isArabic
      ? "عند إضافة مقدم خدمة من صفحة الإنشاء أو من لوحة Django سيظهر هنا مباشرة."
      : "Providers created from the create page or Django admin will appear here.",
    loading: isArabic
      ? "جاري تحميل بيانات مقدمي الخدمة..."
      : "Loading providers data...",
    apiError: isArabic
      ? "تعذر تحميل بيانات مقدمي الخدمة."
      : "Unable to load providers data.",
    refreshSuccess: isArabic
      ? "تم تحديث بيانات مقدمي الخدمة بنجاح"
      : "Providers data refreshed successfully",

    quickAccessTitle: isArabic
      ? "إجراءات وحدة مقدمي الخدمة"
      : "Providers Module Actions",
    quickAccessSubtitle: isArabic
      ? "اختصارات منظمة للوصول إلى أهم صفحات وحدة مقدمي الخدمة دون عرض روابط خام."
      : "Organized shortcuts to the key provider module pages without raw route text.",

    open: isArabic ? "فتح" : "Open",
    manage: isArabic ? "إدارة" : "Manage",
    newItem: isArabic ? "جديد" : "New",
    analysis: isArabic ? "تحليل" : "Analysis",

    actionListTitle: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",
    actionListDesc: isArabic
      ? "استعراض جميع مقدمي الخدمة، البحث، التصفية، وإدارة السجلات."
      : "Browse all providers, search, filter, and manage records.",

    actionCreateTitle: isArabic ? "إنشاء مقدم خدمة" : "Create Provider",
    actionCreateDesc: isArabic
      ? "إضافة مقدم خدمة جديد وربطه لاحقًا بالعقود والخدمات والطلبات."
      : "Add a new provider and later connect it with contracts, services, and orders.",

    actionReportsTitle: isArabic
      ? "تقارير مقدمي الخدمة"
      : "Providers Reports",
    actionReportsDesc: isArabic
      ? "عرض تقارير تشغيلية، فلاتر، جداول، تصدير وطباعة."
      : "View operational reports, filters, tables, export and print.",

    table: {
      id: isArabic ? "الرقم" : "ID",
      name: isArabic ? "اسم مقدم الخدمة" : "Provider Name",
      type: isArabic ? "النوع" : "Type",
      city: isArabic ? "المدينة" : "City",
      contact: isArabic ? "التواصل" : "Contact",
      status: isArabic ? "الحالة" : "Status",
      action: isArabic ? "الإجراء" : "Action",
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
  };
}

/* ============================================================
   🎨 UI Helpers
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

/* ============================================================
   🧩 Page
============================================================ */

export default function SystemProvidersPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isArabic = locale === "ar";
  const t = useMemo(() => dictionary(locale), [locale]);

  const syncLocale = useCallback(() => {
    const nextLocale = readLocale();
    setLocale(nextLocale);
    applyDocumentLocale(nextLocale);
  }, []);

  const loadProviders = useCallback(
    async (options?: { silent?: boolean }) => {
      try {
        if (options?.silent) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const response = await fetch("/api/providers/?page_size=100", {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Providers API failed with status ${response.status}`);
        }

        const payload = (await response.json()) as ProvidersApiResponse;
        const list = normalizeApiList(payload).map(normalizeProvider);

        setProviders(list);

        if (options?.silent) {
          toast.success(t.refreshSuccess);
        }
      } catch (error) {
        console.error("Load providers error:", error);
        toast.error(t.apiError);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [t.apiError, t.refreshSuccess]
  );

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
    loadProviders();
  }, [loadProviders]);

  const filteredProviders = useMemo(() => {
    const searchValue = query.trim().toLowerCase();

    if (!searchValue) return providers;

    return providers.filter((provider) => {
      const haystack = [
        provider.name,
        provider.code,
        provider.city,
        provider.area,
        provider.phone,
        provider.mobile,
        provider.email,
        provider.contactPerson,
        provider.providerType,
        provider.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchValue);
    });
  }, [providers, query]);

  const stats = useMemo(() => {
    const total = providers.length;
    const active = providers.filter((item) => item.status === "ACTIVE").length;
    const draft = providers.filter((item) => item.status === "DRAFT").length;
    const suspended = providers.filter(
      (item) => item.status === "SUSPENDED"
    ).length;
    const inactive = providers.filter(
      (item) => item.status === "INACTIVE"
    ).length;

    return {
      total,
      active,
      draft,
      suspended,
      inactive,
    };
  }, [providers]);

  const featuredProviders = useMemo(() => {
    const featured = providers.filter((item) => item.isFeatured);

    if (featured.length > 0) {
      return featured.slice(0, 4);
    }

    return [...providers].slice(0, 4);
  }, [providers]);

  const tableRows = useMemo(() => {
    return filteredProviders.slice(0, 8);
  }, [filteredProviders]);

  const statusCards = [
    {
      title: t.total,
      value: formatNumber(stats.total),
      percent: 100,
      helperValue: stats.total > 0 ? "100%" : "0%",
      icon: Building2,
    },
    {
      title: t.active,
      value: formatNumber(stats.active),
      percent: stats.total ? Math.round((stats.active / stats.total) * 100) : 0,
      helperValue: `${
        stats.total ? Math.round((stats.active / stats.total) * 100) : 0
      }%`,
      icon: BadgeCheck,
    },
    {
      title: t.draft,
      value: formatNumber(stats.draft),
      percent: stats.total ? Math.round((stats.draft / stats.total) * 100) : 0,
      helperValue: `${
        stats.total ? Math.round((stats.draft / stats.total) * 100) : 0
      }%`,
      icon: FileText,
    },
    {
      title: t.suspended,
      value: formatNumber(stats.suspended),
      percent: stats.total
        ? Math.round((stats.suspended / stats.total) * 100)
        : 0,
      helperValue: `${
        stats.total ? Math.round((stats.suspended / stats.total) * 100) : 0
      }%`,
      icon: ShieldCheck,
    },
  ];

  const moduleActions = [
    {
      title: t.actionListTitle,
      description: t.actionListDesc,
      href: "/system/providers/list",
      badge: t.manage,
      cta: t.open,
      icon: ListChecks,
    },
    {
      title: t.actionCreateTitle,
      description: t.actionCreateDesc,
      href: "/system/providers/create",
      badge: t.newItem,
      cta: t.open,
      icon: Plus,
    },
    {
      title: t.actionReportsTitle,
      description: t.actionReportsDesc,
      href: "/system/providers/reports",
      badge: t.analysis,
      cta: t.open,
      icon: Activity,
    },
  ];

  return (
    <div className="space-y-6">
      {/* =====================================================
          Page Header - نفس صفحة المراكز
      ====================================================== */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="order-2 flex flex-wrap items-center gap-2 lg:order-1">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => loadProviders({ silent: true })}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          <Link href="/system/providers/reports">
            <Button variant="outline" className="rounded-xl">
              <BarChart3 className="h-4 w-4" />
              <span>{t.reports}</span>
            </Button>
          </Link>

          <Link href="/system/providers/create">
            <Button className="rounded-xl">
              <Plus className="h-4 w-4" />
              <span>{t.addProvider}</span>
            </Button>
          </Link>
        </div>

        <div className="order-1 max-w-3xl space-y-2 text-right lg:order-2">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t.pageTitle}
          </h1>
          <p className="text-sm leading-7 text-muted-foreground md:text-base">
            {t.pageSubtitle}
          </p>
        </div>
      </div>

      {/* =====================================================
          Status + Featured - نفس تقسيم صفحة المراكز
      ====================================================== */}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.55fr]">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-background">
                <ListChecks className="h-5 w-5" />
              </div>

              <div className="space-y-1 text-right">
                <CardTitle className="text-base font-bold">
                  {t.trackStatus}
                </CardTitle>
                <CardDescription>{t.trackSubtitle}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              {statusCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div key={card.title} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold">
                        {isLoading ? "..." : card.value}
                      </p>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          {card.helperValue}
                        </span>
                        <p className="text-sm text-muted-foreground">
                          {card.title}
                        </p>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${card.percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 md:grid-cols-[auto_1fr]">
              <Button variant="outline" className="h-10 rounded-xl">
                <Filter className="h-4 w-4" />
                <span>{t.columns}</span>
              </Button>

              <div className="relative">
                <Search
                  className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                    isArabic ? "right-3" : "left-3"
                  }`}
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.filterPlaceholder}
                  className={`h-10 rounded-xl ${
                    isArabic ? "pr-10" : "pl-10"
                  }`}
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.table.action}</TableHead>
                    <TableHead>{t.table.status}</TableHead>
                    <TableHead>{t.table.contact}</TableHead>
                    <TableHead>{t.table.city}</TableHead>
                    <TableHead>{t.table.type}</TableHead>
                    <TableHead>{t.table.name}</TableHead>
                    <TableHead>{t.table.id}</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{t.loading}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : tableRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="py-12 text-center">
                          <p className="font-semibold">{t.emptyTitle}</p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {t.emptyText}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tableRows.map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell>
                          <Link href={`/system/providers/${provider.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>

                        <TableCell>
                          {statusBadge(provider.status, locale)}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>
                              {provider.mobile || provider.phone || "-"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{provider.city || provider.area || "-"}</span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="secondary" className="rounded-full">
                            {t.typeLabels[provider.providerType]}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <div className="min-w-0 text-right">
                              <p className="truncate font-medium">
                                {provider.name}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {provider.contactPerson ||
                                  provider.email ||
                                  "-"}
                              </p>
                            </div>
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <Building2 className="h-4 w-4" />
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="font-medium">
                          {provider.code && provider.code !== "-"
                            ? provider.code
                            : `#${provider.id}`}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Link href="/system/providers/list">
                  <Button variant="outline" size="sm" className="rounded-xl">
                    <ListChecks className="h-4 w-4" />
                    {t.next}
                  </Button>
                </Link>

                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled
                >
                  {t.previous}
                </Button>
              </div>

              <p>
                {formatNumber(filteredProviders.length)} /{" "}
                {formatNumber(providers.length)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-background">
                <Star className="h-5 w-5" />
              </div>

              <div className="space-y-1 text-right">
                <CardTitle className="text-base font-bold">
                  {t.featuredProviders}
                </CardTitle>
                <CardDescription>{t.featuredSubtitle}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t.loading}</span>
              </div>
            ) : featuredProviders.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-center">
                <p className="font-semibold">{t.emptyTitle}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t.emptyText}
                </p>
              </div>
            ) : (
              featuredProviders.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border bg-background p-4"
                >
                  <div className="shrink-0">
                    {statusBadge(provider.status, locale)}
                  </div>

                  <div className="flex min-w-0 items-center gap-3">
                    <div className="min-w-0 text-right">
                      <p className="truncate font-semibold">{provider.name}</p>
                      <div className="mt-1 flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
                        <span>{t.typeLabels[provider.providerType]}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {provider.city || provider.area || "-"}
                          <MapPin className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* =====================================================
          Module Actions - نفس صفحة المراكز
      ====================================================== */}
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader className="pb-3 text-right">
          <CardTitle className="text-base font-bold">
            {t.quickAccessTitle}
          </CardTitle>
          <CardDescription>{t.quickAccessSubtitle}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {moduleActions.map((item) => {
              const Icon = item.icon;

              return (
                <Link key={item.href} href={item.href} className="block">
                  <Card className="h-full rounded-2xl border bg-background shadow-none transition hover:bg-muted/40 hover:shadow-sm">
                    <CardContent className="flex h-full items-start justify-between gap-4 p-4">
                      <div className="min-w-0 space-y-3 text-right">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="rounded-full">
                            {item.badge}
                          </Badge>

                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>

                        <div>
                          <p className="font-semibold">{item.title}</p>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {item.description}
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                        >
                          {item.cta}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* =====================================================
          Operational Foundation
      ====================================================== */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader className="space-y-3 text-right">
            <div className="ms-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">
                {isArabic ? "الملف الأساسي" : "Core Profile"}
              </CardTitle>
              <CardDescription className="mt-2 leading-6">
                {isArabic
                  ? "إدارة بيانات مقدم الخدمة الأساسية، المدينة، التواصل، التصنيف، والحالة التشغيلية."
                  : "Manage provider identity, city, contact details, category, and operational status."}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader className="space-y-3 text-right">
            <div className="ms-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">
                {isArabic ? "العقود والخدمات" : "Contracts & Services"}
              </CardTitle>
              <CardDescription className="mt-2 leading-6">
                {isArabic
                  ? "ربط مقدم الخدمة لاحقًا بالعقود والخدمات والباقات والطلبات التشغيلية."
                  : "Later connect providers with contracts, services, packages, and operational orders."}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader className="space-y-3 text-right">
            <div className="ms-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">
                {isArabic ? "التشغيل والتقارير" : "Operations & Reports"}
              </CardTitle>
              <CardDescription className="mt-2 leading-6">
                {isArabic
                  ? "متابعة التغطية، النشاط، حالات التفعيل، وتقارير الأداء من نفس الوحدة."
                  : "Track coverage, activity, activation states, and performance reports from the same module."}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}