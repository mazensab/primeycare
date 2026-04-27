"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Landmark,
  Loader2,
  Plus,
  ReceiptText,
  Save,
  ShieldCheck,
  Sparkles,
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

type PaymentFormData = {
  paymentNumber: string;
  customerName: string;
  customerCode: string;
  relatedInvoice: string;
  relatedOrder: string;
  paymentMethod: string;
  paymentChannel: string;
  paymentStatus: string;
  paymentDate: string;
  amount: string;
  currency: string;
  referenceNumber: string;
  transactionId: string;
  treasuryAccount: string;
  bankAccount: string;
  payerName: string;
  payerPhone: string;
  notes: string;
};

type PaymentFormErrors = Partial<Record<keyof PaymentFormData, string>>;

function detectLocale(): AppLocale {
  return "ar";
}

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "إضافة دفعة جديدة" : "Create New Payment",
    pageSubtitle: isArabic
      ? "هذه الصفحة مخصصة لإنشاء دفعة جديدة داخل النظام بنفس هوية Primey Care المعتمدة، مع تجهيز احترافي لمرحلة الربط اللاحقة مع الـ APIs والفواتير والطلبات والعملاء والخزينة."
      : "This page is designed to create a new payment inside the system using the approved Primey Care UI, with a professional foundation for later API, invoices, orders, customers, and treasury integration.",

    heroBadge1: isArabic ? "System Module" : "System Module",
    heroBadge2: isArabic ? "Create Payment" : "Create Payment",

    backToPayments: isArabic ? "العودة إلى المدفوعات" : "Back to Payments",
    saveDraft: isArabic ? "حفظ مبدئي" : "Save Draft",
    createPayment: isArabic ? "إنشاء الدفعة" : "Create Payment",

    basicInfo: isArabic ? "البيانات الأساسية" : "Basic Information",
    relationsInfo: isArabic ? "الارتباطات" : "Relations",
    paymentInfo: isArabic ? "بيانات الدفع" : "Payment Information",
    treasuryInfo: isArabic ? "الخزينة والتحويل" : "Treasury & Transfer",
    extraInfo: isArabic ? "بيانات إضافية" : "Additional Information",
    quickGuide: isArabic ? "إرشادات سريعة" : "Quick Guide",
    createSummary: isArabic ? "ملخص الإنشاء" : "Creation Summary",

    paymentNumber: isArabic ? "رقم الدفعة" : "Payment Number",
    customerName: isArabic ? "اسم العميل" : "Customer Name",
    customerCode: isArabic ? "كود العميل" : "Customer Code",
    relatedInvoice: isArabic ? "الفاتورة المرتبطة" : "Related Invoice",
    relatedOrder: isArabic ? "الطلب المرتبط" : "Related Order",
    paymentMethod: isArabic ? "طريقة الدفع" : "Payment Method",
    paymentChannel: isArabic ? "قناة الدفع" : "Payment Channel",
    paymentStatus: isArabic ? "حالة الدفع" : "Payment Status",
    paymentDate: isArabic ? "تاريخ الدفع" : "Payment Date",
    amount: isArabic ? "المبلغ" : "Amount",
    currency: isArabic ? "العملة" : "Currency",
    referenceNumber: isArabic ? "رقم المرجع" : "Reference Number",
    transactionId: isArabic ? "رقم العملية" : "Transaction ID",
    treasuryAccount: isArabic ? "حساب الخزينة" : "Treasury Account",
    bankAccount: isArabic ? "الحساب البنكي" : "Bank Account",
    payerName: isArabic ? "اسم الدافع" : "Payer Name",
    payerPhone: isArabic ? "جوال الدافع" : "Payer Phone",
    notes: isArabic ? "ملاحظات" : "Notes",

    placeholders: {
      paymentNumber: isArabic ? "مثال: PAY-2026-001" : "Example: PAY-2026-001",
      customerName: isArabic ? "مثال: أحمد علي" : "Example: Ahmed Ali",
      customerCode: isArabic ? "مثال: CUS-001" : "Example: CUS-001",
      relatedInvoice: isArabic ? "مثال: INV-2026-001" : "Example: INV-2026-001",
      relatedOrder: isArabic ? "مثال: ORD-2026-001" : "Example: ORD-2026-001",
      paymentMethod: isArabic
        ? "مثال: تحويل بنكي / بطاقة / نقدًا"
        : "Example: Bank Transfer / Card / Cash",
      paymentChannel: isArabic
        ? "مثال: Stripe / Tap / يدوي"
        : "Example: Stripe / Tap / Manual",
      paymentStatus: isArabic
        ? "مثال: مؤكد / معلق / فاشل"
        : "Example: Confirmed / Pending / Failed",
      amount: isArabic ? "مثال: 299" : "Example: 299",
      currency: "SAR",
      referenceNumber: isArabic ? "مثال: REF-1001" : "Example: REF-1001",
      transactionId: isArabic ? "مثال: TRX-5001" : "Example: TRX-5001",
      treasuryAccount: isArabic
        ? "مثال: الخزينة الرئيسية"
        : "Example: Main Treasury",
      bankAccount: isArabic
        ? "مثال: بنك الراجحي - الحساب التشغيلي"
        : "Example: Al Rajhi - Operating Account",
      payerName: isArabic ? "مثال: أحمد علي" : "Example: Ahmed Ali",
      payerPhone: isArabic ? "05xxxxxxxx" : "05xxxxxxxx",
      notes: isArabic
        ? "أي ملاحظات إضافية عن الدفعة"
        : "Any additional notes about the payment",
    },

    tips: [
      isArabic
        ? "ابدأ الآن ببناء واجهة الإنشاء، والربط مع API سيتم لاحقًا بدون تغيير الهوية."
        : "Start with the create UI now; API integration can be added later without changing the visual identity.",
      isArabic
        ? "يفضل توحيد ترقيم الدفعات وطرق الدفع وحالات الدفع من البداية."
        : "Keep payment numbering, payment methods, and payment statuses standardized from the beginning.",
      isArabic
        ? "يمكن لاحقًا ربط الدفعة بالفاتورة والطلب والعميل والخزينة والتسويات المحاسبية بشكل كامل."
        : "Later you can fully connect the payment with invoice, order, customer, treasury, and accounting settlements.",
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
          ? "فواتير / طلبات / خزينة"
          : "Invoices / Orders / Treasury",
        icon: Wallet,
      },
    ],

    sectionDescriptions: {
      basicInfo: isArabic
        ? "أدخل البيانات الأساسية للدفعة التي سيتم اعتمادها داخل النظام."
        : "Enter the payment core information to be used across the system.",
      relationsInfo: isArabic
        ? "حدد العميل والكيانات التشغيلية المرتبطة بالدفعة."
        : "Define the customer and the operational entities linked to the payment.",
      paymentInfo: isArabic
        ? "أدخل تفاصيل الدفع الفعلية."
        : "Enter the actual payment details.",
      treasuryInfo: isArabic
        ? "أضف بيانات الخزينة أو البنك والتحويل المرجعي."
        : "Add treasury or bank account details and transfer reference.",
      extraInfo: isArabic
        ? "أضف بيانات إضافية وملاحظات تشغيلية."
        : "Add extra data and operational notes.",
    },

    validation: {
      required: isArabic ? "هذا الحقل مطلوب" : "This field is required",
      invalidDate: isArabic ? "التاريخ غير صالح" : "Invalid date",
      invalidAmount: isArabic ? "المبلغ غير صحيح" : "Invalid amount",
      invalidPhone: isArabic ? "رقم الجوال غير صالح" : "Invalid phone number",
    },

    successTitle: isArabic ? "تم تجهيز النموذج" : "Form prepared",
    successText: isArabic
      ? "واجهة إنشاء الدفعة جاهزة، وسيتم لاحقًا ربط زر الحفظ مع الـ API."
      : "The create payment UI is ready. The save action will be connected to the API later.",

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

