"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileText,
  Globe,
  HandCoins,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Star,
  TrendingUp,
  UserCog,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AppLocale = "ar" | "en";

type AgentStatus = "active" | "pending" | "suspended";

type AgentDetails = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  status: AgentStatus;
  city: string;
  district: string;
  phone: string;
  email: string;
  nationalId: string;
  joinedAt: string;
  type: string;
  rating: number;
  totalSales: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
  customersCount: number;
  ordersCount: number;
  invoicesCount: number;
  conversionRate: number;
};

type ActivityItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  tone: "success" | "warning" | "info";
};

type RelatedOrder = {
  id: string;
  customer: string;
  product: string;
  status: string;
  amount: number;
  date: string;
};

const SAR_ICON = "/currency/sar.svg";

const mockAgent: AgentDetails = {
  id: "1",
  code: "AG-1001",
  nameAr: "أحمد محمد الحربي",
  nameEn: "Ahmed Mohammed Alharbi",
  status: "active",
  city: "جدة",
  district: "الروضة",
  phone: "+966500000000",
  email: "agent@primeycare.com",
  nationalId: "1000000000",
  joinedAt: "2026-01-15",
  type: "مندوب مبيعات",
  rating: 4.8,
  totalSales: 48600,
  totalCommission: 4860,
  paidCommission: 3200,
  pendingCommission: 1660,
  customersCount: 124,
  ordersCount: 86,
  invoicesCount: 72,
  conversionRate: 68,
};

const relatedOrders: RelatedOrder[] = [
  {
    id: "ORD-1024",
    customer: "سارة خالد",
    product: "بطاقة Primey Care",
    status: "مكتمل",
    amount: 200,
    date: "2026-04-22",
  },
  {
    id: "ORD-1021",
    customer: "محمد عبدالله",
    product: "برنامج الأسنان",
    status: "بانتظار الدفع",
    amount: 750,
    date: "2026-04-20",
  },
  {
    id: "ORD-1017",
    customer: "نورة سالم",
    product: "برنامج الولادة",
    status: "مكتمل",
    amount: 1500,
    date: "2026-04-18",
  },
];

const activityItems: ActivityItem[] = [
  {
    id: "ACT-1",
    title: "تم تسجيل طلب جديد",
    description: "تم إنشاء طلب جديد مرتبط بالمندوب.",
    date: "2026-04-22",
    tone: "success",
  },
  {
    id: "ACT-2",
    title: "عمولة بانتظار الاعتماد",
    description: "تم احتساب عمولة جديدة وتحتاج اعتماد مالي.",
    date: "2026-04-21",
    tone: "warning",
  },
  {
    id: "ACT-3",
    title: "تحديث بيانات التواصل",
    description: "تم تحديث رقم الجوال والبريد الإلكتروني.",
    date: "2026-04-18",
    tone: "info",
  },
];

