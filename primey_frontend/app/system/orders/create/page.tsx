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
  FileText,
  Loader2,
  Package,
  Plus,
  Save,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tag,
  Truck,
  UserRound,
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

type OrderFormData = {
  orderNumber: string;
  customerName: string;
  customerCode: string;
  productName: string;
  productCode: string;
  contractNumber: string;
  centerName: string;
  providerName: string;
  orderDate: string;
  deliveryDate: string;
  orderStatus: string;
  paymentStatus: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  deliveryMethod: string;
  deliveryAddress: string;
  notes: string;
};

type OrderFormErrors = Partial<Record<keyof OrderFormData, string>>;

function detectLocale(): AppLocale {
  return "ar";
}

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "إضافة طلب جديد" : "Create New Order",
    pageSubtitle: isArabic
      ? "هذه الصفحة مخصصة لإنشاء طلب جديد داخل النظام بنفس هوية Primey Care المعتمدة، مع تجهيز احترافي لمرحلة الربط اللاحقة مع الـ APIs والعملاء والمنتجات والعقود والفواتير والمدفوعات."
      : "This page is designed to create a new order inside the system using the approved Primey Care UI, with a professional foundation for later API, customers, products, contracts, invoices, and payments integration.",

    heroBadge1: isArabic ? "System Module" : "System Module",
    heroBadge2: isArabic ? "Create Order" : "Create Order",

    backToOrders: isArabic ? "العودة إلى الطلبات" : "Back to Orders",
    saveDraft: isArabic ? "حفظ مبدئي" : "Save Draft",
    createOrder: isArabic ? "إنشاء الطلب" : "Create Order",

    basicInfo: isArabic ? "البيانات الأساسية" : "Basic Information",
    relationsInfo: isArabic ? "الارتباطات" : "Relations",
    timelineInfo: isArabic ? "التواريخ والحالة" : "Dates & Status",
    financialInfo: isArabic ? "البيانات المالية" : "Financial Information",
    deliveryInfo: isArabic ? "التسليم والملاحظات" : "Delivery & Notes",
    quickGuide: isArabic ? "إرشادات سريعة" : "Quick Guide",
    createSummary: isArabic ? "ملخص الإنشاء" : "Creation Summary",

    orderNumber: isArabic ? "رقم الطلب" : "Order Number",
    customerName: isArabic ? "اسم العميل" : "Customer Name",
    customerCode: isArabic ? "كود العميل" : "Customer Code",
    productName: isArabic ? "اسم المنتج / الخدمة" : "Product / Service Name",
    productCode: isArabic ? "كود المنتج" : "Product Code",
    contractNumber: isArabic ? "رقم العقد" : "Contract Number",
    centerName: isArabic ? "المركز" : "Center",
    providerName: isArabic ? "مقدم الخدمة" : "Provider",
    orderDate: isArabic ? "تاريخ الطلب" : "Order Date",
    deliveryDate: isArabic ? "تاريخ التسليم" : "Delivery Date",
    orderStatus: isArabic ? "حالة الطلب" : "Order Status",
    paymentStatus: isArabic ? "حالة الدفع" : "Payment Status",
    quantity: isArabic ? "الكمية" : "Quantity",
    unitPrice: isArabic ? "سعر الوحدة" : "Unit Price",
    discountAmount: isArabic ? "قيمة الخصم" : "Discount Amount",
    taxAmount: isArabic ? "قيمة الضريبة" : "Tax Amount",
    totalAmount: isArabic ? "الإجمالي النهائي" : "Total Amount",
    deliveryMethod: isArabic ? "طريقة التسليم" : "Delivery Method",
    deliveryAddress: isArabic ? "عنوان التسليم" : "Delivery Address",
    notes: isArabic ? "ملاحظات" : "Notes",

    placeholders: {
      orderNumber: isArabic ? "مثال: ORD-2026-001" : "Example: ORD-2026-001",
      customerName: isArabic ? "مثال: أحمد علي" : "Example: Ahmed Ali",
      customerCode: isArabic ? "مثال: CUS-001" : "Example: CUS-001",
      productName: isArabic
        ? "مثال: باقة رعاية سنوية"
        : "Example: Annual Care Package",
      productCode: isArabic ? "مثال: PRD-001" : "Example: PRD-001",
      contractNumber: isArabic ? "مثال: CTR-2026-001" : "Example: CTR-2026-001",
      centerName: isArabic
        ? "مثال: Prime Care Jeddah"
        : "Example: Prime Care Jeddah",
      providerName: isArabic
        ? "مثال: Al Noor Medical"
        : "Example: Al Noor Medical",
      orderStatus: isArabic
        ? "مثال: جديد / مؤكد / قيد التنفيذ"
        : "Example: New / Confirmed / Processing",
      paymentStatus: isArabic
        ? "مثال: غير مدفوع / جزئي / مدفوع"
        : "Example: Unpaid / Partial / Paid",
      quantity: isArabic ? "مثال: 1" : "Example: 1",
      unitPrice: isArabic ? "مثال: 1000" : "Example: 1000",
      discountAmount: isArabic ? "مثال: 50" : "Example: 50",
      taxAmount: isArabic ? "مثال: 150" : "Example: 150",
      totalAmount: isArabic ? "مثال: 1100" : "Example: 1100",
      deliveryMethod: isArabic
        ? "مثال: حضوري / رقمي / شحن"
        : "Example: In-person / Digital / Shipping",
      deliveryAddress: isArabic
        ? "اكتب عنوان التسليم الكامل"
        : "Write the full delivery address",
      notes: isArabic
        ? "أي ملاحظات إضافية عن الطلب"
        : "Any additional notes about the order",
    },

    tips: [
      isArabic
        ? "ابدأ الآن ببناء واجهة الإنشاء، والربط مع API سيتم لاحقًا بدون تغيير الهوية."
        : "Start with the create UI now; API integration can be added later without changing the visual identity.",
      isArabic
        ? "يفضل توحيد ترقيم الطلبات وحالات الطلب والدفع من البداية."
        : "Keep order numbering and order/payment statuses standardized from the beginning.",
      isArabic
        ? "يمكن لاحقًا ربط الطلب بالعميل والمنتج والعقد والفاتورة والدفع والتنفيذ بشكل كامل."
        : "Later you can fully connect the order with the customer, product, contract, invoice, payment, and fulfillment.",
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
          ? "عملاء / منتجات / فواتير"
          : "Customers / Products / Invoices",
        icon: FileText,
      },
    ],

    sectionDescriptions: {
      basicInfo: isArabic
        ? "أدخل البيانات الأساسية للطلب التي سيتم اعتمادها داخل النظام."
        : "Enter the order core information to be used across the system.",
      relationsInfo: isArabic
        ? "حدد العميل والمنتج والجهات التشغيلية المرتبطة بالطلب."
        : "Define the customer, product, and operational entities linked to the order.",
      timelineInfo: isArabic
        ? "أدخل التواريخ والحالات الأساسية للطلب."
        : "Enter the main dates and statuses for the order.",
      financialInfo: isArabic
        ? "أضف القيم المالية الرئيسية الخاصة بالطلب."
        : "Add the main financial values for the order.",
      deliveryInfo: isArabic
        ? "أضف معلومات التسليم والملاحظات التشغيلية."
        : "Add delivery information and operational notes.",
    },

    validation: {
      required: isArabic ? "هذا الحقل مطلوب" : "This field is required",
      invalidDate: isArabic ? "التاريخ غير صالح" : "Invalid date",
      invalidDateRange: isArabic
        ? "تاريخ التسليم يجب أن يكون في نفس اليوم أو بعد تاريخ الطلب"
        : "Delivery date must be on or after order date",
      invalidAmount: isArabic ? "القيمة المالية غير صحيحة" : "Invalid financial amount",
      invalidQuantity: isArabic ? "الكمية غير صحيحة" : "Invalid quantity",
    },

    successTitle: isArabic ? "تم تجهيز النموذج" : "Form prepared",
    successText: isArabic
      ? "واجهة إنشاء الطلب جاهزة، وسيتم لاحقًا ربط زر الحفظ مع الـ API."
      : "The create order UI is ready. The save action will be connected to the API later.",

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

