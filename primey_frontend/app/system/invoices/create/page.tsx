"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarRange,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  ReceiptText,
  Save,
  ShieldCheck,
  Sparkles,
  Tag,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AppLocale = "ar" | "en";

type InvoiceFormData = {
  invoiceNumber: string;
  customerName: string;
  customerCode: string;
  relatedOrder: string;
  relatedContract: string;
  invoiceDate: string;
  dueDate: string;
  invoiceType: string;
  currency: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  paymentTerms: string;
  paymentStatus: string;
  billingAddress: string;
  invoiceItemsSummary: string;
  notes: string;
};

type InvoiceFormErrors = Partial<Record<keyof InvoiceFormData, string>>;

function detectLocale(): AppLocale {
  return "ar";
}

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "إضافة فاتورة جديدة" : "Create New Invoice",
    pageSubtitle: isArabic
      ? "هذه الصفحة مخصصة لإنشاء فاتورة جديدة داخل النظام بنفس هوية Primey Care المعتمدة، مع تجهيز احترافي لمرحلة الربط اللاحقة مع الـ APIs والعملاء والطلبات والمدفوعات."
      : "This page is designed to create a new invoice inside the system using the approved Primey Care UI, with a professional foundation for later API, customers, orders, and payments integration.",

    heroBadge1: isArabic ? "System Module" : "System Module",
    heroBadge2: isArabic ? "Create Invoice" : "Create Invoice",

    backToInvoices: isArabic ? "العودة إلى الفواتير" : "Back to Invoices",
    saveDraft: isArabic ? "حفظ مبدئي" : "Save Draft",
    createInvoice: isArabic ? "إنشاء الفاتورة" : "Create Invoice",

    basicInfo: isArabic ? "البيانات الأساسية" : "Basic Information",
    relationsInfo: isArabic ? "الارتباطات" : "Relations",
    timelineInfo: isArabic ? "التواريخ والاستحقاق" : "Dates & Due",
    financialInfo: isArabic ? "البيانات المالية" : "Financial Information",
    billingInfo: isArabic ? "بيانات الفوترة" : "Billing Information",
    quickGuide: isArabic ? "إرشادات سريعة" : "Quick Guide",
    createSummary: isArabic ? "ملخص الإنشاء" : "Creation Summary",

    invoiceNumber: isArabic ? "رقم الفاتورة" : "Invoice Number",
    customerName: isArabic ? "اسم العميل" : "Customer Name",
    customerCode: isArabic ? "كود العميل" : "Customer Code",
    relatedOrder: isArabic ? "الطلب المرتبط" : "Related Order",
    relatedContract: isArabic ? "العقد المرتبط" : "Related Contract",
    invoiceDate: isArabic ? "تاريخ الفاتورة" : "Invoice Date",
    dueDate: isArabic ? "تاريخ الاستحقاق" : "Due Date",
    invoiceType: isArabic ? "نوع الفاتورة" : "Invoice Type",
    currency: isArabic ? "العملة" : "Currency",
    subtotal: isArabic ? "الإجمالي قبل الضريبة" : "Subtotal",
    discountAmount: isArabic ? "قيمة الخصم" : "Discount Amount",
    taxAmount: isArabic ? "قيمة الضريبة" : "Tax Amount",
    totalAmount: isArabic ? "الإجمالي النهائي" : "Total Amount",
    paymentTerms: isArabic ? "شروط الدفع" : "Payment Terms",
    paymentStatus: isArabic ? "حالة الدفع" : "Payment Status",
    billingAddress: isArabic ? "عنوان الفوترة" : "Billing Address",
    invoiceItemsSummary: isArabic ? "ملخص البنود" : "Invoice Items Summary",
    notes: isArabic ? "ملاحظات" : "Notes",

    placeholders: {
      invoiceNumber: isArabic ? "مثال: INV-2026-001" : "Example: INV-2026-001",
      customerName: isArabic ? "مثال: أحمد علي" : "Example: Ahmed Ali",
      customerCode: isArabic ? "مثال: CUS-001" : "Example: CUS-001",
      relatedOrder: isArabic ? "مثال: ORD-2026-015" : "Example: ORD-2026-015",
      relatedContract: isArabic ? "مثال: CTR-2026-001" : "Example: CTR-2026-001",
      invoiceType: isArabic
        ? "مثال: مبيعات / خدمات / تجديد"
        : "Example: Sales / Services / Renewal",
      currency: "SAR",
      subtotal: isArabic ? "مثال: 1000" : "Example: 1000",
      discountAmount: isArabic ? "مثال: 50" : "Example: 50",
      taxAmount: isArabic ? "مثال: 150" : "Example: 150",
      totalAmount: isArabic ? "مثال: 1100" : "Example: 1100",
      paymentTerms: isArabic
        ? "مثال: فوري / 7 أيام / 30 يوم"
        : "Example: Immediate / 7 days / 30 days",
      paymentStatus: isArabic
        ? "مثال: غير مدفوعة / جزئي / مدفوعة"
        : "Example: Unpaid / Partial / Paid",
      billingAddress: isArabic
        ? "اكتب عنوان الفوترة الكامل"
        : "Write the full billing address",
      invoiceItemsSummary: isArabic
        ? "اكتب ملخص البنود والخدمات المفوترة"
        : "Write a summary of billed items and services",
      notes: isArabic
        ? "أي ملاحظات إضافية عن الفاتورة"
        : "Any additional notes about the invoice",
    },

    tips: [
      isArabic
        ? "ابدأ الآن ببناء واجهة الإنشاء، والربط مع API سيتم لاحقًا بدون تغيير الهوية."
        : "Start with the create UI now; API integration can be added later without changing the visual identity.",
      isArabic
        ? "يفضل توحيد ترقيم الفواتير والعملة وصياغة حالات الدفع من البداية."
        : "Keep invoice numbering, currency, and payment statuses standardized from the beginning.",
      isArabic
        ? "يمكن لاحقًا ربط الفاتورة بالعميل والطلب والعقد والدفع والتقرير المحاسبي بشكل كامل."
        : "Later you can fully connect the invoice with the customer, order, contract, payment, and accounting report.",
    ],

    summaryItems: [
      {
        label: isArabic ? "حالة الصفحة" : "Page Status",
        value: isArabic ? "جاهزة كبداية UI" : "Ready as UI base",
        icon: BadgeCheck,
      },
      {
        label: isArabic ? "الربط الخلفي" : "Backend Integration",
        value: isArabic ? "غير مربوط بعد" : "Not connected yet",
        icon: ShieldCheck,
      },
      {
        label: isArabic ? "المرحلة الحالية" : "Current Stage",
        value: isArabic ? "بناء واجهات النظام" : "System frontend build",
        icon: Sparkles,
      },
      {
        label: isArabic ? "الارتباط المستقبلي" : "Future Mapping",
        value: isArabic
          ? "عملاء / طلبات / مدفوعات"
          : "Customers / Orders / Payments",
        icon: Wallet,
      },
    ],

    sectionDescriptions: {
      basicInfo: isArabic
        ? "أدخل البيانات الأساسية للفاتورة التي سيتم اعتمادها داخل النظام."
        : "Enter the invoice core information to be used across the system.",
      relationsInfo: isArabic
        ? "حدد العميل والكيانات التشغيلية المرتبطة بالفاتورة."
        : "Define the customer and the operational entities linked to the invoice.",
      timelineInfo: isArabic
        ? "أدخل تاريخ الفاتورة وتاريخ الاستحقاق."
        : "Enter invoice date and due date.",
      financialInfo: isArabic
        ? "أضف القيم المالية الرئيسية الخاصة بالفاتورة."
        : "Add the main financial values for the invoice.",
      billingInfo: isArabic
        ? "أضف بيانات الفوترة والبنود والملاحظات."
        : "Add billing details, items summary, and notes.",
    },

    validation: {
      required: isArabic ? "هذا الحقل مطلوب" : "This field is required",
      invalidDate: isArabic ? "التاريخ غير صالح" : "Invalid date",
      invalidDateRange: isArabic
        ? "تاريخ الاستحقاق يجب أن يكون في نفس اليوم أو بعد تاريخ الفاتورة"
        : "Due date must be on or after invoice date",
      invalidAmount: isArabic ? "القيمة المالية غير صحيحة" : "Invalid financial amount",
    },

    successTitle: isArabic ? "تم تجهيز النموذج" : "Form prepared",
    successText: isArabic
      ? "واجهة إنشاء الفاتورة جاهزة، وسيتم لاحقًا ربط زر الحفظ مع الـ API."
      : "The create invoice UI is ready. The save action will be connected to the API later.",

    draftTitle: isArabic ? "تم حفظ القيم محليًا" : "Values prepared locally",
    draftText: isArabic
      ? "تم التحقق من الحقول الأساسية محليًا كنموذج أولي."
      : "Basic fields have been validated locally as a first draft.",

    requiredFields: isArabic ? "الحقول الأساسية" : "Required Fields",
  };
}

