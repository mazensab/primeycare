"use client";

import Link from "next/link";
import { ArrowLeft, Calculator, Construction } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/* =====================================================
   📂 app/system/accounting/accounts/create/page.tsx
   🧠 Primey Care | Create Accounting Account Page
   -----------------------------------------------------
   ✅ صفحة مؤقتة آمنة لتجاوز Build
   ✅ لا تكسر مرحلة المحاسبة المؤجلة
   ✅ سيتم بناؤها كاملًا عند العودة للمرحلة 12
===================================================== */

export default function CreateAccountingAccountPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-3xl border bg-card/80 p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Calculator className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Primey Care Accounting
              </p>
              <h1 className="text-2xl font-bold tracking-tight">
                إنشاء حساب محاسبي
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                تم تأجيل بناء صفحة إنشاء الحسابات ضمن المرحلة 12 الخاصة
                بالمحاسبة، وهذه الصفحة مؤقتة فقط للحفاظ على استقرار البناء.
              </p>
            </div>
          </div>

          <Button asChild variant="outline" className="rounded-2xl">
            <Link href="/system/accounting/accounts">
              <ArrowLeft className="ms-2 h-4 w-4" />
              العودة لدليل الحسابات
            </Link>
          </Button>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
              <Construction className="h-8 w-8 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-semibold">قيد التجهيز</h2>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                سيتم بناء هذه الصفحة لاحقًا بنفس نمط صفحات Primey Care
                وبربط مباشر مع API المحاسبة، بدون المساس بأي منجز سابق.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}