function isValidQuantity(value: string) {
  if (!value.trim()) return true;
  const numeric = Number(value);
  return !Number.isNaN(numeric) && numeric > 0;
}

export default function SystemCreateOrderPage() {
  const locale = detectLocale();
  const isArabic = locale === "ar";
  const t = dictionary(locale);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<OrderFormData>({
    orderNumber: "",
    customerName: "",
    customerCode: "",
    productName: "",
    productCode: "",
    contractNumber: "",
    centerName: "",
    providerName: "",
    orderDate: "",
    deliveryDate: "",
    orderStatus: "",
    paymentStatus: "",
    quantity: "",
    unitPrice: "",
    discountAmount: "",
    taxAmount: "",
    totalAmount: "",
    deliveryMethod: "",
    deliveryAddress: "",
    notes: "",
  });
  const [errors, setErrors] = useState<OrderFormErrors>({});

  const completionStats = useMemo(() => {
    const values = Object.values(formData);
    const filled = values.filter((value) => value.trim().length > 0).length;
    const total = values.length;
    const percent = Math.round((filled / total) * 100);
    return { filled, total, percent };
  }, [formData]);

  function setField<K extends keyof OrderFormData>(
    key: K,
    value: OrderFormData[K]
  ) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateForm() {
    const nextErrors: OrderFormErrors = {};

    if (!formData.orderNumber.trim()) {
      nextErrors.orderNumber = t.validation.required;
    }

    if (!formData.customerName.trim()) {
      nextErrors.customerName = t.validation.required;
    }

    if (!formData.productName.trim()) {
      nextErrors.productName = t.validation.required;
    }

    if (!formData.orderDate.trim()) {
      nextErrors.orderDate = t.validation.required;
    } else if (!isValidDate(formData.orderDate)) {
      nextErrors.orderDate = t.validation.invalidDate;
    }

    if (!formData.deliveryDate.trim()) {
      nextErrors.deliveryDate = t.validation.required;
    } else if (!isValidDate(formData.deliveryDate)) {
      nextErrors.deliveryDate = t.validation.invalidDate;
    }

    if (
      formData.orderDate.trim() &&
      formData.deliveryDate.trim() &&
      isValidDate(formData.orderDate) &&
      isValidDate(formData.deliveryDate)
    ) {
      const orderDate = new Date(formData.orderDate).getTime();
      const deliveryDate = new Date(formData.deliveryDate).getTime();
      if (deliveryDate < orderDate) {
        nextErrors.deliveryDate = t.validation.invalidDateRange;
      }
    }

    if (formData.quantity.trim() && !isValidQuantity(formData.quantity)) {
      nextErrors.quantity = t.validation.invalidQuantity;
    }

    if (formData.unitPrice.trim() && !isValidAmount(formData.unitPrice)) {
      nextErrors.unitPrice = t.validation.invalidAmount;
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
                <Link href="/system/orders" className="w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-2xl sm:w-auto"
                  >
                    <ArrowLeft className="ms-2 h-4 w-4" />
                    {t.backToOrders}
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
                  {t.createOrder}
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
                      ? "يشمل ذلك رقم الطلب، العميل، المنتج، التواريخ، والحقول المالية القابلة للربط لاحقًا."
                      : "This includes order number, customer, product, dates, and financial fields that will later be connected."}
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
                <Label htmlFor="orderNumber">{t.orderNumber}</Label>
                <Input
                  id="orderNumber"
                  value={formData.orderNumber}
                  onChange={(e) => setField("orderNumber", e.target.value)}
                  placeholder={t.placeholders.orderNumber}
                  className="rounded-2xl"
                />
                {errors.orderNumber ? (
                  <p className="text-sm text-red-500">{errors.orderNumber}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="productName">{t.productName}</Label>
                <Input
                  id="productName"
                  value={formData.productName}
                  onChange={(e) => setField("productName", e.target.value)}
                  placeholder={t.placeholders.productName}
                  className="rounded-2xl"
                />
                {errors.productName ? (
                  <p className="text-sm text-red-500">{errors.productName}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="productCode">{t.productCode}</Label>
                <Input
                  id="productCode"
                  value={formData.productCode}
                  onChange={(e) => setField("productCode", e.target.value)}
                  placeholder={t.placeholders.productCode}
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractNumber">{t.contractNumber}</Label>
                <Input
                  id="contractNumber"
                  value={formData.contractNumber}
                  onChange={(e) => setField("contractNumber", e.target.value)}
                  placeholder={t.placeholders.contractNumber}
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
                <Label htmlFor="centerName">{t.centerName}</Label>
                <Input
                  id="centerName"
                  value={formData.centerName}
                  onChange={(e) => setField("centerName", e.target.value)}
                  placeholder={t.placeholders.centerName}
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="providerName">{t.providerName}</Label>
                <Input
                  id="providerName"
                  value={formData.providerName}
                  onChange={(e) => setField("providerName", e.target.value)}
                  placeholder={t.placeholders.providerName}
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
                <Label htmlFor="orderDate">{t.orderDate}</Label>
                <Input
                  id="orderDate"
                  type="date"
                  value={formData.orderDate}
                  onChange={(e) => setField("orderDate", e.target.value)}
                  className="rounded-2xl"
                />
                {errors.orderDate ? (
                  <p className="text-sm text-red-500">{errors.orderDate}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryDate">{t.deliveryDate}</Label>
                <Input
                  id="deliveryDate"
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) => setField("deliveryDate", e.target.value)}
                  className="rounded-2xl"
                />
                {errors.deliveryDate ? (
                  <p className="text-sm text-red-500">{errors.deliveryDate}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="orderStatus">{t.orderStatus}</Label>
                <Input
                  id="orderStatus"
                  value={formData.orderStatus}
                  onChange={(e) => setField("orderStatus", e.target.value)}
                  placeholder={t.placeholders.orderStatus}
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
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.financialInfo}</CardTitle>
              <CardDescription>{t.sectionDescriptions.financialInfo}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quantity">{t.quantity}</Label>
                <Input
                  id="quantity"
                  value={formData.quantity}
                  onChange={(e) => setField("quantity", e.target.value)}
                  placeholder={t.placeholders.quantity}
                  className="rounded-2xl"
                />
                {errors.quantity ? (
                  <p className="text-sm text-red-500">{errors.quantity}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitPrice">{t.unitPrice}</Label>
                <Input
                  id="unitPrice"
                  value={formData.unitPrice}
                  onChange={(e) => setField("unitPrice", e.target.value)}
                  placeholder={t.placeholders.unitPrice}
                  className="rounded-2xl"
                />
                {errors.unitPrice ? (
                  <p className="text-sm text-red-500">{errors.unitPrice}</p>
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

              <div className="space-y-2 md:col-span-2">
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
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/20 bg-white/70 shadow-lg dark:border-white/10 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{t.deliveryInfo}</CardTitle>
              <CardDescription>{t.sectionDescriptions.deliveryInfo}</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5">
              <div className="space-y-2">
                <Label htmlFor="deliveryMethod">{t.deliveryMethod}</Label>
                <Input
                  id="deliveryMethod"
                  value={formData.deliveryMethod}
                  onChange={(e) => setField("deliveryMethod", e.target.value)}
                  placeholder={t.placeholders.deliveryMethod}
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryAddress">{t.deliveryAddress}</Label>
                <Textarea
                  id="deliveryAddress"
                  value={formData.deliveryAddress}
                  onChange={(e) => setField("deliveryAddress", e.target.value)}
                  placeholder={t.placeholders.deliveryAddress}
                  className="min-h-[110px] rounded-2xl"
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
                    <ShoppingCart className="h-4 w-4" />
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
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t.productName}</p>
                    <p className="text-sm font-semibold">
                      {formData.productName || (isArabic ? "غير مدخل" : "Not entered")}
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
                    <p className="text-muted-foreground text-xs">{t.orderDate}</p>
                    <p className="text-sm font-semibold">
                      {formData.orderDate || (isArabic ? "غير مدخل" : "Not entered")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t.deliveryMethod}</p>
                    <p className="text-sm font-semibold">
                      {formData.deliveryMethod || (isArabic ? "غير مدخل" : "Not entered")}
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
                  ? "تنقل سريع داخل نفس موديول الطلبات."
                  : "Quick navigation within the orders module."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <Link href="/system/orders" className="block">
                <Button variant="outline" className="w-full rounded-2xl">
                  <ArrowLeft className="ms-2 h-4 w-4" />
                  {t.backToOrders}
                </Button>
              </Link>

              <Link href="/system/orders" className="block">
                <Button variant="outline" className="w-full rounded-2xl">
                  <FileText className="ms-2 h-4 w-4" />
                  {isArabic ? "قائمة الطلبات" : "Orders List"}
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