function readLocale(): AppLocale {
  if (typeof window === "undefined") return "ar";

  const htmlLang = document.documentElement.lang;
  if (htmlLang === "en") return "en";

  const stored =
    window.localStorage.getItem("primey-locale") ||
    window.localStorage.getItem("locale");

  return stored === "en" ? "en" : "ar";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string, locale: AppLocale) {
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

function StatusBadge({ status }: { status: AgentStatus }) {
  if (status === "active") {
    return (
      <Badge className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50">
        نشط
      </Badge>
    );
  }

  if (status === "pending") {
    return (
      <Badge className="rounded-full bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50">
        بانتظار الاعتماد
      </Badge>
    );
  }

  return (
    <Badge className="rounded-full bg-rose-50 px-3 py-1 text-rose-700 hover:bg-rose-50">
      موقوف
    </Badge>
  );
}

function MoneyValue({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold">
      <Image
        src={SAR_ICON}
        alt="SAR"
        width={15}
        height={15}
        className="inline-block"
      />
      {formatNumber(value)}
    </span>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: React.ReactNode;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        <div className="rounded-2xl bg-muted p-3">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border bg-background p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-muted p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>

      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

export default function AgentDetailsPage() {
  const params = useParams<{ id: string }>();
  const locale = readLocale();

  const agent = useMemo(() => {
    return {
      ...mockAgent,
      id: params?.id || mockAgent.id,
    };
  }, [params?.id]);

  const balance = agent.totalCommission - agent.paidCommission;

  function handleCopy(value: string, label: string) {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`تم نسخ ${label} بنجاح`))
      .catch(() => toast.error("تعذر النسخ، حاول مرة أخرى"));
  }

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          <div className="relative p-6 md:p-8">
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-l from-primary/10 via-primary/5 to-transparent" />

            <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-5 md:flex-row md:items-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
                  <UserCog className="h-10 w-10 text-primary" />
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={agent.status} />

                    <Badge
                      variant="outline"
                      className="rounded-full px-3 py-1"
                    >
                      {agent.code}
                    </Badge>

                    <Badge
                      variant="outline"
                      className="rounded-full px-3 py-1"
                    >
                      {agent.type}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      النظام / المندوبون / تفاصيل المندوب
                    </p>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
                      {agent.nameAr}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {agent.nameEn}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {agent.city} - {agent.district}
                    </span>

                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" />
                      انضم في {formatDate(agent.joinedAt, locale)}
                    </span>

                    <span className="inline-flex items-center gap-1">
                      <Star className="h-4 w-4" />
                      {agent.rating} / 5
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" className="rounded-2xl">
                  <Link href="/system/agents">
                    <ArrowLeft className="ms-2 h-4 w-4" />
                    العودة
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => toast.success("تم تحديث بيانات المندوب")}
                >
                  <RefreshCcw className="ms-2 h-4 w-4" />
                  تحديث
                </Button>

                <Button
                  className="rounded-2xl"
                  onClick={() => toast.success("تم فتح إجراء الاعتماد")}
                >
                  <BadgeCheck className="ms-2 h-4 w-4" />
                  اعتماد المندوب
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="إجمالي المبيعات"
            value={<MoneyValue value={agent.totalSales} />}
            description="قيمة المبيعات المرتبطة بالمندوب"
            icon={TrendingUp}
          />

          <StatCard
            title="إجمالي العمولات"
            value={<MoneyValue value={agent.totalCommission} />}
            description="إجمالي العمولة المحتسبة"
            icon={HandCoins}
          />

          <StatCard
            title="الرصيد المستحق"
            value={<MoneyValue value={balance} />}
            description="عمولات لم يتم صرفها بعد"
            icon={Wallet}
          />

          <StatCard
            title="معدل التحويل"
            value={`${formatNumber(agent.conversionRate)}%`}
            description="نسبة تحويل العملاء إلى طلبات"
            icon={CheckCircle2}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  البيانات الرئيسية
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2">
                <InfoRow
                  label="رقم المندوب"
                  value={
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 hover:text-primary"
                      onClick={() => handleCopy(agent.code, "رقم المندوب")}
                    >
                      {agent.code}
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  }
                  icon={ClipboardList}
                />

                <InfoRow
                  label="رقم الهوية"
                  value={agent.nationalId}
                  icon={BadgeCheck}
                />

                <InfoRow label="نوع المندوب" value={agent.type} icon={UserCog} />

                <InfoRow
                  label="عدد العملاء"
                  value={formatNumber(agent.customersCount)}
                  icon={Globe}
                />

                <InfoRow
                  label="عدد الطلبات"
                  value={formatNumber(agent.ordersCount)}
                  icon={ReceiptText}
                />

                <InfoRow
                  label="عدد الفواتير"
                  value={formatNumber(agent.invoicesCount)}
                  icon={FileText}
                />
              </CardContent>
            </Card>

            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5" />
                  آخر الطلبات المرتبطة
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-2xl border">
                  <div className="grid grid-cols-5 gap-3 border-b bg-muted/60 px-4 py-3 text-xs font-semibold text-muted-foreground">
                    <span>رقم الطلب</span>
                    <span>العميل</span>
                    <span>المنتج</span>
                    <span>المبلغ</span>
                    <span>الحالة</span>
                  </div>

                  {relatedOrders.map((order) => (
                    <div
                      key={order.id}
                      className="grid grid-cols-5 gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                    >
                      <Link
                        href={`/system/orders/${order.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {order.id}
                      </Link>
                      <span>{order.customer}</span>
                      <span className="text-muted-foreground">
                        {order.product}
                      </span>
                      <span>
                        <MoneyValue value={order.amount} />
                      </span>
                      <span>
                        <Badge
                          variant="outline"
                          className="rounded-full bg-background"
                        >
                          {order.status}
                        </Badge>
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  معلومات التواصل
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <InfoRow
                  label="الجوال"
                  value={
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 hover:text-primary"
                      onClick={() => handleCopy(agent.phone, "رقم الجوال")}
                    >
                      {agent.phone}
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  }
                  icon={Phone}
                />

                <InfoRow
                  label="البريد"
                  value={
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 hover:text-primary"
                      onClick={() =>
                        handleCopy(agent.email, "البريد الإلكتروني")
                      }
                    >
                      {agent.email}
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  }
                  icon={Mail}
                />

                <InfoRow
                  label="الموقع"
                  value={`${agent.city} - ${agent.district}`}
                  icon={MapPin}
                />
              </CardContent>
            </Card>

            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5" />
                  ملخص العمولات
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-2xl border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">
                    العمولة المصروفة
                  </p>
                  <div className="mt-2 text-xl font-bold">
                    <MoneyValue value={agent.paidCommission} />
                  </div>
                </div>

                <div className="rounded-2xl border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">
                    العمولة المعلقة
                  </p>
                  <div className="mt-2 text-xl font-bold">
                    <MoneyValue value={agent.pendingCommission} />
                  </div>
                </div>

                <Button
                  className="w-full rounded-2xl"
                  onClick={() => toast.success("تم فتح شاشة صرف العمولة")}
                >
                  <HandCoins className="ms-2 h-4 w-4" />
                  صرف عمولة
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  سجل النشاط
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {activityItems.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />

                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.date, locale)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}