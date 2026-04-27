import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarRange,
  CreditCard,
  Eye,
  FileSignature,
  FileText,
  Filter,
  HandCoins,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AppLocale = "ar" | "en";

function detectLocale(): AppLocale {
  return "ar";
}

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "إدارة العقود" : "Contracts Management",
    subtitle: isArabic
      ? "هذه الصفحة تمثل الواجهة الإدارية الرئيسية لإدارة العقود داخل Primey Care، وتشمل الملخص العام، التهيئة الأولية للعرض، والوصول السريع إلى مسارات العقود، المراكز، مقدمي الخدمة، والخدمات المرتبطة."
      : "This page is the main administrative interface for managing contracts inside Primey Care, including overview, initial layout, and quick access to contracts, centers, providers, and linked services.",

    heroBadge1: isArabic ? "System Module" : "System Module",
    heroBadge2: isArabic ? "Contracts" : "Contracts",

    addContract: isArabic ? "إضافة عقد جديد" : "Add New Contract",
    contractsReports: isArabic ? "تقارير العقود" : "Contracts Reports",

    quickStats: isArabic ? "ملخص سريع" : "Quick Summary",
    operationalOverview: isArabic ? "نظرة تشغيلية" : "Operational Overview",
    searchPlaceholder: isArabic
      ? "ابحث برقم العقد أو المركز أو مقدم الخدمة..."
      : "Search by contract number, center, or provider...",
    search: isArabic ? "بحث" : "Search",
    filter: isArabic ? "تصفية" : "Filter",

    operationalCards: isArabic ? "بطاقات تشغيلية" : "Operational Cards",
    quickActions: isArabic ? "إجراءات سريعة" : "Quick Actions",
    currentStatus: isArabic ? "الحالة الحالية" : "Current Status",
    nextStep: isArabic ? "الخطوة التالية" : "Next Step",

    nextStepText: isArabic
      ? "الأساس البصري لصفحة العقود أصبح جاهزًا تحت مساحة النظام الرسمية. الخطوة الصحيحة التالية هي بناء القائمة الفعلية للعقود وربطها لاحقًا بالمراكز، مقدمي الخدمة، عناصر الخدمة، الطلبات، والمدفوعات."
      : "The visual foundation for contracts is now ready under the official system workspace. The correct next step is to build the actual contracts list and later connect it with centers, providers, service items, orders, and payments.",

    stats: [
      {
        title: isArabic ? "إجمالي العقود" : "Total Contracts",
        value: "0",
        note: isArabic ? "سيظهر العدد الفعلي بعد الربط" : "Live count after integration",
        icon: FileSignature,
      },
      {
        title: isArabic ? "العقود النشطة" : "Active Contracts",
        value: "0",
        note: isArabic ? "جاهز لحالة النشاط" : "Ready for active status",
        icon: BadgeCheck,
      },
      {
        title: isArabic ? "العقود ذات الخدمات" : "Contracts with Services",
        value: "0",
        note: isArabic ? "يرتبط لاحقًا بعناصر الخدمة" : "Will connect to service items later",
        icon: Activity,
      },
    ],

    overviewCards: [
      {
        title: isArabic ? "الملف الأساسي للعقد" : "Contract Core Profile",
        description: isArabic
          ? "إدارة رقم العقد، تواريخه، أطرافه، وحالته كأساس لكل العمليات اللاحقة."
          : "Manage the contract number, dates, parties, and status as the foundation for future operations.",
        icon: FileSignature,
      },
      {
        title: isArabic ? "الارتباطات التشغيلية" : "Operational Links",
        description: isArabic
          ? "ربط العقد لاحقًا بالمراكز، مقدمي الخدمة، عناصر الخدمة، والطلبات."
          : "Later connect the contract with centers, providers, service items, and orders.",
        icon: Building2,
      },
      {
        title: isArabic ? "الارتباطات المالية" : "Financial Links",
        description: isArabic
          ? "تهيئة ربط العقود بالمدفوعات، العمولات، والفواتير التشغيلية."
          : "Prepare contract linkage with payments, commissions, and operational invoices.",
        icon: HandCoins,
      },
    ],

    actionCards: [
      {
        title: isArabic ? "قائمة العقود" : "Contracts List",
        description: isArabic
          ? "هذه الصفحة تمثل نقطة الدخول لمسار العقود، وسيتم لاحقًا توسيعها إلى قائمة فعلية كاملة."
          : "This page is the entry point for the contracts flow and will later expand into a full contracts list.",
        href: "/system/contracts",
        cta: isArabic ? "الصفحة الحالية" : "Current Page",
        icon: FileSignature,
      },
      {
        title: isArabic ? "إضافة عقد" : "Create Contract",
        description: isArabic
          ? "بناء صفحة إضافة عقد جديد بنفس هوية النظام المعتمدة."
          : "Build the create-contract page using the approved system UI identity.",
        href: "/system/contracts/create",
        cta: isArabic ? "فتح الصفحة" : "Open Page",
        icon: Plus,
      },
      {
        title: isArabic ? "تفاصيل العقد" : "Contract Detail",
        description: isArabic
          ? "تجهيز صفحة التفاصيل وربطها لاحقًا بالخدمات والمدفوعات والمركز."
          : "Prepare the detail page and later connect it with services, payments, and the center.",
        href: "/system/contracts/[id]",
        cta: isArabic ? "لاحقًا" : "Later",
        icon: Eye,
      },
      {
        title: isArabic ? "تقارير العقود" : "Contracts Reports",
        description: isArabic
          ? "إعداد واجهات تقارير العقود والتحليلات التشغيلية والمالية لاحقًا."
          : "Prepare contracts reporting and operational/financial analytics interfaces later.",
        href: "/system/contracts/reports",
        cta: isArabic ? "قريبًا" : "Coming Soon",
        icon: Sparkles,
      },
    ],

    statusItems: [
      {
        label: isArabic ? "حالة الصفحة" : "Page Status",
        value: isArabic ? "جاهزة كأساس UI" : "Ready as UI base",
        icon: BadgeCheck,
      },
      {
        label: isArabic ? "المسار الرسمي" : "Official Route",
        value: "/system/contracts",
        icon: ShieldCheck,
      },
      {
        label: isArabic ? "الربط مع API" : "API Integration",
        value: isArabic ? "لم يبدأ بعد" : "Not started yet",
        icon: CreditCard,
      },
      {
        label: isArabic ? "الخطوة المعتمدة" : "Approved Next Step",
        value: isArabic
          ? "list / create / detail"
          : "list / create / detail",
        icon: ArrowLeft,
      },
      {
        label: isArabic ? "الربط التشغيلي" : "Operational Mapping",
        value: isArabic
          ? "مراكز / مقدمو خدمة / خدمات"
          : "Centers / Providers / Services",
        icon: Users,
      },
    ],

    sampleRowsTitle: isArabic ? "تصور أولي للقائمة" : "Initial List Preview",
    sampleRowsDesc: isArabic
      ? "عرض شكلي مؤقت لما ستكون عليه قائمة العقود بعد الربط."
      : "A temporary visual preview of how the contracts list will look after integration.",

    tableHeaders: {
      contract: isArabic ? "العقد" : "Contract",
      parties: isArabic ? "الأطراف" : "Parties",
      status: isArabic ? "الحالة" : "Status",
      period: isArabic ? "المدة" : "Period",
      actions: isArabic ? "الإجراءات" : "Actions",
    },

    noDataTitle: isArabic ? "لا توجد بيانات فعلية بعد" : "No live data yet",
    noDataText: isArabic
      ? "تم تجهيز صفحة العقود كأساس احترافي للواجهة، وسيتم إظهار العقود الحقيقية بعد ربط الـ APIs وبناء مسار القائمة الفعلي."
      : "The contracts page has been prepared as a professional UI foundation. Live contracts will appear after API integration and after building the actual list flow.",
  };
}

