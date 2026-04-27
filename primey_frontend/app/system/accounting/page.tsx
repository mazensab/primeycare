import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  BookOpenText,
  Calculator,
  Eye,
  FileBarChart2,
  FileSpreadsheet,
  Filter,
  Landmark,
  LineChart,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
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
    title: isArabic ? "المحاسبة والتقارير المالية" : "Accounting & Financial Reports",
    subtitle: isArabic
      ? "هذه الصفحة تمثل الواجهة الإدارية الرئيسية لمسار المحاسبة داخل Primey Care، وتشمل الملخص العام، التهيئة الأولية للعرض، والوصول السريع إلى القيود والتقارير والسجلات المالية."
      : "This page is the main administrative interface for the accounting flow inside Primey Care, including overview, initial layout, and quick access to journals, reports, and financial records.",

    heroBadge1: isArabic ? "System Module" : "System Module",
    heroBadge2: isArabic ? "Accounting" : "Accounting",

    addJournal: isArabic ? "إضافة قيد جديد" : "Add New Journal",
    accountingReports: isArabic ? "التقارير المحاسبية" : "Accounting Reports",

    quickStats: isArabic ? "ملخص سريع" : "Quick Summary",
    operationalOverview: isArabic ? "نظرة تشغيلية" : "Operational Overview",
    searchPlaceholder: isArabic
      ? "ابحث بالحساب أو القيد أو التقرير..."
      : "Search by account, journal, or report...",
    search: isArabic ? "بحث" : "Search",
    filter: isArabic ? "تصفية" : "Filter",

    operationalCards: isArabic ? "بطاقات تشغيلية" : "Operational Cards",
    quickActions: isArabic ? "إجراءات سريعة" : "Quick Actions",
    currentStatus: isArabic ? "الحالة الحالية" : "Current Status",
    nextStep: isArabic ? "الخطوة التالية" : "Next Step",

    nextStepText: isArabic
      ? "الأساس البصري لصفحة المحاسبة أصبح جاهزًا تحت مساحة النظام الرسمية. الخطوة الصحيحة التالية هي بناء صفحات القيود، دفتر الأستاذ، ميزان المراجعة، الأرباح والخسائر، والمركز المالي وربطها لاحقًا بالـ APIs الحالية."
      : "The visual foundation for accounting is now ready under the official system workspace. The correct next step is to build pages for journals, general ledger, trial balance, profit & loss, and balance sheet, then connect them to the current APIs.",

    stats: [
      {
        title: isArabic ? "إجمالي القيود" : "Total Journal Entries",
        value: "0",
        note: isArabic ? "سيظهر العدد الفعلي بعد الربط" : "Live count after integration",
        icon: BookOpenText,
      },
      {
        title: isArabic ? "الحسابات النشطة" : "Active Accounts",
        value: "0",
        note: isArabic ? "جاهز للربط بدليل الحسابات" : "Ready for chart of accounts",
        icon: BadgeCheck,
      },
      {
        title: isArabic ? "إجمالي الحركة" : "Total Movement",
        value: "0 SAR",
        note: isArabic ? "يرتبط لاحقًا بالتقارير" : "Will connect to reporting later",
        icon: Wallet,
      },
    ],

    overviewCards: [
      {
        title: isArabic ? "القيود اليومية" : "Journal Entries",
        description: isArabic
          ? "تهيئة طبقة القيود اليومية وربطها بالفواتير والمدفوعات والحركات المالية."
          : "Prepare the journal entries layer and link it with invoices, payments, and financial movements.",
        icon: BookOpenText,
      },
      {
        title: isArabic ? "التقارير المالية" : "Financial Reports",
        description: isArabic
          ? "إعداد واجهات ميزان المراجعة، الأرباح والخسائر، والمركز المالي والتقارير التفصيلية."
          : "Prepare interfaces for trial balance, profit & loss, balance sheet, and detailed financial reporting.",
        icon: LineChart,
      },
      {
        title: isArabic ? "الربط التشغيلي" : "Operational Integration",
        description: isArabic
          ? "ربط المحاسبة لاحقًا بالمدفوعات والفواتير والخزينة والمبيعات."
          : "Later connect accounting with payments, invoices, treasury, and sales flows.",
        icon: Activity,
      },
    ],

    actionCards: [
      {
        title: isArabic ? "القيود اليومية" : "Journal Entries",
        description: isArabic
          ? "هذه الصفحة تمثل نقطة الدخول للمحاسبة، وسيتم لاحقًا توسيعها إلى قيود فعلية وتقارير تفصيلية."
          : "This page is the entry point for accounting and will later expand into actual journals and detailed reports.",
        href: "/system/accounting",
        cta: isArabic ? "الصفحة الحالية" : "Current Page",
        icon: BookOpenText,
      },
      {
        title: isArabic ? "إضافة قيد" : "Create Journal",
        description: isArabic
          ? "بناء صفحة إضافة قيد جديد بنفس هوية النظام المعتمدة."
          : "Build the create-journal page using the approved system UI identity.",
        href: "/system/accounting/journals/create",
        cta: isArabic ? "تهيئة الصفحة" : "Prepare Page",
        icon: Plus,
      },
      {
        title: isArabic ? "التقارير" : "Reports",
        description: isArabic
          ? "تجهيز صفحات ميزان المراجعة والأرباح والخسائر والمركز المالي."
          : "Prepare pages for trial balance, profit & loss, and balance sheet.",
        href: "/system/accounting/reports",
        cta: isArabic ? "لاحقًا" : "Later",
        icon: FileBarChart2,
      },
      {
        title: isArabic ? "دفتر الأستاذ" : "General Ledger",
        description: isArabic
          ? "إعداد واجهة دفتر الأستاذ والتفاصيل المحاسبية للحسابات."
          : "Prepare the general ledger interface and detailed accounting views.",
        href: "/system/accounting/general-ledger",
        cta: isArabic ? "قريبًا" : "Coming Soon",
        icon: FileSpreadsheet,
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
        value: "/system/accounting",
        icon: ShieldCheck,
      },
      {
        label: isArabic ? "الربط مع API" : "API Integration",
        value: isArabic ? "لم يبدأ بعد" : "Not started yet",
        icon: FileBarChart2,
      },
      {
        label: isArabic ? "الخطوة المعتمدة" : "Approved Next Step",
        value: isArabic
          ? "journals / reports / ledger"
          : "journals / reports / ledger",
        icon: ArrowLeft,
      },
      {
        label: isArabic ? "الربط التشغيلي" : "Operational Mapping",
        value: isArabic
          ? "فواتير / مدفوعات / خزينة"
          : "Invoices / Payments / Treasury",
        icon: Landmark,
      },
    ],

    sampleRowsTitle: isArabic ? "تصور أولي للتقارير" : "Initial Reports Preview",
    sampleRowsDesc: isArabic
      ? "عرض شكلي مؤقت لما ستكون عليه بعض التقارير والقيم المحاسبية بعد الربط."
      : "A temporary visual preview of what accounting reports and values will look like after integration.",

    tableHeaders: {
      report: isArabic ? "التقرير / القيد" : "Report / Entry",
      category: isArabic ? "الفئة" : "Category",
      status: isArabic ? "الحالة" : "Status",
      amount: isArabic ? "القيمة" : "Amount",
      actions: isArabic ? "الإجراءات" : "Actions",
    },

    noDataTitle: isArabic ? "لا توجد بيانات فعلية بعد" : "No live data yet",
    noDataText: isArabic
      ? "تم تجهيز صفحة المحاسبة كأساس احترافي للواجهة، وسيتم إظهار البيانات المحاسبية الحقيقية بعد ربط الـ APIs وبناء المسارات الفعلية."
      : "The accounting page has been prepared as a professional UI foundation. Live accounting data will appear after API integration and after building the actual flows.",
  };
}

