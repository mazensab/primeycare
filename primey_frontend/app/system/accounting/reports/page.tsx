"use client";

/* ============================================================
   📂 app/system/accounting/reports/page.tsx
   🧠 Primey Care | Accounting Reports Page

   ✅ المسار:
      app/system/accounting/reports/page.tsx

   ✅ العمل:
      صفحة تقارير المحاسبة داخل مديول المحاسبة.
      تعرض مركز تقارير المحاسبة، المؤشرات المالية المختصرة، وروابط التقارير المحاسبية الأساسية.

   ✅ الإصدار:
      Phase 17 UX Refinement + Accounting Reports Build

   ✅ يعتمد على:
      - /api/accounting/reports/summary/
      - /api/accounting/reports/
      - /api/reports/accounting/
      - primey-locale
      - AuthProvider
      - sonner
      - /currency/sar.svg

   ✅ متوافق مع:
      - Accounting dashboard page
      - Accounting journals pages
      - Accounting accounts pages
      - Accounting cost centers pages
      - Fiscal years / periods pages
      - Central reports module
      - Centers / Customers approved UX standard

   ✅ الوظائف:
      - عرض مؤشرات محاسبية مختصرة.
      - عرض بطاقات تقارير المحاسبة.
      - بحث في صف مستقل.
      - الفلاتر في صف منفصل.
      - تصنيف التقارير حسب النوع.
      - Excel export بصيغة .xls HTML Workbook.
      - Web PDF Print.
      - Error State مستقل.
      - Empty State ذكي.
      - Skeleton Loading.
      - صلاحيات آمنة بدون كسر system_admin/superuser.
      - أرقام إنجليزية دائمًا.
      - رمز SAR من /currency/sar.svg بعد الرقم.

   ------------------------------------------------------------
   تحسينات هذا الإصدار:
      - الملف المرفق كان شبه فارغ، لذلك تم بناء الصفحة كاملة من الصفر.
      - الالتزام بالقاعدة: w-full space-y-4 بدون main/min-h-screen/max-w.
      - عدم عرض أي مسارات أو عبارات تقنية داخل واجهة المستخدم.
      - استخدام sonner للتنبيهات.
      - استخدام Excel HTML Workbook بدل CSV أو XLSX.
============================================================ */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  Building2,
  CalendarClock,
  Columns3,
  Download,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Layers3,
  Loader2,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/AuthProvider";
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

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";
type Dict = Record<string, unknown>;

type ReportCategory =
  | "FINANCIAL_STATEMENTS"
  | "LEDGER"
  | "JOURNALS"
  | "COST_CENTERS"
  | "PERIODS";

type CategoryFilter = "ALL" | ReportCategory;

type AccountingSummary = {
  total_debit: number;
  total_credit: number;
  net_balance: number;
  journal_entries_count: number;
  posted_entries_count: number;
  draft_entries_count: number;
  accounts_count: number;
  cost_centers_count: number;
  fiscal_years_count: number;
  open_periods_count: number;
};

type ReportItem = {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  category: ReportCategory;
  href: string;
  icon: "statement" | "ledger" | "journal" | "cost" | "period";
};

type ApiEnvelope<T> = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  data?: T;
  summary?: Partial<AccountingSummary>;
  results?: unknown[];
  items?: unknown[];
  rows?: unknown[];
};

const SAR_ICON_PATH = "/currency/sar.svg";

const DEFAULT_SUMMARY: AccountingSummary = {
  total_debit: 0,
  total_credit: 0,
  net_balance: 0,
  journal_entries_count: 0,
  posted_entries_count: 0,
  draft_entries_count: 0,
  accounts_count: 0,
  cost_centers_count: 0,
  fiscal_years_count: 0,
  open_periods_count: 0,
};

/* ============================================================
   Locale / API
============================================================ */

function readLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const saved =
      window.localStorage.getItem("primey-locale") ||
      window.localStorage.getItem("locale") ||
      window.localStorage.getItem("lang");

    if (saved === "en") return "en";
    if (saved === "ar") return "ar";

    return document.documentElement.lang === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

function applyDocumentLocale(locale: AppLocale) {
  try {
    if (typeof document === "undefined") return;

    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.body.dir = locale === "ar" ? "rtl" : "ltr";
  } catch (error) {
    console.error("Apply locale error:", error);
  }
}

function apiUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  if (!base) return path;

  return `${base.replace(/\/$/, "")}${path}`;
}

/* ============================================================
   Auth / Permissions
============================================================ */

function asDict(value: unknown): Dict {
  return value && typeof value === "object" ? (value as Dict) : {};
}

function getNested(source: Dict, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (value && typeof value === "object") {
      return value as Dict;
    }
  }

  return {};
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => {
          if (!value) return [];

          if (typeof value === "string") return [value];

          if (Array.isArray(value)) {
            return value.flatMap((item) => {
              if (typeof item === "string") return [item];

              if (item && typeof item === "object") {
                const obj = item as Dict;

                return [
                  obj.code,
                  obj.codename,
                  obj.permission,
                  obj.name,
                  obj.role,
                ].filter(Boolean) as string[];
              }

              return [];
            });
          }

          if (value && typeof value === "object") {
            const obj = value as Dict;

            return [
              obj.code,
              obj.codename,
              obj.permission,
              obj.name,
              obj.role,
            ].filter(Boolean) as string[];
          }

          return [];
        })
        .map((item) => String(item).trim())
        .filter(Boolean),
    ),
  );
}

function getAuthUser(authValue: unknown) {
  const auth = asDict(authValue);

  return getNested(auth, [
    "user",
    "currentUser",
    "profile",
    "account",
    "session",
    "data",
  ]);
}

function getAuthRoles(authValue: unknown): string[] {
  const auth = asDict(authValue);
  const user = getAuthUser(authValue);

  return uniqueStrings([
    auth.role,
    auth.roles,
    auth.user_role,
    auth.userType,
    auth.user_type,
    auth.workspace,
    auth.workspaces,
    auth.type,
    user.role,
    user.roles,
    user.user_role,
    user.userType,
    user.user_type,
    user.workspace,
    user.workspaces,
    user.type,
  ]).map((item) => item.toLowerCase());
}

function getAuthPermissionCodes(authValue: unknown): string[] {
  const auth = asDict(authValue);
  const user = getAuthUser(authValue);

  const authPermissions = asDict(auth.permissions);
  const userPermissions = asDict(user.permissions);
  const authProfilePermissions = asDict(auth.profile_permissions);
  const userProfilePermissions = asDict(user.profile_permissions);

  return uniqueStrings([
    auth.permission_codes,
    auth.permissions,
    auth.codes,
    auth.profile_permissions,
    authPermissions.codes,
    authProfilePermissions.codes,
    user.permission_codes,
    user.permissions,
    user.codes,
    user.profile_permissions,
    userPermissions.codes,
    userProfilePermissions.codes,
  ]);
}

function isAuthResolving(authValue: unknown) {
  const auth = asDict(authValue);

  return Boolean(
    auth.isLoading ||
      auth.loading ||
      auth.isInitializing ||
      auth.initializing ||
      auth.pending,
  );
}

function isSystemAdmin(authValue: unknown) {
  const auth = asDict(authValue);
  const user = getAuthUser(authValue);
  const roles = getAuthRoles(authValue);

  return (
    Boolean(auth.is_superuser) ||
    Boolean(auth.isSuperuser) ||
    Boolean(auth.is_system_admin) ||
    Boolean(auth.isSystemAdmin) ||
    Boolean(user.is_superuser) ||
    Boolean(user.isSuperuser) ||
    Boolean(user.is_system_admin) ||
    Boolean(user.isSystemAdmin) ||
    roles.some((role) =>
      [
        "system_admin",
        "superuser",
        "super_admin",
        "superadmin",
        "admin",
        "administrator",
      ].includes(role),
    )
  );
}

