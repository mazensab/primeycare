"use client";

/* ============================================================
   📂 app/system/settings/page.tsx
   🧠 Primey Care | System Settings Overview

   ✅ المرحلة 17 + المرحلة 2
   ✅ نفس النمط المعتمد
   ✅ w-full space-y-4
   ✅ بدون main / min-h-screen / max-w
   ✅ أزرار انتقال لإعدادات النظام المهمة
   ✅ Skeleton Loading
   ✅ Error State مستقل
   ✅ Empty State ذكي
   ✅ Excel .xls HTML Workbook
   ✅ Web PDF Print
   ✅ sonner
   ✅ صلاحيات آمنة مع fallback لـ system_admin / superuser
============================================================ */

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  CreditCard,
  Download,
  FileText,
  Landmark,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Printer,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
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

type SettingKey =
  | "users"
  | "usersCreate"
  | "notifications"
  | "whatsapp"
  | "treasury"
  | "paymentGateways";

type SettingCard = {
  key: SettingKey;
  href: string;
  icon: ReactNode;
  permissionCodes: string[];
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  badgeAr: string;
  badgeEn: string;
};

type SettingsSummary = {
  total_sections: number;
  available_sections: number;
  security_sections: number;
  finance_sections: number;
  communication_sections: number;
  users_sections: number;
};

type ApiEnvelope<T> = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  detail?: string;
  error?: string;
  data?: T;
};

