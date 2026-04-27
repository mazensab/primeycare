import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CreditCard,
  Eye,
  FileText,
  Filter,
  HandCoins,
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
    title: isArabic ? "إدارة المدفوعات" : "Payments Management",
    subtitle: isArabic
      ? "هذه الصفحة تمثل الواجهة الإدارية الرئيسية لإدارة المدفوعات داخل Primey Care، وتشمل الملخص العام، التهيئة الأولية للعرض، والوصول السريع إلى مسارات التحصيل والتسويات والفواتير والعملاء."
      : "This page is the main administrative interface for managing payments inside Primey Care, including overview, initial layout, and quick access to collections, settlements, invoices, and customers.",

    heroBadge1: isArabic ? "System Module" : "System Module",
    heroBadge2: isArabic ? "Payments" : "Payments",

    addPayment: isArabic ? "إضافة دفعة جديدة" : "Add New Payment",
    paymentReports: isArabic ? "تقارير المدفوعات" : "Payment Reports",

    quickStats: isArabic ? "ملخص سريع" : "Quick Summary",
    operationalOverview: isArabic ? "نظرة تشغيلية" : "Operational Overview",
    searchPlaceholder: isArabic
      ? "ابحث برقم الدفعة أو العميل أو المرجع..."
      : "Search by payment number, customer, or reference...",
    search: isArabic ? "بحث" : "Search",
    filter: isArabic ? "تصفية" : "Filter",

    operationalCards: isArabic ? "بطاقات تشغيلية" : "Operational Cards",
    quickActions: isArabic ? "إجراءات سريعة" : "Quick Actions",
    currentStatus: isArabic ? "الحالة الحالية" : "Current Status",
    nextStep: isArabic ? "الخطوة التالية" : "Next Step",

    nextStepText: isArabic
      ? "الأساس البصري لصفحة المدفوعات أصبح جاهزًا تحت مساحة النظام الرسمية. الخطوة الصحيحة التالية هي بناء القائمة الفعلية للمدفوعات وربطها لاحقًا بالفواتير والطلبات والعملاء والخزينة والمحاسبة."
      : "The visual foundation for payments is now ready under the official system workspace. The correct next step is to build the actual payments list and later connect it with invoices, orders, customers, treasury, and accounting.",

    stats: [
      {
        title: isArabic ? "إجمالي المدفوعات" : "Total Payments",
        value: "0",
        note: isArabic ? "سيظهر العدد الفعلي بعد الربط" : "Live count after integration",
        icon: CreditCard,
      },
      {
        title: isArabic ? "المدفوعات المؤكدة" : "Confirmed Payments",
        value: "0",
        note: isArabic ? "جاهز لحالة التأكيد" : "Ready for confirmation status",
        icon: BadgeCheck,
      },
      {
        title: isArabic ? "إجمالي التحصيل" : "Total Collections",
        value: "0 SAR",
        note: isArabic ? "يرتبط لاحقًا بالخزينة" : "Will connect to treasury later",
        icon: Wallet,
      },
    ],

    overviewCards: [
      {
        title: isArabic ? "ملف الدفعة الأساسي" : "Payment Core Profile",
        description: isArabic
          ? "إدارة رقم الدفعة، المرجع، العميل، وطريقة الدفع كأساس لكل العمليات اللاحقة."
          : "Manage payment number, reference, customer, and payment method as the foundation for future operations.",
        icon: ReceiptText,
      },
      {
        title: isArabic ? "التحصيل والتسوية" : "Collection & Settlement",
        description: isArabic
          ? "تهيئة طبقة التحصيل، التسوية، المطابقة، وربط المدفوعات بالحالات المالية."
          : "Prepare the layer for collections, settlements, matching, and linking payments to financial statuses.",
        icon: HandCoins,
      },
      {
        title: isArabic ? "الارتباطات التشغيلية" : "Operational Links",
        description: isArabic
          ? "ربط الدفعة لاحقًا بالطلبات، الفواتير، الخزينة، والمحاسبة والتقارير."
          : "Later connect the payment with orders, invoices, treasury, accounting, and reports.",
        icon: Activity,
      },
    ],

    actionCards: [
      {
        title: isArabic ? "قائمة المدفوعات" : "Payments List",
        description: isArabic
          ? "هذه الصفحة تمثل نقطة الدخول لمسار المدفوعات، وسيتم لاحقًا توسيعها إلى قائمة فعلية كاملة."
          : "This page is the entry point for the payments flow and will later expand into a full payments list.",
        href: "/system/payments",
        cta: isArabic ? "الصفحة الحالية" : "Current Page",
        icon: CreditCard,
      },
      {
        title: isArabic ? "إضافة دفعة" : "Create Payment",
        description: isArabic
          ? "بناء صفحة إضافة دفعة جديدة بنفس هوية النظام المعتمدة."
          : "Build the create-payment page using the approved system UI identity.",
        href: "/system/payments/create",
        cta: isArabic ? "فتح الصفحة" : "Open Page",
        icon: Plus,
      },
      {
        title: isArabic ? "تفاصيل الدفعة" : "Payment Detail",
        description: isArabic
          ? "تجهيز صفحة التفاصيل وربطها لاحقًا بالفاتورة والطلب وحالة التسوية."
          : "Prepare the detail page and later connect it with invoice, order, and settlement status.",
        href: "/system/payments/[id]",
        cta: isArabic ? "لاحقًا" : "Later",
        icon: Eye,
      },
      {
        title: isArabic ? "تقارير المدفوعات" : "Payment Reports",
        description: isArabic
          ? "إعداد واجهات تقارير المدفوعات والتحليلات المالية لاحقًا."
          : "Prepare payment reporting and financial analytics interfaces later.",
        href: "/system/payments/reports",
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
        value: "/system/payments",
        icon: ShieldCheck,
      },
      {
        label: isArabic ? "الربط مع API" : "API Integration",
        value: isArabic ? "لم يبدأ بعد" : "Not started yet",
        icon: CreditCard,
      },
      {
        label: isArabic ? "الخطوة المعتمدة" : "Approved Next Step",
        value: isArabic ? "list / create / detail" : "list / create / detail",
        icon: ArrowLeft,
      },
      {
        label: isArabic ? "الربط التشغيلي" : "Operational Mapping",
        value: isArabic
          ? "طلبات / فواتير / خزينة"
          : "Orders / Invoices / Treasury",
        icon: Landmark,
      },
    ],

    sampleRowsTitle: isArabic ? "تصور أولي للقائمة" : "Initial List Preview",
    sampleRowsDesc: isArabic
      ? "عرض شكلي مؤقت لما ستكون عليه قائمة المدفوعات بعد الربط."
      : "A temporary visual preview of how the payments list will look after integration.",

    tableHeaders: {
      payment: isArabic ? "الدفعة" : "Payment",
      customer: isArabic ? "العميل" : "Customer",
      method: isArabic ? "الطريقة" : "Method",
      status: isArabic ? "الحالة" : "Status",
      amount: isArabic ? "القيمة" : "Amount",
      actions: isArabic ? "الإجراءات" : "Actions",
    },

    noDataTitle: isArabic ? "لا توجد بيانات فعلية بعد" : "No live data yet",
    noDataText: isArabic
      ? "تم تجهيز صفحة المدفوعات كأساس احترافي للواجهة، وسيتم إظهار المدفوعات الحقيقية بعد ربط الـ APIs وبناء مسار القائمة الفعلي."
      : "The payments page has been prepared as a professional UI foundation. Live payments will appear after API integration and after building the actual list flow.",
  };
}