function hasSafePermission(
  authValue: unknown,
  codes: string[],
  mode: "view" | "action",
) {
  if (isSystemAdmin(authValue)) return true;

  const permissions = getAuthPermissionCodes(authValue);

  if (permissions.length > 0) {
    return codes.some((code) => permissions.includes(code));
  }

  const roles = getAuthRoles(authValue);

  if (roles.length > 0) {
    if (mode === "view") {
      return roles.some((role) =>
        [
          "system_admin",
          "superuser",
          "super_admin",
          "accountant",
          "support",
          "viewer",
        ].includes(role),
      );
    }

    return roles.some((role) =>
      ["system_admin", "superuser", "super_admin", "accountant"].includes(role),
    );
  }

  return true;
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    title: isArabic ? "تقارير المحاسبة" : "Accounting Reports",
    subtitle: isArabic
      ? "مركز تقارير المحاسبة لمراجعة القوائم المالية، الأستاذ العام، القيود، مراكز التكلفة، والفترات."
      : "Accounting reports center for financial statements, ledger, journals, cost centers, and periods.",

    back: isArabic ? "لوحة المحاسبة" : "Accounting Overview",
    centralReports: isArabic ? "مركز التقارير" : "Reports Center",
    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    summaryTitle: isArabic ? "ملخص التقارير المحاسبية" : "Accounting Reports Summary",
    summaryDesc: isArabic
      ? "مؤشرات مختصرة تساعد في قراءة وضع المحاسبة قبل فتح التقارير التفصيلية."
      : "Short indicators to review accounting status before opening detailed reports.",

    reportsTitle: isArabic ? "التقارير المتاحة" : "Available Reports",
    reportsDesc: isArabic
      ? "اختر التقرير المناسب حسب نوع المراجعة المطلوبة."
      : "Choose the report that matches the required review.",

    totalDebit: isArabic ? "إجمالي المدين" : "Total Debit",
    totalCredit: isArabic ? "إجمالي الدائن" : "Total Credit",
    netBalance: isArabic ? "الصافي" : "Net Balance",
    journalEntries: isArabic ? "القيود المحاسبية" : "Journal Entries",
    postedEntries: isArabic ? "قيود مرحلة" : "Posted Entries",
    draftEntries: isArabic ? "قيود مسودة" : "Draft Entries",
    accounts: isArabic ? "الحسابات" : "Accounts",
    costCenters: isArabic ? "مراكز التكلفة" : "Cost Centers",
    fiscalYears: isArabic ? "السنوات المالية" : "Fiscal Years",
    openPeriods: isArabic ? "فترات مفتوحة" : "Open Periods",

    searchPlaceholder: isArabic
      ? "ابحث باسم التقرير أو وصفه..."
      : "Search by report name or description...",

    all: isArabic ? "الكل" : "All",
    financialStatements: isArabic ? "القوائم المالية" : "Financial Statements",
    ledger: isArabic ? "الأستاذ العام" : "Ledger",
    journals: isArabic ? "القيود" : "Journals",
    costCentersReports: isArabic ? "مراكز التكلفة" : "Cost Centers",
    periods: isArabic ? "الفترات" : "Periods",

    openReport: isArabic ? "فتح التقرير" : "Open Report",

    emptyTitle: isArabic ? "لا توجد تقارير مطابقة" : "No matching reports",
    emptyText: isArabic
      ? "جرّب تغيير البحث أو التصنيف."
      : "Try changing the search or category.",
    clearFilters: isArabic ? "مسح الفلاتر" : "Clear Filters",

    accessDeniedTitle: isArabic ? "غير مصرح بعرض تقارير المحاسبة" : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض تقارير المحاسبة. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view accounting reports. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحميل ملخص تقارير المحاسبة."
      : "Unable to load accounting reports summary.",
    loadErrorHint: isArabic
      ? "تحقق من الاتصال أو الصلاحيات ثم أعد المحاولة."
      : "Check the connection or permissions, then try again.",
    loadSuccess: isArabic
      ? "تم تحديث تقارير المحاسبة بنجاح."
      : "Accounting reports refreshed successfully.",

    exportSuccess: isArabic
      ? "تم تجهيز ملف Excel بنجاح."
      : "Excel file prepared successfully.",
    exportEmpty: isArabic
      ? "لا توجد بيانات قابلة للتصدير."
      : "No data available to export.",
    printSuccess: isArabic
      ? "تم تجهيز نافذة الطباعة."
      : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
    rowsCount: isArabic ? "عدد التقارير" : "Reports Count",
  };
}

/* ============================================================
   Data
============================================================ */

