import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Building2,
  Eye,
  FileBarChart2,
  FileText,
  Filter,
  Landmark,
  Plus,
  ReceiptText,
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

type AppLocale = "ar" | "en";

type PreviewRow = {
  id: number;
  account: string;
  movement: string;
  status: "POSTED" | "PENDING" | "DRAFT";
  amount: string;
};

function detectLocale(): AppLocale {
  return "ar";
}

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "الخزينة والحسابات المالية" : "Treasury & Financial Accounts",
    subtitle: isArabic
      ? "واجهة system الرسمية لمسار الخزينة داخل Primey Care، وتشمل الملخص التشغيلي، نظرة أولية للحسابات والحركات، ونقطة انطلاق منظمة لبناء الصناديق والحسابات البنكية والتقارير لاحقًا."
      : "The official system interface for the treasury flow inside Primey Care, including an operational overview, an initial preview of accounts and treasury movements, and a structured foundation for building cashboxes, bank accounts, and reports later.",

    heroBadge1: isArabic ? "System Workspace" : "System Workspace",
    heroBadge2: isArabic ? "Treasury Module" : "Treasury Module",

    addMovement: isArabic ? "إضافة حركة مالية" : "Add Financial Movement",
    treasuryReports: isArabic ? "تقارير الخزينة" : "Treasury Reports",

    quickStats: isArabic ? "ملخص سريع" : "Quick Summary",
    operationalOverview: isArabic ? "نظرة تشغيلية" : "Operational Overview",
    searchPlaceholder: isArabic
      ? "ابحث بالصندوق أو الحساب أو نوع الحركة..."
      : "Search by cashbox, account, or movement type...",
    search: isArabic ? "بحث" : "Search",
    filter: isArabic ? "تصفية" : "Filter",

    operationalCards: isArabic ? "المرتكزات التشغيلية" : "Operational Foundations",
    quickActions: isArabic ? "إجراءات سريعة" : "Quick Actions",
    currentStatus: isArabic ? "الحالة الحالية" : "Current Status",
    nextStep: isArabic ? "الخطوة التالية" : "Next Step",

    nextStepText: isArabic
      ? "الواجهة أصبحت جاهزة بصريًا داخل shell النظام الرسمي. الخطوة الأفضل التالية هي بناء مسارات الحسابات والصناديق والحركات والتقارير تحت ‎/system/... ثم ربطها تدريجيًا مع Treasury API الحالية."
      : "The interface is now visually aligned with the official system shell. The best next step is to build the accounts, cashboxes, movements, and reports flows under /system/... and then connect them gradually to the current Treasury APIs.",

    stats: [
      {
        title: isArabic ? "إجمالي الصناديق والحسابات" : "Total Cashboxes & Accounts",
        value: "0",
        note: isArabic ? "يظهر بعد الربط" : "Visible after integration",
        icon: Landmark,
      },
      {
        title: isArabic ? "الحسابات النشطة" : "Active Accounts",
        value: "0",
        note: isArabic ? "جاهز لحالة النشاط" : "Ready for active state",
        icon: BadgeCheck,
      },
      {
        title: isArabic ? "الرصيد الإجمالي" : "Total Balance",
        value: "0 SAR",
        note: isArabic ? "يرتبط بالحركات لاحقًا" : "Will link to movements later",
        icon: Wallet,
      },
      {
        title: isArabic ? "الحركات المرحّلة" : "Posted Movements",
        value: "0",
        note: isArabic ? "مؤشر تشغيلي لاحقًا" : "Operational indicator later",
        icon: Banknote,
      },
    ],

    overviewCards: [
      {
        title: isArabic ? "الصناديق والحسابات" : "Cashboxes & Accounts",
        description: isArabic
          ? "تهيئة طبقة الصناديق النقدية والحسابات البنكية وربطها بالأرصدة والحركات والرصد اليومي."
          : "Prepare the layer for cashboxes and bank accounts and connect them to balances, treasury movements, and daily monitoring.",
        icon: Landmark,
      },
      {
        title: isArabic ? "الحركات المالية" : "Financial Movements",
        description: isArabic
          ? "بناء واجهات سندات القبض والصرف والتحويل والحركات المرتبطة بالمدفوعات والتسويات."
          : "Build interfaces for receipts, disbursements, transfers, and movements related to payments and settlements.",
        icon: Banknote,
      },
      {
        title: isArabic ? "الربط التشغيلي" : "Operational Integration",
        description: isArabic
          ? "ربط الخزينة لاحقًا بالمدفوعات والفواتير والمحاسبة والتقارير المالية."
          : "Later connect treasury with payments, invoices, accounting, and financial reporting.",
        icon: Activity,
      },
    ],

    actionCards: [
      {
        title: isArabic ? "واجهة الخزينة الرئيسية" : "Treasury Main Interface",
        description: isArabic
          ? "هذه الصفحة هي نقطة الدخول الرسمية لمسار الخزينة داخل system."
          : "This page is the official entry point for the treasury flow inside system.",
        href: "/system/treasury",
        cta: isArabic ? "أنت هنا" : "You Are Here",
        icon: Landmark,
      },
      {
        title: isArabic ? "إضافة حركة مالية" : "Create Movement",
        description: isArabic
          ? "الانتقال لاحقًا إلى صفحة إضافة حركة مالية جديدة بنفس هوية النظام المعتمدة."
          : "Later navigate to the create financial movement page using the approved system identity.",
        href: "/system/treasury",
        cta: isArabic ? "يجهز لاحقًا" : "Prepare Later",
        icon: Plus,
      },
      {
        title: isArabic ? "عرض الحركات والتفاصيل" : "Movements & Details",
        description: isArabic
          ? "تجهيز صفحات قائمة الحركات والتفاصيل وربطها لاحقًا بالتحصيل والصرف والتحويل."
          : "Prepare movement list and detail pages, then later connect them to collections, disbursements, and transfers.",
        href: "/system/treasury",
        cta: isArabic ? "لاحقًا" : "Later",
        icon: Eye,
      },
      {
        title: isArabic ? "تقارير الخزينة" : "Treasury Reports",
        description: isArabic
          ? "إعداد واجهات تقارير الأرصدة والتدفقات المالية والحركة اليومية."
          : "Prepare interfaces for balance, cash flow, and daily treasury reporting.",
        href: "/system/treasury",
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
        value: isArabic
          ? "مدفوعات / فواتير / محاسبة"
          : "Payments / Invoices / Accounting",
        icon: Building2,
      },
    ],

    sampleRowsTitle: isArabic ? "معاينة أولية للحركات" : "Initial Movements Preview",
    sampleRowsDesc: isArabic
      ? "عرض بصري مؤقت يوضّح شكل الحسابات والحركات المالية عند ربط البيانات الحقيقية."
      : "A temporary visual preview of how accounts and treasury movements will appear after live data integration.",

    tableHeaders: {
      account: isArabic ? "الحساب / الصندوق" : "Account / Cashbox",
      movement: isArabic ? "الحركة" : "Movement",
      status: isArabic ? "الحالة" : "Status",
      amount: isArabic ? "القيمة" : "Amount",
      actions: isArabic ? "الإجراءات" : "Actions",
    },

    noDataTitle: isArabic ? "لا توجد بيانات فعلية بعد" : "No Live Data Yet",
    noDataText: isArabic
      ? "تم تجهيز صفحة الخزينة كأساس احترافي متوافق مع النظام الرسمي. سيظهر المحتوى الحقيقي بعد ربط الـ APIs وبناء مسارات الحسابات والحركات والتقارير."
      : "The treasury page is prepared as a professional foundation aligned with the official system. Real content will appear after wiring the APIs and building the accounts, movements, and reports flows.",

    view: isArabic ? "عرض" : "View",
    movement: isArabic ? "الحركة" : "Movement",
  };
}