const previewRows = [
  {
    id: 1,
    paymentNo: "PAY-2026-001",
    customer: "Ahmed Ali",
    method: "Bank Transfer",
    status: "CONFIRMED",
    amount: "299 SAR",
    reference: "TRX-1001",
  },
  {
    id: 2,
    paymentNo: "PAY-2026-002",
    customer: "Sara Hassan",
    method: "Card",
    status: "PENDING",
    amount: "499 SAR",
    reference: "TRX-1002",
  },
  {
    id: 3,
    paymentNo: "PAY-2026-003",
    customer: "Mohammed Salem",
    method: "Cash",
    status: "FAILED",
    amount: "149 SAR",
    reference: "TRX-1003",
  },
];

function statusBadge(status: string, locale: AppLocale) {
  const isArabic = locale === "ar";

  if (status === "CONFIRMED") {
    return (
      <Badge className="rounded-full px-3 py-1">
        {isArabic ? "مؤكدة" : "Confirmed"}
      </Badge>
    );
  }

  if (status === "PENDING") {
    return (
      <Badge variant="secondary" className="rounded-full px-3 py-1">
        {isArabic ? "معلقة" : "Pending"}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {isArabic ? "فاشلة" : "Failed"}
    </Badge>
  );
}

export default function SystemPaymentsPage() {
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
                <Link href="/system/payments/create" className="w-full sm:w-auto">
                  <Button className="w-full rounded-2xl sm:w-auto">
                    <Plus className="ms-2 h-4 w-4" />
                    {t.addPayment}
                  </Button>
                </Link>

                <Link href="/system/payments/reports" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl sm:w-auto"
                  >
                    <FileText className="ms-2 h-4 w-4" />
                    {t.paymentReports}
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
                  <TableHead>{t.tableHeaders.payment}</TableHead>
                  <TableHead>{t.tableHeaders.customer}</TableHead>
                  <TableHead>{t.tableHeaders.method}</TableHead>
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
                          <CreditCard className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold">{row.paymentNo}</p>
                          <p className="text-muted-foreground text-xs">
                            {row.reference}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{row.customer}</p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                        {row.method}
                      </Badge>
                    </TableCell>

                    <TableCell>{statusBadge(row.status, locale)}</TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
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
                          <ReceiptText className="ms-2 h-4 w-4" />
                          {isArabic ? "الفاتورة" : "Invoice"}
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