function reportsCatalog(): ReportItem[] {
  return [
    {
      id: "accounting-summary",
      titleAr: "ملخص المحاسبة",
      titleEn: "Accounting Summary",
      descriptionAr: "نظرة عامة على الأرصدة والقيود والحسابات.",
      descriptionEn: "Overview of balances, entries, and accounts.",
      category: "FINANCIAL_STATEMENTS",
      href: "/system/reports/accounting",
      icon: "statement",
    },
    {
      id: "balance-sheet",
      titleAr: "قائمة المركز المالي",
      titleEn: "Balance Sheet",
      descriptionAr: "عرض الأصول والالتزامات وحقوق الملكية.",
      descriptionEn: "View assets, liabilities, and equity.",
      category: "FINANCIAL_STATEMENTS",
      href: "/system/accounting/balance-sheet",
      icon: "statement",
    },
    {
      id: "trial-balance",
      titleAr: "ميزان المراجعة",
      titleEn: "Trial Balance",
      descriptionAr: "مراجعة إجمالي المدين والدائن لكل حساب.",
      descriptionEn: "Review total debit and credit for each account.",
      category: "FINANCIAL_STATEMENTS",
      href: "/system/reports/accounting",
      icon: "statement",
    },
    {
      id: "chart-of-accounts",
      titleAr: "دليل الحسابات",
      titleEn: "Chart of Accounts",
      descriptionAr: "عرض الحسابات وتصنيفها وأرصدتها.",
      descriptionEn: "View accounts, classifications, and balances.",
      category: "LEDGER",
      href: "/system/accounting/accounts",
      icon: "ledger",
    },
    {
      id: "general-ledger",
      titleAr: "الأستاذ العام",
      titleEn: "General Ledger",
      descriptionAr: "مراجعة حركة الحسابات والقيود المرتبطة.",
      descriptionEn: "Review account movements and linked entries.",
      category: "LEDGER",
      href: "/system/accounting/accounts",
      icon: "ledger",
    },
    {
      id: "journal-entries",
      titleAr: "تقرير القيود اليومية",
      titleEn: "Journal Entries Report",
      descriptionAr: "عرض القيود حسب الحالة والمصدر والفترة.",
      descriptionEn: "View journal entries by status, source, and period.",
      category: "JOURNALS",
      href: "/system/accounting/journals",
      icon: "journal",
    },
    {
      id: "cost-centers",
      titleAr: "تقرير مراكز التكلفة",
      titleEn: "Cost Centers Report",
      descriptionAr: "مراجعة أرصدة وحركات مراكز التكلفة.",
      descriptionEn: "Review balances and movements by cost center.",
      category: "COST_CENTERS",
      href: "/system/accounting/cost-centers",
      icon: "cost",
    },
    {
      id: "fiscal-years",
      titleAr: "تقرير السنوات المالية",
      titleEn: "Fiscal Years Report",
      descriptionAr: "عرض حالة السنوات المالية والفترات المرتبطة.",
      descriptionEn: "View fiscal year status and linked periods.",
      category: "PERIODS",
      href: "/system/accounting/fiscal-years",
      icon: "period",
    },
    {
      id: "accounting-periods",
      titleAr: "تقرير الفترات المحاسبية",
      titleEn: "Accounting Periods Report",
      descriptionAr: "مراجعة الفترات المفتوحة والمغلقة والقيود المرتبطة.",
      descriptionEn: "Review open and closed periods with linked entries.",
      category: "PERIODS",
      href: "/system/accounting/periods",
      icon: "period",
    },
  ];
}

/* ============================================================
   Helpers
============================================================ */

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatMoney(value: unknown): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function extractSummary(payload: ApiEnvelope<unknown> | null): Partial<AccountingSummary> {
  if (!payload) return {};

  const data = asDict(payload.data);

  return {
    ...asDict(payload.summary),
    ...asDict(data.summary),
    ...asDict(data.accounting),
    ...asDict(data.totals),
    ...asDict(data),
  };
}

function normalizeSummary(value: Partial<AccountingSummary>): AccountingSummary {
  return {
    total_debit: toNumber(value.total_debit),
    total_credit: toNumber(value.total_credit),
    net_balance: toNumber(value.net_balance) || toNumber(value.total_debit) - toNumber(value.total_credit),
    journal_entries_count: toNumber(value.journal_entries_count),
    posted_entries_count: toNumber(value.posted_entries_count),
    draft_entries_count: toNumber(value.draft_entries_count),
    accounts_count: toNumber(value.accounts_count),
    cost_centers_count: toNumber(value.cost_centers_count),
    fiscal_years_count: toNumber(value.fiscal_years_count),
    open_periods_count: toNumber(value.open_periods_count),
  };
}

