"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  FileText,
  Mail,
  Phone,
  Printer,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  User,
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

type InvoiceStatus = "draft" | "issued" | "paid" | "overdue" | "cancelled";

type InvoiceItem = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type InvoiceDetails = {
  id: string;
  number: string;
  status: InvoiceStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  providerName: string;
  issueDate: string;
  dueDate: string;
  paymentMethod: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  discount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  notes: string;
  items: InvoiceItem[];
};

const SAR_ICON = "/currency/sar.svg";

const mockInvoice: InvoiceDetails = {
  id: "1",
  number: "INV-2026-0001",
  status: "issued",
  customerName: "محمد عبدالله",
  customerPhone: "+966500000000",
  customerEmail: "customer@primeycare.com",
  providerName: "مركز برايمي الطبي",
  issueDate: "2026-04-22",
  dueDate: "2026-04-30",
  paymentMethod: "دفع إلكتروني",
  subtotal: 2000,
  vatRate: 15,
  vatAmount: 300,
  discount: 100,
  total: 2200,
  paidAmount: 1200,
  remainingAmount: 1000,
  notes: "فاتورة خدمات مرتبطة ببرنامج Primey Care.",
  items: [
    {
      id: "ITEM-1",
      name: "بطاقة Primey Care",
      description: "إصدار بطاقة عضوية سنوية",
      quantity: 1,
      unitPrice: 200,
      total: 200,
    },
    {
      id: "ITEM-2",
      name: "برنامج الأسنان",
      description: "برنامج رعاية أسنان مخفض",
      quantity: 1,
      unitPrice: 750,
      total: 750,
    },
    {
      id: "ITEM-3",
      name: "خدمة استشارة",
      description: "استشارة طبية ضمن البرنامج",
      quantity: 1,
      unitPrice: 1050,
      total: 1050,
    },
  ],
};

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

