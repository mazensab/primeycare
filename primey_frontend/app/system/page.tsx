"use client";

import { useEffect, useState } from "react";

import CustomDateRangePicker from "@/components/custom-date-range-picker";
import { Button } from "@/components/ui/button";

import {
  LeadBySourceCard,
  SalesPipeline,
  LeadsCard,
  TargetCard,
  TotalCustomersCard,
  TotalDeals,
  TotalRevenueCard,
  RecentTasks,
} from "@/components/analytics";

/* ============================================================
   📂 app/system/page.tsx
   Primey Care - System Dashboard
   ------------------------------------------------------------
   ✅ تثبيت تصميم CRM Dashboard كما هو
   ✅ لا تغيير في ترتيب الكروت
   ✅ لا تغيير في شكل الجدول
   ✅ لا ربط API في هذه النسخة
   ✅ يدعم تبديل عنوان الصفحة وزر التحميل عربي/إنجليزي
   ✅ اتجاه الصفحة ثابت LTR لحفظ التصميم 1:1
============================================================ */

type AppLocale = "ar" | "en";

const PRIMEY_LOCALE_STORAGE_KEY = "primey-locale";

function getStoredLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const savedLocale = window.localStorage.getItem(PRIMEY_LOCALE_STORAGE_KEY);
    return savedLocale === "en" ? "en" : "ar";
  } catch (error) {
    console.error("Read locale error:", error);
    return "ar";
  }
}

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "لوحة تحكم النظام" : "CRM Dashboard",
    download: isArabic ? "تحميل" : "Download",
  };
}

export default function Page() {
  const [locale, setLocale] = useState<AppLocale>(() => getStoredLocale());

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = getStoredLocale();
      setLocale(nextLocale);
    };

    syncLocale();

    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  const labels = dictionary(locale);

  return (
    <div className="space-y-4" dir="ltr">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
          {labels.pageTitle}
        </h1>

        <div className="flex items-center space-x-2">
          <CustomDateRangePicker />
          <Button>{labels.download}</Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <TargetCard />
          <TotalCustomersCard />
          <TotalDeals />
          <TotalRevenueCard />
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <LeadBySourceCard />
          <RecentTasks />
          <SalesPipeline />
        </div>

        <LeadsCard />
      </div>
    </div>
  );
}