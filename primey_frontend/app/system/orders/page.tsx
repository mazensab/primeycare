import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  CalendarRange,
  CreditCard,
  Eye,
  FileText,
  Filter,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  UserRound,
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
    title: isArabic ? "إدارة الطلبات" : "Orders Management",
    subtitle: isArabic
      ? "هذه الصفحة تمثل الواجهة الإدارية الرئيسية لإدارة الطلبات داخل Primey Care، وتشمل الملخص العام، التهيئة الأولية للعرض، والوصول السريع إلى مسارات الطلبات والعملاء والمنتجات والمدفوعات."
      : "This page is the main administrative interface for managing orders inside Primey Care, including overview, initial layout, and quick access to orders, customers, products, and payments.",

    heroBadge1: isArabic ? "System Module" : "System Module",
    heroBadge2: isArabic ? "Orders" : "Orders",

    addOrder: isArabic ? "إضافة طلب جديد" : "Add New Order",
    ordersReports: isArabic ? "تقارير الطلبات" : "Orders Reports",

    quickStats: isArabic ? "ملخص سريع" : "Quick Summary",
    operationalOverview: isArabic ? "نظرة تشغيلية" : "Operational Overview",
    searchPlaceholder: isArabic
      ? "ابحث برقم الطلب أو العميل أو الحالة..."
      : "Search by order number, customer, or status...",
    search: isArabic ? "بحث" : "Search",
    filter: isArabic ? "تصفية" : "Filter",

    operationalCards: isArabic ? "بطاقات تشغيلية" : "Operational Cards",
    quickActions: isArabic ? "إجراءات سريعة" : "Quick Actions",
    currentStatus: isArabic ? "الحالة الحالية" : "Current Status",
    nextStep: isArabic ? "الخطوة التالية" : "Next Step",

    nextStepText: isArabic
      ? "الأساس البصري لصفحة الطلبات أصبح جاهزًا تحت مساحة النظام الرسمية. الخطوة الصحيحة التالية هي بناء القائمة الفعلية للطلبات وربطها لاحقًا بالعملاء والمنتجات والعقود والفواتير والمدفوعات."
      : "The visual foundation for orders is now ready under the official system workspace. The correct next step is to build the actual orders list and later connect it with customers, products, contracts, invoices, and payments.",

    stats: [
      {
        title: isArabic ? "إجمالي الطلبات" : "Total Orders",
        value: "0",
        note: isArabic ? "سيظهر العدد الفعلي بعد الربط" : "Live count after integration",
        icon: ShoppingCart,
      },
      {
        title: isArabic ? "الطلبات النشطة" : "Active Orders",
        value: "0",
        note: isArabic ? "جاهز لحالة النشاط" : "Ready for active status",
        icon: BadgeCheck,
      },
      {
        title: isArabic ? "طلبات بانتظار السداد" : "Pending Payment Orders",
        value: "0",
        note: isArabic ? "يرتبط لاحقًا بالمدفوعات" : "Will connect to payments later",
        icon: CreditCard,
      },
    ],

    overviewCards: [
      {
        title: isArabic ? "الملف الأساسي للطلب" : "Order Core Profile",
        description: isArabic
          ? "إدارة رقم الطلب، العميل، حالته، وتواريخه كأساس لكل العمليات اللاحقة."
          : "Manage order number, customer, status, and dates as the foundation for future operations.",
        icon: ShoppingCart,
      },
      {
        title: isArabic ? "الارتباطات التشغيلية" : "Operational Links",
        description: isArabic
          ? "ربط الطلب لاحقًا بالعميل والمنتجات والخدمات والعقود."
          : "Later connect the order with the customer, products, services, and contracts.",
        icon: Package,
      },
      {
        title: isArabic ? "التنفيذ والتسليم" : "Fulfillment & Delivery",
        description: isArabic
          ? "تهيئة ربط الطلبات بالتنفيذ والتسليم والحالات التشغيلية المختلفة."
          : "Prepare order linkage with fulfillment, delivery, and various operational statuses.",
        icon: Truck,
      },
    ],

    actionCards: [
      {
        title: isArabic ? "قائمة الطلبات" : "Orders List",
        description: isArabic
          ? "هذه الصفحة تمثل نقطة الدخول لمسار الطلبات، وسيتم لاحقًا توسيعها إلى قائمة فعلية كاملة."
          : "This page is the entry point for the orders flow and will later expand into a full orders list.",
        href: "/system/orders",
        cta: isArabic ? "الصفحة الحالية" : "Current Page",
        icon: ShoppingCart,
      },
      {
        title: isArabic ? "إضافة طلب" : "Create Order",
        description: isArabic
          ? "بناء صفحة إضافة طلب جديد بنفس هوية النظام المعتمدة."
          : "Build the create-order page using the approved system UI identity.",
        href: "/system/orders/create",
        cta: isArabic ? "فتح الصفحة" : "Open Page",
        icon: Plus,
      },
      {
        title: isArabic ? "تفاصيل الطلب" : "Order Detail",
        description: isArabic
          ? "تجهيز صفحة التفاصيل وربطها لاحقًا بالعميل والمنتجات والفاتورة."
          : "Prepare the detail page and later connect it with the customer, products, and invoice.",
        href: "/system/orders/[id]",
        cta: isArabic ? "لاحقًا" : "Later",
        icon: Eye,
      },
      {
        title: isArabic ? "تقارير الطلبات" : "Orders Reports",
        description: isArabic
          ? "إعداد واجهات تقارير الطلبات والتحليلات التشغيلية والمالية لاحقًا."
          : "Prepare orders reporting and operational/financial analytics interfaces later.",
        href: "/system/orders/reports",
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
        value: "/system/orders",
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
          ? "عملاء / منتجات / فواتير"
          : "Customers / Products / Invoices",
        icon: FileText,
      },
    ],

    sampleRowsTitle: isArabic ? "تصور أولي للقائمة" : "Initial List Preview",
    sampleRowsDesc: isArabic
      ? "عرض شكلي مؤقت لما ستكون عليه قائمة الطلبات بعد الربط."
      : "A temporary visual preview of how the orders list will look after integration.",

    tableHeaders: {
      order: isArabic ? "الطلب" : "Order",
      customer: isArabic ? "العميل" : "Customer",
      status: isArabic ? "الحالة" : "Status",
      amount: isArabic ? "القيمة" : "Amount",
      actions: isArabic ? "الإجراءات" : "Actions",
    },

    noDataTitle: isArabic ? "لا توجد بيانات فعلية بعد" : "No live data yet",
    noDataText: isArabic
      ? "تم تجهيز صفحة الطلبات كأساس احترافي للواجهة، وسيتم إظهار الطلبات الحقيقية بعد ربط الـ APIs وبناء مسار القائمة الفعلي."
      : "The orders page has been prepared as a professional UI foundation. Live orders will appear after API integration and after building the actual list flow.",
  };
}