const previewRows = [
  {
    id: 1,
    number: "CTR-2026-001",
    center: "Prime Care Jeddah",
    provider: "Al Noor Medical",
    status: "ACTIVE",
    period: "2026-01-01 → 2026-12-31",
  },
  {
    id: 2,
    number: "CTR-2026-002",
    center: "Prime Care Riyadh",
    provider: "Elite Health Group",
    status: "PENDING",
    period: "2026-02-01 → 2026-08-31",
  },
  {
    id: 3,
    number: "CTR-2026-003",
    center: "Prime Care Dammam",
    provider: "Modern Care Center",
    status: "INACTIVE",
    period: "2025-01-01 → 2025-12-31",
  },
];

function statusBadge(status: string, locale: AppLocale) {
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

export default function SystemContractsPage() {
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
                  href="/system/contracts/create"
                  className="w-full sm:w-auto"
                >
                  <Button className="w-full rounded-2xl sm:w-auto">
                    <Plus className="ms-2 h-4 w-4" />
                    {t.addContract}
                  </Button>
                </Link>

                <Link
                  href="/system/contracts/reports"
                  className="w-full sm:w-auto"
                >
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl sm:w-auto"
                  >
                    <FileText className="ms-2 h-4 w-4" />
                    {t.contractsReports}
                  </Button>
                </Link>
              </div>
            </div>

            <Card className="rounded-3xl border-white/20 bg-white/75 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t.quickStats}</CardTitle>
                <CardDescription>{t.operationalOverview}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
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

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
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

        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-3xl border border-white/20 dark:border-white/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.tableHeaders.contract}</TableHead>
                  <TableHead>{t.tableHeaders.parties}</TableHead>
                  <TableHead>{t.tableHeaders.status}</TableHead>
                  <TableHead>{t.tableHeaders.period}</TableHead>
                  <TableHead>{t.tableHeaders.actions}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {previewRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                          <FileSignature className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold">{row.number}</p>
                          <p className="text-muted-foreground text-xs">
                            ID-{row.id.toString().padStart(4, "0")}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="text-muted-foreground h-3.5 w-3.5" />
                          <span>{row.center}</span>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {row.provider}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>{statusBadge(row.status, locale)}</TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CalendarRange className="text-muted-foreground h-3.5 w-3.5" />
                        <span>{row.period}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="rounded-xl">
                          <Eye className="ms-2 h-4 w-4" />
                          {isArabic ? "عرض" : "View"}
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-xl">
                          <FileText className="ms-2 h-4 w-4" />
                          {isArabic ? "الخدمات" : "Services"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-2xl border border-dashed border-white/30 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5">
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
                <Card
                  key={item.title}
                  className="rounded-3xl border-white/20 bg-white/80 shadow-none dark:border-white/10 dark:bg-white/5"
                >
                  <CardHeader className="space-y-4">
                    <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-2xl">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div>
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <CardDescription className="mt-2 leading-7">
                        {item.description}
                      </CardDescription>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <Link href={item.href}>
                      <Button variant="outline" className="w-full rounded-2xl">
                        {item.cta}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
          <CardHeader>
            <CardTitle>{t.currentStatus}</CardTitle>
            <CardDescription>{t.nextStep}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-3">
              {t.statusItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="flex items-start gap-3 rounded-2xl border border-white/20 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-xs">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold">{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-dashed border-white/30 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-2 flex items-center gap-2">
                <Badge className="rounded-full px-3 py-1">
                  {t.noDataTitle}
                </Badge>
              </div>
              <p className="text-sm leading-7">{t.nextStepText}</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}