"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, RefreshCcw, Trash2 } from "lucide-react";
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

type AppLocale = "ar" | "en";

type Tx = {
  id: number | string;
  transaction_number: string;
  transaction_type: string;
  transaction_type_label?: string;
  status: string;
  status_label?: string;
  transaction_date: string;
  amount: string;
  currency: string;
  treasury_account?: { name?: string; code?: string };
  destination_account?: { name?: string; code?: string } | null;
  reference?: string;
  external_reference?: string;
  description?: string;
  notes?: string;
  journal_entry_reference?: string;
  created_at?: string;
  updated_at?: string;
};

function readLocale(): AppLocale {
  if (typeof window === "undefined") return "ar";
  const saved = localStorage.getItem("primey-locale");
  return saved === "en" || saved === "ar" ? saved : document.documentElement.lang === "en" ? "en" : "ar";
}

function money(value: string | number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";
  return {
    title: ar ? "تفاصيل الحركة المالية" : "Transaction Details",
    subtitle: ar ? "عرض بيانات الحركة وتأكيدها أو إلغاؤها حسب حالتها." : "View transaction data and confirm or cancel it based on status.",
    back: ar ? "قائمة الحركات" : "Transactions",
    refresh: ar ? "تحديث" : "Refresh",
    confirm: ar ? "تأكيد الحركة" : "Confirm Transaction",
    cancel: ar ? "إلغاء الحركة" : "Cancel Transaction",
    loading: ar ? "جاري تحميل الحركة..." : "Loading transaction...",
    apiError: ar ? "تعذر تحميل الحركة." : "Unable to load transaction.",
    confirmed: ar ? "تم تأكيد الحركة بنجاح" : "Transaction confirmed successfully",
    cancelled: ar ? "تم إلغاء الحركة بنجاح" : "Transaction cancelled successfully",
    noData: ar ? "لا توجد بيانات." : "No data.",
    fields: {
      number: ar ? "رقم الحركة" : "Number",
      type: ar ? "النوع" : "Type",
      status: ar ? "الحالة" : "Status",
      date: ar ? "التاريخ" : "Date",
      account: ar ? "الحساب الأساسي" : "Treasury Account",
      destination: ar ? "الحساب الوجهة" : "Destination Account",
      amount: ar ? "المبلغ" : "Amount",
      reference: ar ? "المرجع" : "Reference",
      external: ar ? "مرجع خارجي" : "External Reference",
      journal: ar ? "مرجع القيد" : "Journal Reference",
      description: ar ? "الوصف" : "Description",
      notes: ar ? "ملاحظات" : "Notes",
      created: ar ? "تاريخ الإنشاء" : "Created At",
      updated: ar ? "آخر تحديث" : "Updated At",
    },
  };
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-medium">{value || "-"}</p>
    </div>
  );
}

export default function TreasuryTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = use(params);
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [item, setItem] = useState<Tx | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const t = useMemo(() => dictionary(locale), [locale]);

  async function loadItem() {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/treasury/transactions/${resolved.id}/`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      setItem(payload?.data || payload);
    } catch (error) {
      console.error(error);
      toast.error(t.apiError);
      setItem(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function confirmTransaction() {
    try {
      setIsActionLoading(true);
      const response = await fetch(`/api/treasury/transactions/${resolved.id}/confirm/`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success === false) throw new Error(payload?.message || "Confirm failed");
      toast.success(t.confirmed);
      await loadItem();
    } catch (error) {
      console.error(error);
      toast.error(t.apiError);
    } finally {
      setIsActionLoading(false);
    }
  }

  async function cancelTransaction() {
    try {
      setIsActionLoading(true);
      const response = await fetch(`/api/treasury/transactions/${resolved.id}/`, {
        method: "DELETE",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success === false) throw new Error(payload?.message || "Cancel failed");
      toast.success(t.cancelled);
      await loadItem();
    } catch (error) {
      console.error(error);
      toast.error(t.apiError);
    } finally {
      setIsActionLoading(false);
    }
  }

  useEffect(() => {
    const next = readLocale();
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    setLocale(next);
  }, []);

  useEffect(() => {
    loadItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved.id, locale]);

  const canConfirm = item?.status === "DRAFT";
  const canCancel = item?.status !== "CONFIRMED" && item?.status !== "CANCELLED";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">/system/treasury/transactions/{resolved.id}</Badge>
            {item ? <Badge className="rounded-full">{item.status_label || item.status}</Badge> : null}
          </div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">{t.title}</h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">{t.subtitle}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/system/treasury/transactions">
            <Button variant="outline" className="h-10 rounded-xl">
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </Button>
          </Link>
          <Button variant="outline" className="h-10 rounded-xl" onClick={loadItem} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            {t.refresh}
          </Button>
          {canCancel ? (
            <Button variant="outline" className="h-10 rounded-xl" onClick={cancelTransaction} disabled={isActionLoading}>
              <Trash2 className="h-4 w-4" />
              {t.cancel}
            </Button>
          ) : null}
          {canConfirm ? (
            <Button className="h-10 rounded-xl" onClick={confirmTransaction} disabled={isActionLoading}>
              <CheckCircle2 className="h-4 w-4" />
              {t.confirm}
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{item?.transaction_number || t.title}</CardTitle>
          <CardDescription>{item?.description || t.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.loading}
            </div>
          ) : item ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label={t.fields.number} value={item.transaction_number} />
              <Field label={t.fields.type} value={item.transaction_type_label || item.transaction_type} />
              <Field label={t.fields.status} value={item.status_label || item.status} />
              <Field label={t.fields.date} value={item.transaction_date} />
              <Field label={t.fields.account} value={`${item.treasury_account?.code || ""} ${item.treasury_account?.name || ""}`} />
              <Field label={t.fields.destination} value={item.destination_account ? `${item.destination_account?.code || ""} ${item.destination_account?.name || ""}` : "-"} />
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-muted-foreground text-xs">{t.fields.amount}</p>
                <div className="mt-1 flex items-center gap-2 font-bold">
                  <Image src="/currency/sar.svg" alt="SAR" width={18} height={18} />
                  {money(item.amount)}
                </div>
              </div>
              <Field label={t.fields.reference} value={item.reference} />
              <Field label={t.fields.external} value={item.external_reference} />
              <Field label={t.fields.journal} value={item.journal_entry_reference} />
              <Field label={t.fields.description} value={item.description} />
              <Field label={t.fields.notes} value={item.notes} />
              <Field label={t.fields.created} value={item.created_at} />
              <Field label={t.fields.updated} value={item.updated_at} />
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">{t.noData}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}