function isValidDate(value: string) {
  if (!value.trim()) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function isValidAmount(value: string) {
  if (!value.trim()) return true;
  const numeric = Number(value);
  return !Number.isNaN(numeric) && numeric >= 0;
}

export default function SystemCreateInvoicePage() {
  const locale = detectLocale();
  const isArabic = locale === "ar";
  const t = dictionary(locale);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<InvoiceFormData>({
    invoiceNumber: "",
    customerName: "",
    customerCode: "",
    relatedOrder: "",
    relatedContract: "",
    invoiceDate: "",
    dueDate: "",
    invoiceType: "",
    currency: "SAR",
    subtotal: "",
    discountAmount: "",
    taxAmount: "",
    totalAmount: "",
    paymentTerms: "",
    paymentStatus: "",
    billingAddress: "",
    invoiceItemsSummary: "",
    notes: "",
  });
  const [errors, setErrors] = useState<InvoiceFormErrors>({});

  const completionStats = useMemo(() => {
    const values = Object.values(formData);
    const filled = values.filter((value) => value.trim().length > 0).length;
    const total = values.length;
    const percent = Math.round((filled / total) * 100);
    return { filled, total, percent };
  }, [formData]);

  function setField<K extends keyof InvoiceFormData>(
    key: K,
    value: InvoiceFormData[K]
  ) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateForm() {
    const nextErrors: InvoiceFormErrors = {};

    if (!formData.invoiceNumber.trim()) {
      nextErrors.invoiceNumber = t.validation.required;
    }

    if (!formData.customerName.trim()) {
      nextErrors.customerName = t.validation.required;
    }

    if (!formData.invoiceDate.trim()) {
      nextErrors.invoiceDate = t.validation.required;
    } else if (!isValidDate(formData.invoiceDate)) {
      nextErrors.invoiceDate = t.validation.invalidDate;
    }

    if (!formData.dueDate.trim()) {
      nextErrors.dueDate = t.validation.required;
    } else if (!isValidDate(formData.dueDate)) {
      nextErrors.dueDate = t.validation.invalidDate;
    }

    if (
      formData.invoiceDate.trim() &&
      formData.dueDate.trim() &&
      isValidDate(formData.invoiceDate) &&
      isValidDate(formData.dueDate)
    ) {
      const invoiceDate = new Date(formData.invoiceDate).getTime();
      const dueDate = new Date(formData.dueDate).getTime();
      if (dueDate < invoiceDate) {
        nextErrors.dueDate = t.validation.invalidDateRange;
      }
    }

    if (formData.subtotal.trim() && !isValidAmount(formData.subtotal)) {
      nextErrors.subtotal = t.validation.invalidAmount;
    }

    if (
      formData.discountAmount.trim() &&
      !isValidAmount(formData.discountAmount)
    ) {
      nextErrors.discountAmount = t.validation.invalidAmount;
    }

    if (formData.taxAmount.trim() && !isValidAmount(formData.taxAmount)) {
      nextErrors.taxAmount = t.validation.invalidAmount;
    }

    if (formData.totalAmount.trim() && !isValidAmount(formData.totalAmount)) {
      nextErrors.totalAmount = t.validation.invalidAmount;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSaveDraft() {
    const valid = validateForm();

    if (!valid) {
      toast.error(t.validation.required);
      return;
    }

    toast.success(t.draftTitle, {
      description: t.draftText,
    });
  }

  async function handleSubmit() {
    const valid = validateForm();

    if (!valid) {
      toast.error(t.validation.required);
      return;
    }

    try {
      setIsSubmitting(true);

      await new Promise((resolve) => setTimeout(resolve, 700));

      toast.success(t.successTitle, {
        description: t.successText,
      });
    } catch {
      toast.error(isArabic ? "حدث خطأ غير متوقع" : "Unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
        <CardContent className="p-0">
          <div className="grid gap-0 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-6 p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {t.heroBadge1}
                </Badge>
                <Badge className="rounded-full px-3 py-1">{t.heroBadge2}</Badge>
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                  {t.pageTitle}
                </h1>
                <p className="text-muted-foreground max-w-3xl leading-8">
                  {t.pageSubtitle}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/system/invoices" className="w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-2xl sm:w-auto"
                  >
                    <ArrowLeft className="ms-2 h-4 w-4" />
                    {t.backToInvoices}
                  </Button>
                </Link>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-2xl sm:w-auto"
                  onClick={handleSaveDraft}
                >
                  <Save className="ms-2 h-4 w-4" />
                  {t.saveDraft}
                </Button>

                <Button
                  type="button"
                  className="w-full rounded-2xl sm:w-auto"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="ms-2 h-4 w-4" />
                  )}
                  {t.createInvoice}
                </Button>
              </div>
            </div>

            <Card className="rounded-none border-0 bg-transparent shadow-none">
              <CardHeader className="pb-3 pt-6 md:pt-8">
                <CardTitle className="text-base">{t.createSummary}</CardTitle>
                <CardDescription>
                  {isArabic
                    ? "ملخص سريع عن جاهزية النموذج الحالي."
                    : "Quick summary about the current form readiness."}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 px-6 pb-6 md:px-8 md:pb-8">
                <div className="rounded-2xl border border-white/20 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">{t.requiredFields}</p>
                    <Badge variant="secondary" className="rounded-full">
                      {completionStats.filled}/{completionStats.total}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs leading-6">
                    {isArabic
                      ? "يشمل ذلك رقم الفاتورة، العميل، التواريخ، والحقول المالية القابلة للربط لاحقًا."
                      : "This includes invoice number, customer, dates, and financial fields that will later be connected."}
                  </p>
                </div>

                {t.summaryItems.map((item) => {
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
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.basicInfo}</CardTitle>
              <CardDescription>{t.sectionDescriptions.basicInfo}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">{t.invoiceNumber}</Label>
                <Input
                  id="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={(e) => setField("invoiceNumber", e.target.value)}
                  placeholder={t.placeholders.invoiceNumber}
                  className="rounded-2xl"
                />
                {errors.invoiceNumber ? (
                  <p className="text-sm text-red-500">{errors.invoiceNumber}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceType">{t.invoiceType}</Label>
                <Input
                  id="invoiceType"
                  value={formData.invoiceType}
                  onChange={(e) => setField("invoiceType", e.target.value)}
                  placeholder={t.placeholders.invoiceType}
                  className="rounded-2xl"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.relationsInfo}</CardTitle>
              <CardDescription>{t.sectionDescriptions.relationsInfo}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerName">{t.customerName}</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setField("customerName", e.target.value)}
                  placeholder={t.placeholders.customerName}
                  className="rounded-2xl"
                />
                {errors.customerName ? (
                  <p className="text-sm text-red-500">{errors.customerName}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerCode">{t.customerCode}</Label>
                <Input
                  id="customerCode"
                  value={formData.customerCode}
                  onChange={(e) => setField("customerCode", e.target.value)}
                  placeholder={t.placeholders.customerCode}
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="relatedOrder">{t.relatedOrder}</Label>
                <Input
                  id="relatedOrder"
                  value={formData.relatedOrder}
                  onChange={(e) => setField("relatedOrder", e.target.value)}
                  placeholder={t.placeholders.relatedOrder}
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="relatedContract">{t.relatedContract}</Label>
                <Input
                  id="relatedContract"
                  value={formData.relatedContract}
                  onChange={(e) => setField("relatedContract", e.target.value)}
                  placeholder={t.placeholders.relatedContract}
                  className="rounded-2xl"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.timelineInfo}</CardTitle>
              <CardDescription>{t.sectionDescriptions.timelineInfo}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoiceDate">{t.invoiceDate}</Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => setField("invoiceDate", e.target.value)}
                  className="rounded-2xl"
                />
                {errors.invoiceDate ? (
                  <p className="text-sm text-red-500">{errors.invoiceDate}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">{t.dueDate}</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setField("dueDate", e.target.value)}
                  className="rounded-2xl"
                />
                {errors.dueDate ? (
                  <p className="text-sm text-red-500">{errors.dueDate}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.financialInfo}</CardTitle>
              <CardDescription>{t.sectionDescriptions.financialInfo}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency">{t.currency}</Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setField("currency", e.target.value)}
                  placeholder={t.placeholders.currency}
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentStatus">{t.paymentStatus}</Label>
                <Input
                  id="paymentStatus"
                  value={formData.paymentStatus}
                  onChange={(e) => setField("paymentStatus", e.target.value)}
                  placeholder={t.placeholders.paymentStatus}
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subtotal">{t.subtotal}</Label>
                <Input
                  id="subtotal"
                  value={formData.subtotal}
                  onChange={(e) => setField("subtotal", e.target.value)}
                  placeholder={t.placeholders.subtotal}
                  className="rounded-2xl"
                />
                {errors.subtotal ? (
                  <p className="text-sm text-red-500">{errors.subtotal}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="discountAmount">{t.discountAmount}</Label>
                <Input
                  id="discountAmount"
                  value={formData.discountAmount}
                  onChange={(e) => setField("discountAmount", e.target.value)}
                  placeholder={t.placeholders.discountAmount}
                  className="rounded-2xl"
                />
                {errors.discountAmount ? (
                  <p className="text-sm text-red-500">{errors.discountAmount}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxAmount">{t.taxAmount}</Label>
                <Input
                  id="taxAmount"
                  value={formData.taxAmount}
                  onChange={(e) => setField("taxAmount", e.target.value)}
                  placeholder={t.placeholders.taxAmount}
                  className="rounded-2xl"
                />
                {errors.taxAmount ? (
                  <p className="text-sm text-red-500">{errors.taxAmount}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalAmount">{t.totalAmount}</Label>
                <Input
                  id="totalAmount"
                  value={formData.totalAmount}
                  onChange={(e) => setField("totalAmount", e.target.value)}
                  placeholder={t.placeholders.totalAmount}
                  className="rounded-2xl"
                />
                {errors.totalAmount ? (
                  <p className="text-sm text-red-500">{errors.totalAmount}</p>
                ) : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="paymentTerms">{t.paymentTerms}</Label>
                <Input
                  id="paymentTerms"
                  value={formData.paymentTerms}
                  onChange={(e) => setField("paymentTerms", e.target.value)}
                  placeholder={t.placeholders.paymentTerms}
                  className="rounded-2xl"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.billingInfo}</CardTitle>
              <CardDescription>{t.sectionDescriptions.billingInfo}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5">
              <div className="space-y-2">
                <Label htmlFor="billingAddress">{t.billingAddress}</Label>
                <Textarea
                  id="billingAddress"
                  value={formData.billingAddress}
                  onChange={(e) => setField("billingAddress", e.target.value)}
                  placeholder={t.placeholders.billingAddress}
                  className="min-h-[110px] rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceItemsSummary">
                  {t.invoiceItemsSummary}
                </Label>
                <Textarea
                  id="invoiceItemsSummary"
                  value={formData.invoiceItemsSummary}
                  onChange={(e) => setField("invoiceItemsSummary", e.target.value)}
                  placeholder={t.placeholders.invoiceItemsSummary}
                  className="min-h-[120px] rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t.notes}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder={t.placeholders.notes}
                  className="min-h-[120px] rounded-2xl"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.quickGuide}</CardTitle>
              <CardDescription>
                {isArabic
                  ? "ملاحظات تشغيلية سريعة قبل ربط الصفحة فعليًا."
                  : "Quick operational notes before connecting the page for real."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {t.tips.map((tip, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-2xl border border-white/20 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                    {index === 0 ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : index === 1 ? (
                      <Tag className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </div>
                  <p className="text-sm leading-7">{tip}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>
                {isArabic ? "مؤشرات النموذج" : "Form Indicators"}
              </CardTitle>
              <CardDescription>
                {isArabic
                  ? "متابعة سريعة للحقول الرئيسية داخل الصفحة."
                  : "Quick tracking for the main fields in this page."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                    <ReceiptText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {isArabic ? "اكتمال النموذج" : "Form completion"}
                    </p>
                    <p className="text-sm font-semibold">
                      {completionStats.percent}%
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full">
                  {completionStats.filled}/{completionStats.total}
                </Badge>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t.customerName}</p>
                    <p className="text-sm font-semibold">
                      {formData.customerName || (isArabic ? "غير مدخل" : "Not entered")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                    <CalendarRange className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t.invoiceDate}</p>
                    <p className="text-sm font-semibold">
                      {formData.invoiceDate || (isArabic ? "غير مدخل" : "Not entered")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t.totalAmount}</p>
                    <p className="text-sm font-semibold">
                      {formData.totalAmount || (isArabic ? "غير مدخل" : "Not entered")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-white/30 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-sm leading-7">
                  {isArabic
                    ? "تم اعتماد الصفحة لتعمل ضمن shell النظام الرسمي وباستخدام UI الداخلي فقط. عند ربط الـ API لاحقًا سيتم فقط توصيل الحفظ الفعلي دون تغيير التصميم."
                    : "This page is aligned with the official system shell and uses only the internal UI. When the API is connected later, only the save action will be wired without changing the design."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{isArabic ? "روابط سريعة" : "Quick Links"}</CardTitle>
              <CardDescription>
                {isArabic
                  ? "تنقل سريع داخل نفس موديول الفواتير."
                  : "Quick navigation within the invoices module."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <Link href="/system/invoices" className="block">
                <Button variant="outline" className="w-full rounded-2xl">
                  <ArrowLeft className="ms-2 h-4 w-4" />
                  {t.backToInvoices}
                </Button>
              </Link>

              <Link href="/system/invoices" className="block">
                <Button variant="outline" className="w-full rounded-2xl">
                  <FileText className="ms-2 h-4 w-4" />
                  {isArabic ? "قائمة الفواتير" : "Invoices List"}
                </Button>
              </Link>

              <Link href="/system" className="block">
                <Button variant="outline" className="w-full rounded-2xl">
                  <FileSpreadsheet className="ms-2 h-4 w-4" />
                  {isArabic
                    ? "العودة إلى لوحة النظام"
                    : "Back to System Dashboard"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}