function categoryLabel(category: CategoryFilter, locale: AppLocale) {
  const t = dictionary(locale);

  const labels: Record<CategoryFilter, string> = {
    ALL: t.all,
    FINANCIAL_STATEMENTS: t.financialStatements,
    LEDGER: t.ledger,
    JOURNALS: t.journals,
    COST_CENTERS: t.costCentersReports,
    PERIODS: t.periods,
  };

  return labels[category];
}

function reportTitle(report: ReportItem, locale: AppLocale) {
  return locale === "ar" ? report.titleAr : report.titleEn;
}

function reportDescription(report: ReportItem, locale: AppLocale) {
  return locale === "ar" ? report.descriptionAr : report.descriptionEn;
}

function SarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Image
      src={SAR_ICON_PATH}
      alt=""
      width={16}
      height={16}
      className={className}
    />
  );
}

function MoneyText({ value }: { value: unknown }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span>{formatMoney(value)}</span>
      <SarIcon className="h-3.5 w-3.5" />
    </span>
  );
}

function ReportIcon({ type }: { type: ReportItem["icon"] }) {
  if (type === "statement") return <FileBarChart className="h-5 w-5" />;
  if (type === "ledger") return <BookOpenCheck className="h-5 w-5" />;
  if (type === "journal") return <FileText className="h-5 w-5" />;
  if (type === "cost") return <Building2 className="h-5 w-5" />;
  return <CalendarClock className="h-5 w-5" />;
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function KpiSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="rounded-2xl border bg-card shadow-sm">
          <CardContent className="p-5">
            <SkeletonLine className="h-8 w-28" />
            <SkeletonLine className="mt-3 h-4 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ============================================================
   Export / Print
============================================================ */

function downloadExcel({
  filename,
  worksheetName,
  title,
  locale,
  summary,
  reports,
}: {
  filename: string;
  worksheetName: string;
  title: string;
  locale: AppLocale;
  summary: AccountingSummary;
  reports: ReportItem[];
}) {
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";

  const t = dictionary(locale);

  const rowsHtml = reports
    .map(
      (report) => `
        <tr>
          <td>${escapeHtml(reportTitle(report, locale))}</td>
          <td>${escapeHtml(categoryLabel(report.category, locale))}</td>
          <td>${escapeHtml(reportDescription(report, locale))}</td>
        </tr>`,
    )
    .join("");

  const workbook = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${escapeHtml(worksheetName)}</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayRightToLeft>${isArabic ? "True" : "False"}</x:DisplayRightToLeft>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { direction: ${dir}; font-family: Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th, td {
            border: 1px solid #d9e2ef;
            padding: 8px;
            text-align: ${align};
            vertical-align: top;
            mso-number-format: "\\@";
          }
          th { background: #d8ecfb; color: #000; font-weight: 700; }
          .title { font-size: 20px; font-weight: 700; text-align: center; background: #fff; }
          .section { font-weight: 700; background: #eef6ff; }
          .summary-label { font-weight: 700; background: #f8fafc; width: 240px; }
          .summary-value { font-weight: 700; }
        </style>
      </head>

      <body dir="${dir}">
        <table>
          <tr><td class="title" colspan="3">${escapeHtml(title)}</td></tr>
          <tr><td colspan="3"></td></tr>
          <tr><td class="section" colspan="3">${escapeHtml(t.summaryTitle)}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.generatedAt)}</td><td class="summary-value" colspan="2">${escapeHtml(new Date().toLocaleString("en-US"))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalDebit)}</td><td class="summary-value" colspan="2">${escapeHtml(formatMoney(summary.total_debit))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalCredit)}</td><td class="summary-value" colspan="2">${escapeHtml(formatMoney(summary.total_credit))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.netBalance)}</td><td class="summary-value" colspan="2">${escapeHtml(formatMoney(summary.net_balance))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.journalEntries)}</td><td class="summary-value" colspan="2">${escapeHtml(formatNumber(summary.journal_entries_count))}</td></tr>
          <tr><td colspan="3"></td></tr>
          <tr>
            <th>${escapeHtml(isArabic ? "التقرير" : "Report")}</th>
            <th>${escapeHtml(isArabic ? "التصنيف" : "Category")}</th>
            <th>${escapeHtml(isArabic ? "الوصف" : "Description")}</th>
          </tr>
          ${rowsHtml}
        </table>
      </body>
    </html>`;

  const blob = new Blob([workbook], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

function buildPrintHtml({
  locale,
  title,
  summary,
  reports,
}: {
  locale: AppLocale;
  title: string;
  summary: AccountingSummary;
  reports: ReportItem[];
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);
  const now = new Date().toLocaleString("en-US");

  const rows = reports
    .map(
      (report, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(reportTitle(report, locale))}</td>
          <td>${escapeHtml(categoryLabel(report.category, locale))}</td>
          <td>${escapeHtml(reportDescription(report, locale))}</td>
        </tr>`,
    )
    .join("");

  return `
    <!doctype html>
    <html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            font-family: Arial, Tahoma, sans-serif;
            color: #111827;
            background: #fff;
            direction: ${isArabic ? "rtl" : "ltr"};
            text-align: ${isArabic ? "right" : "left"};
          }
          .print-header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 18px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 14px;
          }
          h1 { margin: 0; font-size: 22px; font-weight: 800; }
          .meta { margin-top: 8px; color: #6b7280; font-size: 12px; line-height: 1.8; }
          .badge {
            border: 1px solid #d1d5db;
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 12px;
            height: fit-content;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 18px;
          }
          .summary-card {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 10px;
          }
          .summary-card span {
            display: block;
            color: #6b7280;
            font-size: 11px;
            margin-bottom: 5px;
          }
          .summary-card strong { font-size: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #f3f4f6; color: #111827; font-weight: 700; }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 9px 8px;
            text-align: ${isArabic ? "right" : "left"};
            vertical-align: top;
          }
          tr:nth-child(even) td { background: #fafafa; }
          @page { size: A4 landscape; margin: 12mm; }
          @media print { body { padding: 0; } }
        </style>
      </head>

      <body>
        <div class="print-header">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">
              <div>${escapeHtml(t.printedAt)}: ${escapeHtml(now)}</div>
              <div>${escapeHtml(t.rowsCount)}: ${formatNumber(reports.length)}</div>
            </div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card"><span>${escapeHtml(t.totalDebit)}</span><strong>${formatMoney(summary.total_debit)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.totalCredit)}</span><strong>${formatMoney(summary.total_credit)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.netBalance)}</span><strong>${formatMoney(summary.net_balance)}</strong></div>
          <div class="summary-card"><span>${escapeHtml(t.journalEntries)}</span><strong>${formatNumber(summary.journal_entries_count)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${escapeHtml(isArabic ? "التقرير" : "Report")}</th>
              <th>${escapeHtml(isArabic ? "التصنيف" : "Category")}</th>
              <th>${escapeHtml(isArabic ? "الوصف" : "Description")}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <script>
          window.addEventListener("load", () => {
            window.focus();
            window.print();
          });
        </script>
      </body>
    </html>
  `;
}