const previewRows = [
  {
    id: 1,
    number: "ORD-2026-001",
    customer: "Ahmed Ali",
    status: "CONFIRMED",
    amount: "1,250 SAR",
    date: "2026-04-01",
  },
  {
    id: 2,
    number: "ORD-2026-002",
    customer: "Sara Hassan",
    status: "PENDING",
    amount: "890 SAR",
    date: "2026-04-07",
  },
  {
    id: 3,
    number: "ORD-2026-003",
    customer: "Mohammed Salem",
    status: "PROCESSING",
    amount: "2,100 SAR",
    date: "2026-04-10",
  },
];

function statusBadge(status: string, locale: AppLocale) {
  const isArabic = locale === "ar";

  if (status === "CONFIRMED") {
    return (
      <Badge className="rounded-full px-3 py-1">
        {isArabic ? "مؤكد" : "Confirmed"}
      </Badge>
    );
  }

  if (status === "PENDING") {
    return (
      <Badge variant="secondary" className="rounded-full px-3 py-1">
        {isArabic ? "قيد الانتظار" : "Pending"}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {isArabic ? "قيد التنفيذ" : "Processing"}
    </Badge>
  );
}

export default function SystemOrdersPage() {
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
                <Link href="/system/orders/create" className="w-full sm:w-auto">
                  <Button className="w-full rounded-2xl sm:w-auto">
                    <Plus className="ms-2 h-4 w-4" />
                    {t.addOrder}
                  </Button>
                </Link>

                <Link href="/system/orders/reports" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl sm:w-auto"
                  >
                    <FileText className="ms-2 h-4 w-4" />
                    {t.ordersReports}
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
                  <TableHead>{t.tableHeaders.order}</TableHead>
                  <TableHead>{t.tableHeaders.customer}</TableHead>
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
                          <ShoppingCart className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold">{row.number}</p>
                          <p className="text-muted-foreground text-xs">
                            <span className="inline-flex items-center gap-1">
                              <CalendarRange className="h-3.5 w-3.5" />
                              {row.date}
                            </span>
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{row.customer}</p>
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
                          <CreditCard className="ms-2 h-4 w-4" />
                          {isArabic ? "الدفع" : "Payment"}
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