function isValidPhone(value: string) {
  const cleaned = value.replace(/[^\d+]/g, "");
  return cleaned.length >= 9;
}

export default function SystemCreatePaymentPage() {
  const locale = detectLocale();
  const isArabic = locale === "ar";
  const t = dictionary(locale);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<PaymentFormData>({
    paymentNumber: "",
    customerName: "",
    customerCode: "",
    relatedInvoice: "",
    relatedOrder: "",
    paymentMethod: "",
    paymentChannel: "",
    paymentStatus: "",
    paymentDate: "",
    amount: "",
    currency: "SAR",
    referenceNumber: "",
    transactionId: "",
    treasuryAccount: "",
    bankAccount: "",
    payerName: "",
    payerPhone: "",
    notes: "",
  });
  const [errors, setErrors] = useState<PaymentFormErrors>({});

  const completionStats = useMemo(() => {
    const values = Object.values(formData);
    const filled = values.filter((value) => value.trim().length > 0).length;
    const total = values.length;
    const percent = Math.round((filled / total) * 100);
    return { filled, total, percent };
  }, [formData]);

  function setField<K extends keyof PaymentFormData>(
    key: K,
    value: PaymentFormData[K]
  ) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateForm() {
    const nextErrors: PaymentFormErrors = {};

    if (!formData.paymentNumber.trim()) {
      nextErrors.paymentNumber = t.validation.required;
    }

    if (!formData.customerName.trim()) {
      nextErrors.customerName = t.validation.required;
    }

    if (!formData.paymentMethod.trim()) {
      nextErrors.paymentMethod = t.validation.required;
    }

    if (!formData.paymentDate.trim()) {
      nextErrors.paymentDate = t.validation.required;
    } else if (!isValidDate(formData.paymentDate)) {
      nextErrors.paymentDate = t.validation.invalidDate;
    }

    if (!formData.amount.trim()) {
      nextErrors.amount = t.validation.required;
    } else if (!isValidAmount(formData.amount)) {
      nextErrors.amount = t.validation.invalidAmount;
    }

    if (formData.payerPhone.trim() && !isValidPhone(formData.payerPhone)) {
      nextErrors.payerPhone = t.validation.invalidPhone;
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
                <Link href="/system/payments" className="w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-2xl sm:w-auto"
                  >
                    <ArrowLeft className="ms-2 h-4 w-4" />
                    {t.backToPayments}
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
                  {t.createPayment}
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
                      ? "يشمل ذلك رقم الدفعة، العميل، طريقة الدفع، التاريخ، والمبلغ القابل للربط لاحقًا."
                      : "This includes payment number, customer, payment method, date, and amount that will later be connected."}
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
                <Label htmlFor="paymentNumber">{t.paymentNumber}</Label>
                <Input
                  id="paymentNumber"
                  value={formData.paymentNumber}
                  onChange={(e) => setField("paymentNumber", e.target.value)}
                  placeholder={t.placeholders.paymentNumber}
                  className="rounded-2xl"
                />
                {errors.paymentNumber ? (
                  <p className="text-sm text-red-500">{errors.paymentNumber}</p>
                ) : null}
              </div>

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
                <Label htmlFor="payerName">{t.payerName}</Label>
                <Input
                  id="payerName"
                  value={formData.payerName}
                  onChange={(e) => setField("payerName", e.target.value)}
                  placeholder={t.placeholders.payerName}
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
                <Label htmlFor="relatedInvoice">{t.relatedInvoice}</Label>
                <Input
                  id="relatedInvoice"
                  value={formData.relatedInvoice}
                  onChange={(e) => setField("relatedInvoice", e.target.value)}
                  placeholder={t.placeholders.relatedInvoice}
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
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.paymentInfo}</CardTitle>
              <CardDescription>{t.sectionDescriptions.paymentInfo}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">{t.paymentMethod}</Label>
                <Input
                  id="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={(e) => setField("paymentMethod", e.target.value)}
                  placeholder={t.placeholders.paymentMethod}
                  className="rounded-2xl"
                />
                {errors.paymentMethod ? (
                  <p className="text-sm text-red-500">{errors.paymentMethod}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentChannel">{t.paymentChannel}</Label>
                <Input
                  id="paymentChannel"
                  value={formData.paymentChannel}
                  onChange={(e) => setField("paymentChannel", e.target.value)}
                  placeholder={t.placeholders.paymentChannel}
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
                <Label htmlFor="paymentDate">{t.paymentDate}</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => setField("paymentDate", e.target.value)}
                  className="rounded-2xl"
                />
                {errors.paymentDate ? (
                  <p className="text-sm text-red-500">{errors.paymentDate}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">{t.amount}</Label>
                <Input
                  id="amount"
                  value={formData.amount}
                  onChange={(e) => setField("amount", e.target.value)}
                  placeholder={t.placeholders.amount}
                  className="rounded-2xl"
                />
                {errors.amount ? (
                  <p className="text-sm text-red-500">{errors.amount}</p>
                ) : null}
              </div>

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
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.treasuryInfo}</CardTitle>
              <CardDescription>{t.sectionDescriptions.treasuryInfo}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="referenceNumber">{t.referenceNumber}</Label>
                <Input
                  id="referenceNumber"
                  value={formData.referenceNumber}
                  onChange={(e) => setField("referenceNumber", e.target.value)}
                  placeholder={t.placeholders.referenceNumber}
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transactionId">{t.transactionId}</Label>
                <Input
                  id="transactionId"
                  value={formData.transactionId}
                  onChange={(e) => setField("transactionId", e.target.value)}
                  placeholder={t.placeholders.transactionId}
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="treasuryAccount">{t.treasuryAccount}</Label>
                <Input
                  id="treasuryAccount"
                  value={formData.treasuryAccount}
                  onChange={(e) => setField("treasuryAccount", e.target.value)}
                  placeholder={t.placeholders.treasuryAccount}
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankAccount">{t.bankAccount}</Label>
                <Input
                  id="bankAccount"
                  value={formData.bankAccount}
                  onChange={(e) => setField("bankAccount", e.target.value)}
                  placeholder={t.placeholders.bankAccount}
                  className="rounded-2xl"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.extraInfo}</CardTitle>
              <CardDescription>{t.sectionDescriptions.extraInfo}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5">
              <div className="space-y-2">
                <Label htmlFor="payerPhone">{t.payerPhone}</Label>
                <Input
                  id="payerPhone"
                  value={formData.payerPhone}
                  onChange={(e) => setField("payerPhone", e.target.value)}
                  placeholder={t.placeholders.payerPhone}
                  className="rounded-2xl"
                />
                {errors.payerPhone ? (
                  <p className="text-sm text-red-500">{errors.payerPhone}</p>
                ) : null}
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
                      <CreditCard className="h-4 w-4" />
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
                    <CreditCard className="h-4 w-4" />
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
                    <ReceiptText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t.relatedInvoice}</p>
                    <p className="text-sm font-semibold">
                      {formData.relatedInvoice || (isArabic ? "غير مدخل" : "Not entered")}
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
                    <p className="text-muted-foreground text-xs">{t.amount}</p>
                    <p className="text-sm font-semibold">
                      {formData.amount || (isArabic ? "غير مدخل" : "Not entered")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                    <Landmark className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t.treasuryAccount}</p>
                    <p className="text-sm font-semibold">
                      {formData.treasuryAccount || (isArabic ? "غير مدخل" : "Not entered")}
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
                  ? "تنقل سريع داخل نفس موديول المدفوعات."
                  : "Quick navigation within the payments module."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <Link href="/system/payments" className="block">
                <Button variant="outline" className="w-full rounded-2xl">
                  <ArrowLeft className="ms-2 h-4 w-4" />
                  {t.backToPayments}
                </Button>
              </Link>

              <Link href="/system/payments" className="block">
                <Button variant="outline" className="w-full rounded-2xl">
                  <FileText className="ms-2 h-4 w-4" />
                  {isArabic ? "قائمة المدفوعات" : "Payments List"}
                </Button>
              </Link>

              <Link href="/system" className="block">
                <Button variant="outline" className="w-full rounded-2xl">
                  <Building2 className="ms-2 h-4 w-4" />
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