const previewRows = [
  {
    id: 1,
    name: "Trial Balance",
    category: "Report",
    status: "READY",
    amount: "0 SAR",
  },
  {
    id: 2,
    name: "Profit & Loss",
    category: "Financial Statement",
    status: "READY",
    amount: "0 SAR",
  },
  {
    id: 3,
    name: "Journal Entry #0001",
    category: "Journal",
    status: "DRAFT",
    amount: "0 SAR",
  },
];

function statusBadge(status: string, locale: AppLocale) {
  const isArabic = locale === "ar";

  if (status === "READY") {
    return (
      <Badge className="rounded-full px-3 py-1">
        {isArabic ? "جاهز" : "Ready"}
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

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {isArabic ? "معلق" : "Pending"}
    </Badge>
  );
}

export default function SystemAccountingPage() {
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
                  href="/system/accounting/journals/create"
                  className="w-full sm:w-auto"
                >
                  <Button className="w-full rounded-2xl sm:w-auto">
                    <Plus className="ms-2 h-4 w-4" />
                    {t.addJournal}
                  </Button>
                </Link>

                <Link
                  href="/system/accounting/reports"
                  className="w-full sm:w-auto"
                >
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl sm:w-auto"
                  >
                    <FileBarChart2 className="ms-2 h-4 w-4" />
                    {t.accountingReports}
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
                  <TableHead>{t.tableHeaders.report}</TableHead>
                  <TableHead>{t.tableHeaders.category}</TableHead>
                  <TableHead>{t.tableHeaders.status}</TableHead>
                  <TableHead>{t.tableHeaders.amount}</TableHead>
                  <TableHead>{t.tableHeaders.actions}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {previewRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                          <Calculator className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold">{row.name}</p>
                          <p className="text-muted-foreground text-xs">
                            ID-{row.id.toString().padStart(4, "0")}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Scale className="text-muted-foreground h-3.5 w-3.5" />
                        <span>{row.category}</span>
                      </div>
                    </TableCell>

                    <TableCell>{statusBadge(row.status, locale)}</TableCell>

                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="rounded-full px-3 py-1"
                      >
                        {row.amount}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="rounded-xl">
                          <Eye className="ms-2 h-4 w-4" />
                          {isArabic ? "عرض" : "View"}
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-xl">
                          <LineChart className="ms-2 h-4 w-4" />
                          {isArabic ? "التقرير" : "Report"}
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
                    <div className="flex items-start justify-between gap-3">
                      <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-2xl">
                        <Icon className="h-5 w-5" />
                      </div>

                      <Badge variant="secondary" className="rounded-full">
                        Module
                      </Badge>
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