/* ============================================================
   Page
============================================================ */

export default function AccountingReportsPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [summary, setSummary] = useState<AccountingSummary>(DEFAULT_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasSafePermission(
    auth,
    ["accounting.view", "accounting.reports.view", "reports.accounting.view"],
    "view",
  );

  const canExport = hasSafePermission(
    auth,
    ["accounting.export", "reports.accounting.export", "reports.export"],
    "action",
  );

  const canPrint = hasSafePermission(
    auth,
    ["accounting.print", "reports.accounting.print", "reports.print"],
    "action",
  );

  const reports = useMemo(() => reportsCatalog(), []);

  const filteredReports = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesCategory =
        categoryFilter === "ALL" ? true : report.category === categoryFilter;

      const matchesQuery = !cleanQuery
        ? true
        : [
            report.titleAr,
            report.titleEn,
            report.descriptionAr,
            report.descriptionEn,
            categoryLabel(report.category, locale),
          ]
            .join(" ")
            .toLowerCase()
            .includes(cleanQuery);

      return matchesCategory && matchesQuery;
    });
  }, [categoryFilter, locale, query, reports]);

  const hasSearchOrFilter = query.trim().length > 0 || categoryFilter !== "ALL";

  const categoryOptions = useMemo(() => {
    const categories: CategoryFilter[] = [
      "ALL",
      "FINANCIAL_STATEMENTS",
      "LEDGER",
      "JOURNALS",
      "COST_CENTERS",
      "PERIODS",
    ];

    return categories.map((category) => ({
      value: category,
      label: categoryLabel(category, locale),
      count:
        category === "ALL"
          ? reports.length
          : reports.filter((report) => report.category === category).length,
    }));
  }, [locale, reports]);

  const loadSummary = useCallback(
    async (showToast = false) => {
      if (!canView) {
        setIsLoading(false);
        setSummary(DEFAULT_SUMMARY);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const endpoints = [
          "/api/accounting/reports/summary/",
          "/api/accounting/reports/",
          "/api/reports/accounting/",
        ];

        let loadedPayload: ApiEnvelope<unknown> | null = null;
        let loaded = false;
        let lastError = "";

        for (const endpoint of endpoints) {
          const response = await fetch(apiUrl(endpoint), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          });

          const payload = (await response.json().catch(() => null)) as
            | ApiEnvelope<unknown>
            | null;

          if ([400, 404, 405].includes(response.status)) {
            lastError =
              payload?.message ||
              payload?.detail ||
              payload?.error ||
              `HTTP ${response.status}`;
            continue;
          }

          if (
            !response.ok ||
            payload?.ok === false ||
            payload?.success === false
          ) {
            throw new Error(
              payload?.message ||
                payload?.detail ||
                payload?.error ||
                `HTTP ${response.status}`,
            );
          }

          loadedPayload = payload;
          loaded = true;
          break;
        }

        if (!loaded || !loadedPayload) {
          setSummary(DEFAULT_SUMMARY);
          setErrorMessage(lastError || t.loadError);
          return;
        }

        setSummary(normalizeSummary(extractSummary(loadedPayload)));

        if (showToast) {
          toast.success(t.loadSuccess);
        }
      } catch (error) {
        console.error("Accounting reports summary load error:", error);
        setSummary(DEFAULT_SUMMARY);
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canView, t.loadError, t.loadSuccess],
  );

  function clearFilters() {
    setQuery("");
    setCategoryFilter("ALL");
  }

  function exportExcel() {
    if (!canExport) return;

    if (filteredReports.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    downloadExcel({
      filename: `primey-care-accounting-reports-${new Date()
        .toISOString()
        .slice(0, 10)}.xls`,
      worksheetName: isArabic ? "تقارير المحاسبة" : "Accounting Reports",
      title: t.title,
      locale,
      summary,
      reports: filteredReports,
    });

    toast.success(t.exportSuccess);
  }

  function printPage() {
    if (!canPrint) return;

    if (filteredReports.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      toast.error(t.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        locale,
        title: t.title,
        summary,
        reports: filteredReports,
      }),
    );
    printWindow.document.close();

    toast.success(t.printSuccess);
  }

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readLocale();

      applyDocumentLocale(nextLocale);
      setLocale(nextLocale);
    };

    const syncAfterPaint = () => {
      syncLocale();
      window.setTimeout(syncLocale, 0);
    };

    syncAfterPaint();

    window.addEventListener("primey-locale-changed", syncAfterPaint);
    window.addEventListener("storage", syncAfterPaint);

    return () => {
      window.removeEventListener("primey-locale-changed", syncAfterPaint);
      window.removeEventListener("storage", syncAfterPaint);
    };
  }, []);

  useEffect(() => {
    if (authResolving) return;
    loadSummary(false);
  }, [authResolving, loadSummary]);

  if (!authResolving && !canView) {
    return (
      <div className="w-full space-y-4" dir={isArabic ? "rtl" : "ltr"}>
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5" />
            </div>

            <div>
              <p className="font-semibold text-destructive">
                {t.accessDeniedTitle}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.accessDeniedText}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t.title}
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/system/accounting">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </Button>
          </Link>

          <Link href="/system/reports/accounting">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl sm:w-auto"
            >
              <BarChart3 className="h-4 w-4" />
              <span>{t.centralReports}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadSummary(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{t.refresh}</span>
          </Button>

          {canExport ? (
            <Button
              className="h-10 rounded-xl"
              onClick={exportExcel}
              disabled={filteredReports.length === 0}
            >
              <Download className="h-4 w-4" />
              <span>{t.exportExcel}</span>
            </Button>
          ) : null}

          {canPrint ? (
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={printPage}
              disabled={filteredReports.length === 0}
            >
              <Printer className="h-4 w-4" />
              <span>{t.print}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {!isLoading && errorMessage ? (
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <XCircle className="h-5 w-5" />
              </div>

              <div>
                <p className="font-semibold text-destructive">
                  {errorMessage}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.loadErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadSummary(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <KpiSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    <MoneyText value={summary.total_debit} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.totalDebit}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <WalletCards className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    <MoneyText value={summary.total_credit} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.totalCredit}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    <MoneyText value={summary.net_balance} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.netBalance}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold">
                    {formatNumber(summary.journal_entries_count)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.journalEntries}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">
              {t.reportsTitle}
            </CardTitle>
            <CardDescription>{t.reportsDesc}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="relative w-full">
              <Search
                className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${
                  isArabic ? "right-3" : "left-3"
                }`}
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.searchPlaceholder}
                className={`h-11 rounded-xl ${isArabic ? "pr-10" : "pl-10"}`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {categoryOptions.map((category) => (
                <Button
                  key={category.value}
                  type="button"
                  variant={
                    categoryFilter === category.value ? "default" : "outline"
                  }
                  className="h-10 rounded-xl"
                  onClick={() => setCategoryFilter(category.value)}
                >
                  <Columns3 className="h-4 w-4" />
                  <span>
                    {category.label} ({formatNumber(category.count)})
                  </span>
                </Button>
              ))}

              {hasSearchOrFilter ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl"
                  onClick={clearFilters}
                >
                  {t.clearFilters}
                </Button>
              ) : null}
            </div>

            {filteredReports.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredReports.map((report) => (
                  <Card
                    key={report.id}
                    className="rounded-2xl border bg-background shadow-sm"
                  >
                    <CardContent className="flex h-full flex-col gap-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <ReportIcon type={report.icon} />
                          </div>

                          <div>
                            <p className="font-semibold">
                              {reportTitle(report, locale)}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              {reportDescription(report, locale)}
                            </p>
                          </div>
                        </div>

                        <Badge variant="outline" className="rounded-full px-3 py-1">
                          {categoryLabel(report.category, locale)}
                        </Badge>
                      </div>

                      <div className="mt-auto">
                        <Link href={report.href}>
                          <Button className="h-10 w-full rounded-xl">
                            <FileSpreadsheet className="h-4 w-4" />
                            {t.openReport}
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="rounded-2xl border bg-background shadow-sm">
                <CardContent className="flex min-h-44 flex-col items-center justify-center gap-2 p-6 text-center">
                  <FileBarChart className="h-10 w-10 text-muted-foreground/40" />
                  <p className="font-semibold">{t.emptyTitle}</p>
                  <p className="max-w-md text-sm text-muted-foreground">
                    {t.emptyText}
                  </p>

                  {hasSearchOrFilter ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 rounded-xl"
                      onClick={clearFilters}
                    >
                      {t.clearFilters}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <BarChart3 className="h-4 w-4" />
                {t.summaryTitle}
              </CardTitle>
              <CardDescription>{t.summaryDesc}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2 text-sm">
                <span>{t.postedEntries}</span>
                <span>{formatNumber(summary.posted_entries_count)}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                <span>{t.draftEntries}</span>
                <span>{formatNumber(summary.draft_entries_count)}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                <span>{t.accounts}</span>
                <span>{formatNumber(summary.accounts_count)}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                <span>{t.costCenters}</span>
                <span>{formatNumber(summary.cost_centers_count)}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                <span>{t.fiscalYears}</span>
                <span>{formatNumber(summary.fiscal_years_count)}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm">
                <span>{t.openPeriods}</span>
                <span>{formatNumber(summary.open_periods_count)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Layers3 className="h-4 w-4" />
                {t.reportsTitle}
              </div>

              <div className="text-2xl font-bold">
                {formatNumber(filteredReports.length)}
              </div>

              <p className="text-sm leading-6 text-muted-foreground">
                {categoryLabel(categoryFilter, locale)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}