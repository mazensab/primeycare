import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Building2,
  Eye,
  FileText,
  Filter,
  MapPin,
  Package,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Tag,
  TrendingUp,
  Wallet,
} from "lucide-react";

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

type AppLocale = "ar" | "en";

type PreviewRow = {
  id: number;
  name: string;
  city: string;
  phone: string;
  specialty: string;
  status: "ACTIVE" | "PENDING" | "INACTIVE";
};

function detectLocale(): AppLocale {
  return "ar";
}

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "إدارة مقدمي الخدمة" : "Providers Management",
    subtitle: isArabic
      ? "واجهة system الرسمية لإدارة مقدمي الخدمة في Primey Care، مع ملخص تشغيلي احترافي، بحث مبدئي، ومعاينة منظمة للقائمة تمهيدًا لربط البيانات الحقيقية لاحقًا."
      : "The official system interface for managing providers in Primey Care, with a professional operational overview, initial search controls, and a structured list preview ready for live integration later.",

    heroBadge1: isArabic ? "System Workspace" : "System Workspace",
    heroBadge2: isArabic ? "Providers Module" : "Providers Module",

    addProvider: isArabic ? "إضافة مقدم خدمة" : "Add Provider",
    providerReports: isArabic ? "تقارير المزودين" : "Provider Reports",

    quickStats: isArabic ? "مؤشرات سريعة" : "Quick Metrics",
    operationalOverview: isArabic ? "نظرة تشغيلية" : "Operational Overview",

    searchPlaceholder: isArabic
      ? "ابحث بالاسم أو الجوال أو المدينة أو التخصص..."
      : "Search by name, phone, city, or specialty...",
    search: isArabic ? "بحث" : "Search",
    filter: isArabic ? "تصفية" : "Filter",

    operationalCards: isArabic ? "المرتكزات التشغيلية" : "Operational Foundations",
    quickActions: isArabic ? "إجراءات سريعة" : "Quick Actions",
    currentStatus: isArabic ? "الحالة الحالية" : "Current Status",
    nextStep: isArabic ? "الخطوة التالية" : "Next Step",

    nextStepText: isArabic
      ? "الواجهة أصبحت مهيأة بصريًا داخل shell النظام الرسمي. الخطوة التالية الأفضل هي ربط القائمة الفعلية، ثم إنشاء مقدم خدمة جديد، ثم صفحة التفاصيل وربطها لاحقًا بالعقود والخدمات والطلبات."
      : "The interface is now visually aligned with the official system shell. The best next step is wiring the real list, then create provider, then provider detail and later connecting them with contracts, services, and orders.",

    stats: [
      {
        title: isArabic ? "إجمالي المزودين" : "Total Providers",
        value: "0",
        note: isArabic ? "يظهر فعليًا بعد الربط" : "Live after integration",
        icon: Building2,
      },
      {
        title: isArabic ? "المزودون النشطون" : "Active Providers",
        value: "0",
        note: isArabic ? "جاهز لحالة النشاط" : "Ready for active state",
        icon: BadgeCheck,
      },
      {
        title: isArabic ? "الخدمات التعاقدية" : "Contract Services",
        value: "0",
        note: isArabic ? "يرتبط لاحقًا بالخدمات" : "Will link to services",
        icon: Package,
      },
      {
        title: isArabic ? "النمو التشغيلي" : "Operational Growth",
        value: "+0%",
        note: isArabic ? "مؤشر تحليلي لاحقًا" : "Analytics later",
        icon: TrendingUp,
      },
    ],

    overviewCards: [
      {
        title: isArabic ? "الملف الأساسي للمزود" : "Provider Core Profile",
        description: isArabic
          ? "تجهيز الاسم التجاري، المدينة، وسائل التواصل، الحالة التشغيلية، والتخصص كأساس لكل العمليات اللاحقة."
          : "Prepare the provider’s commercial identity, city, contact data, operational state, and specialty as the basis for later workflows.",
        icon: Building2,
      },
      {
        title: isArabic ? "العقود والخدمات" : "Contracts & Services",
        description: isArabic
          ? "بناء طبقة ربط المزود بالعقود والخدمات الطبية أو التشغيلية والاتفاقيات الخاصة بكل مركز أو جهة خدمة."
          : "Build the layer connecting providers to contracts, medical or operational services, and each center’s service agreements.",
        icon: FileText,
      },
      {
        title: isArabic ? "التشغيل والتقارير" : "Operations & Reporting",
        description: isArabic
          ? "تهيئة الربط المستقبلي مع الطلبات، الفواتير، المنتجات، والتحليلات التشغيلية الخاصة بمقدمي الخدمة."
          : "Prepare future linkage with orders, invoices, products, and operational analytics for providers.",
        icon: Activity,
      },
    ],

    actionCards: [
      {
        title: isArabic ? "قائمة مقدمي الخدمة" : "Providers List",
        description: isArabic
          ? "هذه الصفحة هي نقطة الدخول الرسمية لمسار مقدمي الخدمة داخل system."
          : "This page is the official entry point for the providers flow inside system.",
        href: "/system/providers",
        cta: isArabic ? "أنت هنا" : "You Are Here",
        icon: Building2,
      },
      {
        title: isArabic ? "إضافة مقدم خدمة" : "Create Provider",
        description: isArabic
          ? "الانتقال إلى واجهة إنشاء مقدم خدمة جديد بنفس الهوية الرسمية المعتمدة."
          : "Go to the create-provider interface using the approved official identity.",
        href: "/system/providers/create",
        cta: isArabic ? "فتح الصفحة" : "Open Page",
        icon: Plus,
      },
      {
        title: isArabic ? "تفاصيل المزود" : "Provider Detail",
        description: isArabic
          ? "سيتم تجهيز صفحة التفاصيل لاحقًا لإظهار المعلومات الكاملة والعقود والخدمات المرتبطة."
          : "The detail page will later show the complete profile with related contracts and services.",
        href: "/system/providers",
        cta: isArabic ? "يجهز لاحقًا" : "Prepare Later",
        icon: Eye,
      },
      {
        title: isArabic ? "تقارير المزودين" : "Provider Reports",
        description: isArabic
          ? "واجهة تقارير وتحليلات مستقبلية لمتابعة النشاط، التغطية، والأداء."
          : "A future reporting and analytics surface to track activity, coverage, and performance.",
        href: "/system/providers",
        cta: isArabic ? "قريبًا" : "Coming Soon",
        icon: Sparkles,
      },
    ],

    statusItems: [
      {
        label: isArabic ? "توافق الصفحة" : "Page Alignment",
        value: isArabic ? "متوافقة مع shell الرسمي" : "Aligned with official shell",
        icon: BadgeCheck,
      },
      {
        label: isArabic ? "حالة الـ API" : "API Status",
        value: isArabic ? "غير مربوط بعد" : "Not integrated yet",
        icon: ShieldCheck,
      },
      {
        label: isArabic ? "المسارات" : "Routes",
        value: isArabic ? "موحدة تحت ‎/system/..." : "Unified under /system/...",
        icon: ArrowLeft,
      },
      {
        label: isArabic ? "الربط التشغيلي" : "Operational Mapping",
        value: isArabic ? "عقود / خدمات / طلبات" : "Contracts / Services / Orders",
        icon: Wallet,
      },
    ],

    sampleRowsTitle: isArabic ? "معاينة أولية للقائمة" : "Initial List Preview",
    sampleRowsDesc: isArabic
      ? "عرض بصري مؤقت يوضّح شكل قائمة المزودين عند ربط البيانات الحقيقية."
      : "A temporary visual preview of how the providers list will appear after live data integration.",

    tableHeaders: {
      provider: isArabic ? "مقدم الخدمة" : "Provider",
      contact: isArabic ? "التواصل" : "Contact",
      specialty: isArabic ? "التخصص" : "Specialty",
      status: isArabic ? "الحالة" : "Status",
      actions: isArabic ? "الإجراءات" : "Actions",
    },

    noDataTitle: isArabic ? "لا توجد بيانات فعلية بعد" : "No Live Data Yet",
    noDataText: isArabic
      ? "تم تجهيز صفحة مقدمي الخدمة بصيغة احترافية متوافقة مع النظام الرسمي. سيظهر المحتوى الحقيقي بعد ربط القائمة بالـ APIs وإكمال مسار list/create/detail."
      : "The providers page is prepared in a professional style aligned with the official system. Real content will appear after wiring the list to APIs and completing the list/create/detail flow.",

    view: isArabic ? "عرض" : "View",
    services: isArabic ? "الخدمات" : "Services",
  };
}