const previewRows: PreviewRow[] = [
  {
    id: 1,
    account: "الخزينة الرئيسية",
    movement: "سند قبض",
    status: "POSTED",
    amount: "299 SAR",
  },
  {
    id: 2,
    account: "الحساب البنكي - الراجحي",
    movement: "تحويل بنكي",
    status: "PENDING",
    amount: "499 SAR",
  },
  {
    id: 3,
    account: "صندوق الفرع",
    movement: "سند صرف",
    status: "DRAFT",
    amount: "149 SAR",
  },
];

function statusBadge(status: PreviewRow["status"], locale: AppLocale) {
  const isArabic = locale === "ar";

  if (status === "POSTED") {
    return (
      <Badge className="rounded-full px-3 py-1">
        {isArabic ? "مرحل" : "Posted"}
      </Badge>
    );
  }

  if (status === "PENDING") {
    return (
      <Badge variant="secondary" className="rounded-full px-3 py-1">
        {isArabic ? "معلق" : "Pending"}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {isArabic ? "مسودة" : "Draft"}
    </Badge>
  );
}

export default function SystemTreasuryPage() {
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
                <Link href="/system/treasury" className="w-full sm:w-auto">
                  <Button className="w-full rounded-2xl sm:w-auto">
                    <Plus className="ms-2 h-4 w-4" />
                    {t.addMovement}
                  </Button>
                </Link>

                <Link href="/system/treasury" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl sm:w-auto"
                  >
                    <FileBarChart2 className="ms-2 h-4 w-4" />
                    {t.treasuryReports}
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
                    {t.tableHeaders.account}
                  </th>
                  <th className="px-4 py-4 text-start font-semibold">
                    {t.tableHeaders.movement}
                  </th>
                  <th className="px-4 py-4 text-start font-semibold">
                    {t.tableHeaders.status}
                  </th>
                  <th className="px-4 py-4 text-start font-semibold">
                    {t.tableHeaders.amount}
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
                          <Landmark className="h-4 w-4" />
                        </div>

                        <div>
                          <p className="font-semibold">{row.account}</p>
                          <p className="text-muted-foreground text-xs">
                            ID-{row.id.toString().padStart(4, "0")}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <ReceiptText className="text-muted-foreground h-3.5 w-3.5" />
                        <span>{row.movement}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4">{statusBadge(row.status, locale)}</td>

                    <td className="px-4 py-4">
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                        {row.amount}
                      </Badge>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="rounded-xl">
                          <Eye className="ms-2 h-4 w-4" />
                          {t.view}
                        </Button>

                        <Button variant="outline" size="sm" className="rounded-xl">
                          <Banknote className="ms-2 h-4 w-4" />
                          {t.movement}
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