function StatusBadge({ status }: { status: InvoiceStatus }) {
  if (status === "paid") {
    return (
      <Badge className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50">
        مدفوعة
      </Badge>
    );
  }

  if (status === "issued") {
    return (
      <Badge className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-50">
        مصدرة
      </Badge>
    );
  }

  if (status === "draft") {
    return (
      <Badge className="rounded-full bg-slate-50 px-3 py-1 text-slate-700 hover:bg-slate-50">
        مسودة
      </Badge>
    );
  }

  if (status === "overdue") {
    return (
      <Badge className="rounded-full bg-amber-50 px-3 py-1 text-amber-700 hover:bg-amber-50">
        متأخرة
      </Badge>
    );
  }

  return (
    <Badge className="rounded-full bg-rose-50 px-3 py-1 text-rose-700 hover:bg-rose-50">
      ملغاة
    </Badge>
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

export default function InvoiceDetailsPage() {
  const params = useParams<{ id: string }>();
  const locale = readLocale();

  const invoice = useMemo(() => {
    return {
      ...mockInvoice,
      id: params?.id || mockInvoice.id,
    };
  }, [params?.id]);

  function handleCopy(value: string, label: string) {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`تم نسخ ${label} بنجاح`))
      .catch(() => toast.error("تعذر النسخ، حاول مرة أخرى"));
  }

  function handlePrint() {
    window.print();
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
                  <ReceiptText className="h-10 w-10 text-primary" />
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={invoice.status} />

                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {invoice.number}
                    </Badge>

                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {invoice.paymentMethod}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      النظام / الفواتير / تفاصيل الفاتورة
                    </p>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
                      فاتورة {invoice.number}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      العميل: {invoice.customerName}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" />
                      تاريخ الإصدار {formatDate(invoice.issueDate, locale)}
                    </span>

                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" />
                      تاريخ الاستحقاق {formatDate(invoice.dueDate, locale)}
                    </span>

                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {invoice.providerName}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" className="rounded-2xl">
                  <Link href="/system/invoices">
                    <ArrowLeft className="ms-2 h-4 w-4" />
                    العودة
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => toast.success("تم تحديث بيانات الفاتورة")}
                >
                  <RefreshCcw className="ms-2 h-4 w-4" />
                  تحديث
                </Button>

                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={handlePrint}
                >
                  <Printer className="ms-2 h-4 w-4" />
                  طباعة
                </Button>

                <Button
                  className="rounded-2xl"
                  onClick={() => toast.success("تم تجهيز ملف التصدير")}
                >
                  <Download className="ms-2 h-4 w-4" />
                  تصدير
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="إجمالي الفاتورة"
            value={<MoneyValue value={invoice.total} />}
            description="شامل الضريبة والخصومات"
            icon={ReceiptText}
          />

          <StatCard
            title="المبلغ المدفوع"
            value={<MoneyValue value={invoice.paidAmount} />}
            description="إجمالي المدفوعات المرتبطة"
            icon={CheckCircle2}
          />

          <StatCard
            title="المبلغ المتبقي"
            value={<MoneyValue value={invoice.remainingAmount} />}
            description="المبلغ المطلوب سداده"
            icon={Wallet}
          />

          <StatCard
            title="ضريبة القيمة المضافة"
            value={<MoneyValue value={invoice.vatAmount} />}
            description={`${formatNumber(invoice.vatRate)}% من صافي المبلغ`}
            icon={ShieldCheck}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  بنود الفاتورة
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-2xl border">
                  <div className="grid grid-cols-5 gap-3 border-b bg-muted/60 px-4 py-3 text-xs font-semibold text-muted-foreground">
                    <span>البند</span>
                    <span>الوصف</span>
                    <span>الكمية</span>
                    <span>السعر</span>
                    <span>الإجمالي</span>
                  </div>

                  {invoice.items.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-5 gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                    >
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-muted-foreground">
                        {item.description}
                      </span>
                      <span>{formatNumber(item.quantity)}</span>
                      <span>
                        <MoneyValue value={item.unitPrice} />
                      </span>
                      <span>
                        <MoneyValue value={item.total} />
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5" />
                  بيانات الفاتورة
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-4 md:grid-cols-2">
                <InfoRow
                  label="رقم الفاتورة"
                  value={
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 hover:text-primary"
                      onClick={() =>
                        handleCopy(invoice.number, "رقم الفاتورة")
                      }
                    >
                      {invoice.number}
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  }
                  icon={ReceiptText}
                />

                <InfoRow
                  label="حالة الفاتورة"
                  value={<StatusBadge status={invoice.status} />}
                  icon={ShieldCheck}
                />

                <InfoRow
                  label="تاريخ الإصدار"
                  value={formatDate(invoice.issueDate, locale)}
                  icon={CalendarDays}
                />

                <InfoRow
                  label="تاريخ الاستحقاق"
                  value={formatDate(invoice.dueDate, locale)}
                  icon={CalendarDays}
                />

                <InfoRow
                  label="طريقة الدفع"
                  value={invoice.paymentMethod}
                  icon={CreditCard}
                />

                <InfoRow
                  label="مقدم الخدمة"
                  value={invoice.providerName}
                  icon={Building2}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  بيانات العميل
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <InfoRow
                  label="الاسم"
                  value={invoice.customerName}
                  icon={User}
                />

                <InfoRow
                  label="الجوال"
                  value={
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 hover:text-primary"
                      onClick={() =>
                        handleCopy(invoice.customerPhone, "رقم الجوال")
                      }
                    >
                      {invoice.customerPhone}
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
                        handleCopy(invoice.customerEmail, "البريد الإلكتروني")
                      }
                    >
                      {invoice.customerEmail}
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  }
                  icon={Mail}
                />
              </CardContent>
            </Card>

            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  ملخص مالي
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border bg-background p-4 text-sm">
                  <span className="text-muted-foreground">الإجمالي قبل الضريبة</span>
                  <MoneyValue value={invoice.subtotal} />
                </div>

                <div className="flex items-center justify-between rounded-2xl border bg-background p-4 text-sm">
                  <span className="text-muted-foreground">الخصم</span>
                  <MoneyValue value={invoice.discount} />
                </div>

                <div className="flex items-center justify-between rounded-2xl border bg-background p-4 text-sm">
                  <span className="text-muted-foreground">الضريبة</span>
                  <MoneyValue value={invoice.vatAmount} />
                </div>

                <div className="flex items-center justify-between rounded-2xl border bg-primary/5 p-4 text-sm">
                  <span className="font-semibold">الإجمالي النهائي</span>
                  <MoneyValue value={invoice.total} />
                </div>

                <Button
                  className="w-full rounded-2xl"
                  onClick={() => toast.success("تم فتح شاشة تسجيل دفعة")}
                >
                  <CreditCard className="ms-2 h-4 w-4" />
                  تسجيل دفعة
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  ملاحظات
                </CardTitle>
              </CardHeader>

              <CardContent>
                <p className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                  {invoice.notes}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}