const DEFAULT_SUMMARY: SettingsSummary = {
  total_sections: 0,
  available_sections: 0,
  security_sections: 0,
  finance_sections: 0,
  communication_sections: 0,
  users_sections: 0,
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

    if (value && typeof value === "object") return value as Dict;
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

function hasAnyPermission(
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
      ["system_admin", "superuser", "super_admin", "support"].includes(role),
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
    title: isArabic ? "إعدادات النظام" : "System Settings",
    subtitle: isArabic
      ? "لوحة موحدة لإدارة المستخدمين والصلاحيات والتنبيهات وواتساب والخزينة وبوابات الدفع."
      : "A unified hub for users, permissions, notifications, WhatsApp, treasury, and payment gateway settings.",

    refresh: isArabic ? "تحديث" : "Refresh",
    retry: isArabic ? "إعادة المحاولة" : "Retry",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    totalSections: isArabic ? "إجمالي الأقسام" : "Total Sections",
    availableSections: isArabic ? "الأقسام المتاحة" : "Available Sections",
    securitySections: isArabic ? "الأمان والصلاحيات" : "Security",
    financeSections: isArabic ? "الإعدادات المالية" : "Finance",
    communicationSections: isArabic ? "الاتصال والتنبيهات" : "Communication",
    usersSections: isArabic ? "المستخدمون" : "Users",

    searchPlaceholder: isArabic
      ? "ابحث في إعدادات النظام..."
      : "Search system settings...",

    settingsTitle: isArabic ? "اختصارات الإعدادات" : "Settings Shortcuts",
    settingsDesc: isArabic
      ? "اختر القسم المطلوب لإدارة إعداداته."
      : "Choose the section you want to configure.",

    openSettings: isArabic ? "فتح الإعداد" : "Open Settings",
    available: isArabic ? "متاح" : "Available",

    noSettingsTitle: isArabic ? "لا توجد إعدادات مطابقة" : "No matching settings",
    noSettingsText: isArabic
      ? "جرّب تغيير كلمات البحث أو راجع الصلاحيات."
      : "Try changing your search terms or review permissions.",

    accessDeniedTitle: isArabic
      ? "غير مصرح بعرض إعدادات النظام"
      : "Access denied",
    accessDeniedText: isArabic
      ? "لا تملك صلاحية عرض إعدادات النظام. تواصل مع مسؤول النظام إذا كنت تحتاج الوصول."
      : "You do not have permission to view system settings. Contact your system administrator if you need access.",

    loadError: isArabic
      ? "تعذر تحديث ملخص الإعدادات."
      : "Unable to refresh settings summary.",
    loadErrorHint: isArabic
      ? "يمكنك الاستمرار بفتح أقسام الإعدادات المتاحة أو إعادة المحاولة."
      : "You can still open available settings sections or retry.",
    loadSuccess: isArabic
      ? "تم تحديث ملخص الإعدادات."
      : "Settings summary refreshed.",

    exportSuccess: isArabic ? "تم تجهيز ملف Excel." : "Excel file prepared.",
    exportEmpty: isArabic
      ? "لا توجد بيانات قابلة للتصدير."
      : "No data available to export.",
    printSuccess: isArabic ? "تم تجهيز نافذة الطباعة." : "Print window prepared.",
    printError: isArabic
      ? "تعذر فتح نافذة الطباعة."
      : "Unable to open print window.",

    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
  };
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

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function settingTitle(setting: SettingCard, locale: AppLocale) {
  return locale === "ar" ? setting.titleAr : setting.titleEn;
}

function settingDescription(setting: SettingCard, locale: AppLocale) {
  return locale === "ar" ? setting.descriptionAr : setting.descriptionEn;
}

function settingBadge(setting: SettingCard, locale: AppLocale) {
  return locale === "ar" ? setting.badgeAr : setting.badgeEn;
}

function buildSummary(settings: SettingCard[]): SettingsSummary {
  return {
    total_sections: settings.length,
    available_sections: settings.length,
    security_sections: settings.filter((item) =>
      ["users", "usersCreate"].includes(item.key),
    ).length,
    finance_sections: settings.filter((item) =>
      ["treasury", "paymentGateways"].includes(item.key),
    ).length,
    communication_sections: settings.filter((item) =>
      ["notifications", "whatsapp"].includes(item.key),
    ).length,
    users_sections: settings.filter((item) =>
      ["users", "usersCreate"].includes(item.key),
    ).length,
  };
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

function PageSkeleton() {
  return (
    <div className="space-y-4">
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

      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonLine key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================================================
   Export / Print
============================================================ */

function downloadExcel({
  filename,
  title,
  locale,
  summary,
  settings,
}: {
  filename: string;
  title: string;
  locale: AppLocale;
  summary: SettingsSummary;
  settings: SettingCard[];
}) {
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";
  const t = dictionary(locale);

  const rowsHtml = settings
    .map(
      (setting) => `
        <tr>
          <td>${escapeHtml(settingTitle(setting, locale))}</td>
          <td>${escapeHtml(settingDescription(setting, locale))}</td>
          <td>${escapeHtml(settingBadge(setting, locale))}</td>
          <td>${escapeHtml(setting.href)}</td>
        </tr>`,
    )
    .join("");

  const workbook = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
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
          th { background: #d8ecfb; font-weight: 700; }
          .title { font-size: 20px; font-weight: 700; text-align: center; background: #fff; }
          .section { font-weight: 700; background: #eef6ff; }
          .summary-label { font-weight: 700; background: #f8fafc; width: 240px; }
        </style>
      </head>
      <body dir="${dir}">
        <table>
          <tr><td class="title" colspan="4">${escapeHtml(title)}</td></tr>
          <tr><td colspan="4"></td></tr>
          <tr><td class="section" colspan="4">${escapeHtml(t.generatedAt)}: ${escapeHtml(new Date().toLocaleString("en-US"))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.totalSections)}</td><td colspan="3">${escapeHtml(formatNumber(summary.total_sections))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.availableSections)}</td><td colspan="3">${escapeHtml(formatNumber(summary.available_sections))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.securitySections)}</td><td colspan="3">${escapeHtml(formatNumber(summary.security_sections))}</td></tr>
          <tr><td class="summary-label">${escapeHtml(t.financeSections)}</td><td colspan="3">${escapeHtml(formatNumber(summary.finance_sections))}</td></tr>

          <tr><td colspan="4"></td></tr>
          <tr>
            <th>${escapeHtml(t.settingsTitle)}</th>
            <th>${escapeHtml("Description")}</th>
            <th>${escapeHtml("Category")}</th>
            <th>${escapeHtml("Page")}</th>
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
  settings,
}: {
  locale: AppLocale;
  title: string;
  summary: SettingsSummary;
  settings: SettingCard[];
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);

  const rows = settings
    .map(
      (setting) => `
        <tr>
          <td>${escapeHtml(settingTitle(setting, locale))}</td>
          <td>${escapeHtml(settingDescription(setting, locale))}</td>
          <td>${escapeHtml(settingBadge(setting, locale))}</td>
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
          .header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 14px;
            margin-bottom: 18px;
          }
          h1 { margin: 0; font-size: 22px; font-weight: 800; }
          .meta { margin-top: 8px; color: #6b7280; font-size: 12px; }
          .badge {
            border: 1px solid #d1d5db;
            border-radius: 999px;
            padding: 5px 12px;
            font-size: 12px;
            height: fit-content;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 18px;
          }
          .box {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 10px;
          }
          .box span { color: #6b7280; display: block; font-size: 11px; }
          .box strong { display: block; margin-top: 6px; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
          th { background: #f3f4f6; font-weight: 700; }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 8px;
            text-align: ${isArabic ? "right" : "left"};
          }
          @page { size: A4 landscape; margin: 12mm; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">${escapeHtml(t.printedAt)}: ${escapeHtml(new Date().toLocaleString("en-US"))}</div>
          </div>
          <div class="badge">Primey Care</div>
        </div>

        <div class="grid">
          <div class="box"><span>${escapeHtml(t.totalSections)}</span><strong>${escapeHtml(formatNumber(summary.total_sections))}</strong></div>
          <div class="box"><span>${escapeHtml(t.availableSections)}</span><strong>${escapeHtml(formatNumber(summary.available_sections))}</strong></div>
          <div class="box"><span>${escapeHtml(t.securitySections)}</span><strong>${escapeHtml(formatNumber(summary.security_sections))}</strong></div>
          <div class="box"><span>${escapeHtml(t.financeSections)}</span><strong>${escapeHtml(formatNumber(summary.finance_sections))}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t.settingsTitle)}</th>
              <th>${escapeHtml("Description")}</th>
              <th>${escapeHtml("Category")}</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="3">${escapeHtml(t.noSettingsTitle)}</td></tr>`}</tbody>
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
   Settings Cards
============================================================ */

function getSettingCards(): SettingCard[] {
  return [
    {
      key: "users",
      href: "/system/users",
      icon: <Users className="h-5 w-5" />,
      permissionCodes: ["settings.view", "users.view", "users.list"],
      titleAr: "إدارة المستخدمين",
      titleEn: "User Management",
      descriptionAr: "إدارة المستخدمين والأدوار والصلاحيات وحالة التفعيل.",
      descriptionEn: "Manage users, roles, permissions, and activation status.",
      badgeAr: "الأمان",
      badgeEn: "Security",
    },
    {
      key: "usersCreate",
      href: "/system/users/create",
      icon: <UserCog className="h-5 w-5" />,
      permissionCodes: ["settings.view", "users.create"],
      titleAr: "إنشاء مستخدم",
      titleEn: "Create User",
      descriptionAr: "إضافة مستخدم جديد وربطه بالدور والمساحة المناسبة.",
      descriptionEn: "Add a new user and link them to the proper role and workspace.",
      badgeAr: "المستخدمون",
      badgeEn: "Users",
    },
    {
      key: "notifications",
      href: "/system/notifications/settings",
      icon: <Bell className="h-5 w-5" />,
      permissionCodes: [
        "settings.view",
        "notifications.view",
        "notifications.settings",
        "notifications.settings.view",
      ],
      titleAr: "إعدادات الإشعارات",
      titleEn: "Notification Settings",
      descriptionAr: "ضبط قنوات الإشعار والتنبيهات الداخلية للمستخدمين.",
      descriptionEn: "Configure notification channels and internal alerts.",
      badgeAr: "التنبيهات",
      badgeEn: "Notifications",
    },
    {
      key: "whatsapp",
      href: "/system/whatsapp/settings",
      icon: <MessageCircle className="h-5 w-5" />,
      permissionCodes: [
        "settings.view",
        "whatsapp.view",
        "whatsapp.settings",
        "whatsapp.settings.view",
      ],
      titleAr: "إعدادات واتساب",
      titleEn: "WhatsApp Settings",
      descriptionAr: "إدارة إعدادات واتساب والقوالب والربط التشغيلي.",
      descriptionEn: "Manage WhatsApp configuration, templates, and operational linking.",
      badgeAr: "الاتصال",
      badgeEn: "Communication",
    },
    {
      key: "treasury",
      href: "/system/treasury/settings",
      icon: <Landmark className="h-5 w-5" />,
      permissionCodes: [
        "settings.view",
        "treasury.view",
        "treasury.settings",
        "treasury.settings.view",
      ],
      titleAr: "إعدادات الخزينة",
      titleEn: "Treasury Settings",
      descriptionAr: "ضبط إعدادات الصناديق والبنوك والحركات المالية.",
      descriptionEn: "Configure cashboxes, banks, and treasury movements.",
      badgeAr: "المالية",
      badgeEn: "Finance",
    },
    {
      key: "paymentGateways",
      href: "/system/payment-gateways",
      icon: <CreditCard className="h-5 w-5" />,
      permissionCodes: [
        "settings.view",
        "payment_gateways.view",
        "payment_gateways.settings",
        "payments.view",
      ],
      titleAr: "بوابات الدفع",
      titleEn: "Payment Gateways",
      descriptionAr: "إدارة بوابات الدفع والربط مع مزودي الدفع الإلكتروني.",
      descriptionEn: "Manage payment gateways and electronic payment providers.",
      badgeAr: "الدفع",
      badgeEn: "Payments",
    },
  ];
}

/* ============================================================
   Page
============================================================ */

export default function SystemSettingsPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>("ar");
  const [summary, setSummary] = useState<SettingsSummary>(DEFAULT_SUMMARY);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const t = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";
  const authResolving = isAuthResolving(auth);

  const canView = hasAnyPermission(
    auth,
    ["settings.view", "users.view", "notifications.view", "whatsapp.view"],
    "view",
  );

  const canExport = hasAnyPermission(
    auth,
    ["settings.export", "reports.export"],
    "action",
  );

  const canPrint = hasAnyPermission(
    auth,
    ["settings.print", "reports.print"],
    "action",
  );

  const allSettings = useMemo(() => getSettingCards(), []);

  const permittedSettings = useMemo(
    () =>
      allSettings.filter((setting) =>
        hasAnyPermission(auth, setting.permissionCodes, "view"),
      ),
    [allSettings, auth],
  );

  const filteredSettings = useMemo(() => {
    const clean = query.trim().toLowerCase();

    if (!clean) return permittedSettings;

    return permittedSettings.filter((setting) =>
      [
        setting.titleAr,
        setting.titleEn,
        setting.descriptionAr,
        setting.descriptionEn,
        setting.badgeAr,
        setting.badgeEn,
        setting.key,
      ]
        .join(" ")
        .toLowerCase()
        .includes(clean),
    );
  }, [permittedSettings, query]);

  const hasSettings = filteredSettings.length > 0;

  const loadSettings = useCallback(
    async (showToast = false) => {
      if (!canView) {
        setSummary(DEFAULT_SUMMARY);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        await fetch(apiUrl("/api/auth/whoami/"), {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        }).catch(() => null);

        setSummary(buildSummary(permittedSettings));

        if (showToast) toast.success(t.loadSuccess);
      } catch (error) {
        console.error("Settings overview load error:", error);
        setSummary(buildSummary(permittedSettings));
        setErrorMessage(t.loadError);
        toast.error(t.loadError);
      } finally {
        setIsLoading(false);
      }
    },
    [canView, permittedSettings, t.loadError, t.loadSuccess],
  );

  function exportExcel() {
    if (!canExport) return;

    if (filteredSettings.length === 0) {
      toast.error(t.exportEmpty);
      return;
    }

    downloadExcel({
      filename: `primey-care-settings-${new Date().toISOString().slice(0, 10)}.xls`,
      title: t.title,
      locale,
      summary,
      settings: filteredSettings,
    });

    toast.success(t.exportSuccess);
  }

  function printPage() {
    if (!canPrint) return;

    if (filteredSettings.length === 0) {
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
        settings: filteredSettings,
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
    loadSettings(false);
  }, [authResolving, loadSettings]);

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
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => loadSettings(true)}
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
              disabled={isLoading || !hasSettings}
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
              disabled={isLoading || !hasSettings}
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
                <p className="font-semibold text-destructive">{errorMessage}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.loadErrorHint}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => loadSettings(true)}
            >
              <RefreshCcw className="h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title={t.totalSections}
              value={formatNumber(summary.total_sections)}
              icon={<Settings className="h-5 w-5" />}
            />
            <KpiCard
              title={t.availableSections}
              value={formatNumber(summary.available_sections)}
              icon={<SlidersHorizontal className="h-5 w-5" />}
            />
            <KpiCard
              title={t.securitySections}
              value={formatNumber(summary.security_sections)}
              icon={<LockKeyhole className="h-5 w-5" />}
            />
            <KpiCard
              title={t.financeSections}
              value={formatNumber(summary.finance_sections)}
              icon={<WalletCards className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MiniStat title={t.communicationSections} value={summary.communication_sections} />
            <MiniStat title={t.usersSections} value={summary.users_sections} />
            <MiniStat title={t.securitySections} value={summary.security_sections} />
            <MiniStat title={t.financeSections} value={summary.finance_sections} />
          </div>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardContent className="p-4">
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
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold">
                    {t.settingsTitle}
                  </CardTitle>
                  <CardDescription>{t.settingsDesc}</CardDescription>
                </div>

                <Badge variant="outline" className="rounded-full">
                  <FileText className="h-3.5 w-3.5" />
                  {formatNumber(filteredSettings.length)} {t.available}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              {filteredSettings.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredSettings.map((setting) => (
                    <Link key={setting.key} href={setting.href}>
                      <Card className="h-full rounded-2xl border bg-background/70 shadow-sm transition hover:bg-muted/40">
                        <CardContent className="flex h-full flex-col gap-4 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                              {setting.icon}
                            </div>

                            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">
                                {settingTitle(setting, locale)}
                              </p>
                              <Badge variant="outline" className="rounded-full">
                                {settingBadge(setting, locale)}
                              </Badge>
                            </div>

                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {settingDescription(setting, locale)}
                            </p>
                          </div>

                          <div className="mt-auto flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2 text-sm">
                            <span className="text-muted-foreground">
                              {t.openSettings}
                            </span>
                            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                  <Settings className="h-12 w-12 text-muted-foreground/40" />
                  <p className="text-lg font-semibold">{t.noSettingsTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.noSettingsText}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/* ============================================================
   Small Components
============================================================ */

function KpiCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: ReactNode;
  icon: ReactNode;
}) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <p className="mt-1 text-sm text-muted-foreground">{title}</p>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ title, value }: { title: string; value: number }) {
  return (
    <Card className="rounded-2xl border bg-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{title}</span>
          <span className="text-lg font-bold">{formatNumber(value)}</span>
        </div>
      </CardContent>
    </Card>
  );
}