const previewRows: PreviewRow[] = [
  {
    id: 1,
    name: "مركز الابتسامة الطبية",
    city: "جدة",
    phone: "+966 5X XXX XXXX",
    specialty: "Dental Center",
    status: "ACTIVE",
  },
  {
    id: 2,
    name: "مجمع النخبة الصحي",
    city: "الرياض",
    phone: "+966 5X XXX XXXX",
    specialty: "Medical Complex",
    status: "PENDING",
  },
  {
    id: 3,
    name: "عيادات الرعاية الحديثة",
    city: "الدمام",
    phone: "+966 5X XXX XXXX",
    specialty: "General Clinic",
    status: "INACTIVE",
  },
];

function statusBadge(status: PreviewRow["status"], locale: AppLocale) {
  const isArabic = locale === "ar";

  if (status === "ACTIVE") {
    return (
      <Badge className="rounded-full px-3 py-1">
        {isArabic ? "نشط" : "Active"}
      </Badge>
    );
  }

  if (status === "PENDING") {
    return (
      <Badge variant="secondary" className="rounded-full px-3 py-1">
        {isArabic ? "قيد المراجعة" : "Pending"}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {isArabic ? "غير نشط" : "Inactive"}
    </Badge>
  );
}

export default function SystemProvidersPage() {
  const locale = detectLocale();
  const isArabic = locale === "ar";
  const t = dictionary(locale);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-3xl border-white/20 bg-white/70 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardContent className="p-6 md:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr] lg:items-center">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full px-3 py-1">{t.heroBadge1}</Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {t.heroBadge2}
                </Badge>
              </div>

              <div className="space-y-3">
                <h1 className="text-2xl font-bold tracking-tight md:text-4xl">
                  {t.title}
                </h1>
                <p className="text-muted-foreground max-w-3xl text-sm leading-7 md:text-base">
                  {t.subtitle}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/system/providers/create"
                  className="w-full sm:w-auto"
                >
                  <Button className="w-full rounded-2xl sm:w-auto">
                    <Plus className="ms-2 h-4 w-4" />
                    {t.addProvider}
                  </Button>
                </Link>

                <Link href="/system/providers" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl sm:w-auto"
                  >
                    <FileText className="ms-2 h-4 w-4" />
                    {t.providerReports}
                  </Button>
                </Link>
              </div>
            </div>

            <Card className="rounded-3xl border-white/20 bg-white/75 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t.quickStats}</CardTitle>
                <CardDescription>{t.operationalOverview}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-3 sm:grid-cols-2">
                {t.stats.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-muted-foreground text-xs">
                            {item.title}
                          </p>
                          <p className="truncate text-sm font-semibold">
                            {item.value}
                          </p>
                        </div>
                      </div>

                      <Badge variant="secondary" className="rounded-full">
                        {item.note}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
        <CardContent className="p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search
                className={`text-muted-foreground absolute top-1/2 h-4 w-4 -translate-y-1/2 ${
                  isArabic ? "right-3" : "left-3"
                }`}
              />
              <Input
                placeholder={t.searchPlaceholder}
                className={`rounded-2xl ${isArabic ? "pr-10" : "pl-10"}`}
              />
            </div>

            <Button variant="outline" className="rounded-2xl">
              <Search className="ms-2 h-4 w-4" />
              {t.search}
            </Button>

            <Button variant="outline" className="rounded-2xl">
              <Filter className="ms-2 h-4 w-4" />
              {t.filter}
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="px-1">
          <h2 className="text-lg font-bold tracking-tight">
            {t.operationalCards}
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {t.overviewCards.map((item) => {
            const Icon = item.icon;

            return (
              <Card
                key={item.title}
                className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5"
              >
                <CardHeader className="space-y-4">
                  <div className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-2xl">
                    <Icon className="h-6 w-6" />
                  </div>

                  <div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <CardDescription className="mt-2 leading-7">
                      {item.description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
        <CardHeader>
          <CardTitle>{t.sampleRowsTitle}</CardTitle>
          <CardDescription>{t.sampleRowsDesc}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-3xl border border-white/20 dark:border-white/10">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-black/5 dark:bg-white/5">
                <tr className="border-b border-white/20 dark:border-white/10">
                  <th className="px-4 py-4 text-start font-semibold">
                    {t.tableHeaders.provider}
                  </th>
                  <th className="px-4 py-4 text-start font-semibold">
                    {t.tableHeaders.contact}
                  </th>
                  <th className="px-4 py-4 text-start font-semibold">
                    {t.tableHeaders.specialty}
                  </th>
                  <th className="px-4 py-4 text-start font-semibold">
                    {t.tableHeaders.status}
                  </th>
                  <th className="px-4 py-4 text-start font-semibold">
                    {t.tableHeaders.actions}
                  </th>
                </tr>
              </thead>

              <tbody>
                {previewRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/10 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                          <Building2 className="h-4 w-4" />
                        </div>

                        <div>
                          <p className="font-semibold">{row.name}</p>
                          <p className="text-muted-foreground text-xs">
                            ID-{row.id.toString().padStart(4, "0")}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Phone className="text-muted-foreground h-3.5 w-3.5" />
                          <span>{row.phone}</span>
                        </div>

                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{row.city}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Tag className="text-muted-foreground h-3.5 w-3.5" />
                        <span>{row.specialty}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      {statusBadge(row.status, locale)}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                        >
                          <Eye className="ms-2 h-4 w-4" />
                          {t.view}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                        >
                          <Stethoscope className="ms-2 h-4 w-4" />
                          {t.services}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-2xl border border-dashed border-white/30 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="mb-2 flex items-center gap-2">
              <Badge className="rounded-full px-3 py-1">Preview</Badge>
            </div>

            <p className="text-muted-foreground text-sm leading-7">
              {t.noDataText}
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
          <CardHeader>
            <CardTitle>{t.quickActions}</CardTitle>
            <CardDescription>{t.operationalOverview}</CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-2">
            {t.actionCards.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/20 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-2xl">
                      <Icon className="h-5 w-5" />
                    </div>

                    <Badge variant="secondary" className="rounded-full">
                      Module
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-base font-semibold">{item.title}</h3>
                    <p className="text-muted-foreground text-sm leading-7">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-4">
                    <Link href={item.href}>
                      <Button
                        variant="outline"
                        className="w-full justify-between rounded-2xl"
                      >
                        <span>{item.cta}</span>
                        <ArrowLeft
                          className={`h-4 w-4 ${isArabic ? "" : "rotate-180"}`}
                        />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
          <CardHeader>
            <CardTitle>{t.currentStatus}</CardTitle>
            <CardDescription>{t.nextStep}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {t.statusItems.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-muted-foreground text-xs">{item.label}</p>
                    <p className="truncate text-sm font-semibold">{item.value}</p>
                  </div>
                </div>
              );
            })}

            <div className="rounded-2xl border border-dashed border-white/30 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-2 flex items-center gap-2">
                <Badge className="rounded-full px-3 py-1">
                  {t.noDataTitle}
                </Badge>
              </div>

              <p className="text-muted-foreground text-sm leading-7">
                {t.noDataText}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <CardContent className="p-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t.nextStep}</p>
            <p className="text-muted-foreground text-sm leading-7">
              {t.nextStepText}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}