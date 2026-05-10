"use client";

/* ============================================================
   📂 app/system/page.tsx
   🧠 Primey Care | System Dashboard

   ✅ المرحلة 17 + المرحلة 2
   ✅ نفس النمط المعتمد
   ✅ w-full space-y-4
   ✅ بدون main / min-h-screen / max-w
   ✅ الحفاظ على CRM Dashboard المعتمد
   ✅ إضافة اختصارات للوحدات بعد تنظيف السايدر
   ✅ Excel .xls HTML Workbook
   ✅ Web PDF Print
   ✅ sonner
   ✅ صلاحيات آمنة مع fallback لـ system_admin / superuser
   ✅ بدون localhost hardcoded
   ✅ لا توجد نصوص تقنية ظاهرة في الواجهة
============================================================ */

import Link from "next/link";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BarChart3,
  BellRing,
  Building2,
  Calculator,
  CreditCard,
  Download,
  FileText,
  Home,
  MessageCircle,
  Package,
  Printer,
  ReceiptText,
  RefreshCcw,
  Settings,
  ShoppingCart,
  Stethoscope,
  UserCog,
  Users,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import CustomDateRangePicker from "@/components/custom-date-range-picker";
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

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";
type Dict = Record<string, unknown>;

type ShortcutKey =
  | "customers"
  | "products"
  | "orders"
  | "invoices"
  | "payments"
  | "providers"
  | "centers"
  | "contracts"
  | "agents"
  | "treasury"
  | "accounting"
  | "reports"
  | "notifications"
  | "whatsapp"
  | "users"
  | "settings";

type ShortcutItem = {
  key: ShortcutKey;
  href: string;
  icon: ReactNode;
  permissionCodes: string[];
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  groupAr: string;
  groupEn: string;
};

const PRIMEY_LOCALE_STORAGE_KEY = "primey-locale";

/* ============================================================
   Locale
============================================================ */

function getStoredLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const savedLocale =
      window.localStorage.getItem(PRIMEY_LOCALE_STORAGE_KEY) ||
      window.localStorage.getItem("locale") ||
      window.localStorage.getItem("lang");

    if (savedLocale === "en") return "en";
    if (savedLocale === "ar") return "ar";

    return document.documentElement.lang === "en" ? "en" : "ar";
  } catch (error) {
    console.error("Read locale error:", error);
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

function dictionary(locale: AppLocale) {
  const isArabic = locale === "ar";

  return {
    pageTitle: isArabic ? "لوحة تحكم النظام" : "System Dashboard",
    subtitle: isArabic
      ? "نظرة تشغيلية موحدة على النظام مع اختصارات للوحدات الرئيسية بعد تنظيف السايدر."
      : "A unified operational view with shortcuts to the main modules after sidebar cleanup.",

    refresh: isArabic ? "تحديث" : "Refresh",
    exportExcel: isArabic ? "تصدير Excel" : "Export Excel",
    print: isArabic ? "طباعة PDF" : "Print PDF",

    refreshed: isArabic ? "تم تحديث اللوحة." : "Dashboard refreshed.",
    exportSuccess: isArabic ? "تم تجهيز ملف Excel." : "Excel file prepared.",
    printSuccess: isArabic ? "تم تجهيز نافذة الطباعة." : "Print window prepared.",
    printError: isArabic ? "تعذر فتح نافذة الطباعة." : "Unable to open print window.",

    shortcutsTitle: isArabic ? "اختصارات الوحدات" : "Module Shortcuts",
    shortcutsDesc: isArabic
      ? "الوصول السريع للوحات الوحدات الرئيسية، والصفحات الداخلية أصبحت داخل كل لوحة."
      : "Quick access to main module dashboards; internal pages now live inside each module.",

    analyticsTitle: isArabic ? "مؤشرات النظام" : "System Analytics",
    generatedAt: isArabic ? "تاريخ التصدير" : "Generated At",
    printedAt: isArabic ? "تاريخ الطباعة" : "Printed At",
    open: isArabic ? "فتح" : "Open",

    operations: isArabic ? "العمليات" : "Operations",
    network: isArabic ? "شبكة الخدمة" : "Service Network",
    finance: isArabic ? "المالية" : "Finance",
    communication: isArabic ? "التواصل" : "Communication",
    system: isArabic ? "النظام" : "System",
    reports: isArabic ? "التقارير" : "Reports",

    available: isArabic ? "متاح" : "Available",
  };
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

function hasAnyPermission(authValue: unknown, codes: string[]) {
  if (isSystemAdmin(authValue)) return true;

  const permissions = getAuthPermissionCodes(authValue);

  if (permissions.length > 0) {
    return codes.some((code) => permissions.includes(code));
  }

  const roles = getAuthRoles(authValue);

  if (roles.length > 0) {
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

  return true;
}

/* ============================================================
   Helpers
============================================================ */

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shortcutTitle(item: ShortcutItem, locale: AppLocale) {
  return locale === "ar" ? item.titleAr : item.titleEn;
}

function shortcutDescription(item: ShortcutItem, locale: AppLocale) {
  return locale === "ar" ? item.descriptionAr : item.descriptionEn;
}

function shortcutGroup(item: ShortcutItem, locale: AppLocale) {
  return locale === "ar" ? item.groupAr : item.groupEn;
}

/* ============================================================
   Shortcuts
============================================================ */

function getShortcuts(): ShortcutItem[] {
  return [
    {
      key: "customers",
      href: "/system/customers",
      icon: <Users className="h-5 w-5" />,
      permissionCodes: ["customers.view"],
      titleAr: "العملاء",
      titleEn: "Customers",
      descriptionAr: "لوحة العملاء وقائمة العملاء وإنشاء عميل.",
      descriptionEn: "Customer dashboard, list, and create page.",
      groupAr: "العمليات",
      groupEn: "Operations",
    },
    {
      key: "products",
      href: "/system/products",
      icon: <Package className="h-5 w-5" />,
      permissionCodes: ["products.view"],
      titleAr: "المنتجات والبرامج",
      titleEn: "Products & Programs",
      descriptionAr: "إدارة المنتجات والبرامج والباقات.",
      descriptionEn: "Manage products, programs, and plans.",
      groupAr: "العمليات",
      groupEn: "Operations",
    },
    {
      key: "orders",
      href: "/system/orders",
      icon: <ShoppingCart className="h-5 w-5" />,
      permissionCodes: ["orders.view"],
      titleAr: "الطلبات",
      titleEn: "Orders",
      descriptionAr: "متابعة الطلبات ودورة التنفيذ.",
      descriptionEn: "Track orders and fulfillment lifecycle.",
      groupAr: "العمليات",
      groupEn: "Operations",
    },
    {
      key: "invoices",
      href: "/system/invoices",
      icon: <ReceiptText className="h-5 w-5" />,
      permissionCodes: ["invoices.view"],
      titleAr: "الفواتير",
      titleEn: "Invoices",
      descriptionAr: "لوحة الفواتير والقائمة والإنشاء.",
      descriptionEn: "Invoices dashboard, list, and create page.",
      groupAr: "العمليات",
      groupEn: "Operations",
    },
    {
      key: "payments",
      href: "/system/payments",
      icon: <CreditCard className="h-5 w-5" />,
      permissionCodes: ["payments.view"],
      titleAr: "المدفوعات",
      titleEn: "Payments",
      descriptionAr: "متابعة المدفوعات والتأكيدات.",
      descriptionEn: "Track payments and confirmations.",
      groupAr: "العمليات",
      groupEn: "Operations",
    },
    {
      key: "providers",
      href: "/system/providers",
      icon: <Stethoscope className="h-5 w-5" />,
      permissionCodes: ["providers.view"],
      titleAr: "مقدمو الخدمة",
      titleEn: "Providers",
      descriptionAr: "إدارة مقدمي الخدمة وبياناتهم.",
      descriptionEn: "Manage providers and their profiles.",
      groupAr: "شبكة الخدمة",
      groupEn: "Service Network",
    },
    {
      key: "centers",
      href: "/system/centers",
      icon: <Building2 className="h-5 w-5" />,
      permissionCodes: ["providers.view", "centers.view"],
      titleAr: "المراكز",
      titleEn: "Centers",
      descriptionAr: "إدارة المراكز والفروع التشغيلية.",
      descriptionEn: "Manage centers and operational branches.",
      groupAr: "شبكة الخدمة",
      groupEn: "Service Network",
    },
    {
      key: "contracts",
      href: "/system/contracts",
      icon: <FileText className="h-5 w-5" />,
      permissionCodes: ["contracts.view"],
      titleAr: "العقود",
      titleEn: "Contracts",
      descriptionAr: "إدارة عقود مقدمي الخدمة والخصومات.",
      descriptionEn: "Manage provider contracts and discounts.",
      groupAr: "شبكة الخدمة",
      groupEn: "Service Network",
    },
    {
      key: "agents",
      href: "/system/agents",
      icon: <UserCog className="h-5 w-5" />,
      permissionCodes: ["agents.view"],
      titleAr: "المندوبون",
      titleEn: "Agents",
      descriptionAr: "إدارة المندوبين والعمولات.",
      descriptionEn: "Manage agents and commissions.",
      groupAr: "شبكة الخدمة",
      groupEn: "Service Network",
    },
    {
      key: "treasury",
      href: "/system/treasury",
      icon: <WalletCards className="h-5 w-5" />,
      permissionCodes: ["treasury.view"],
      titleAr: "الخزينة",
      titleEn: "Treasury",
      descriptionAr: "الصناديق والبنوك والحركات المالية.",
      descriptionEn: "Cashboxes, banks, and treasury transactions.",
      groupAr: "المالية",
      groupEn: "Finance",
    },
    {
      key: "accounting",
      href: "/system/accounting",
      icon: <Calculator className="h-5 w-5" />,
      permissionCodes: ["accounting.view"],
      titleAr: "المحاسبة",
      titleEn: "Accounting",
      descriptionAr: "الحسابات والقيود والفترات المالية.",
      descriptionEn: "Accounts, journal entries, and periods.",
      groupAr: "المالية",
      groupEn: "Finance",
    },
    {
      key: "reports",
      href: "/system/reports",
      icon: <BarChart3 className="h-5 w-5" />,
      permissionCodes: ["reports.view"],
      titleAr: "التقارير",
      titleEn: "Reports",
      descriptionAr: "التقارير المركزية لكل الوحدات.",
      descriptionEn: "Central reports for all modules.",
      groupAr: "التقارير",
      groupEn: "Reports",
    },
    {
      key: "notifications",
      href: "/system/notifications",
      icon: <BellRing className="h-5 w-5" />,
      permissionCodes: ["notifications.view", "system.view"],
      titleAr: "الإشعارات",
      titleEn: "Notifications",
      descriptionAr: "الإشعارات والقائمة والإعدادات.",
      descriptionEn: "Notifications, list, and settings.",
      groupAr: "التواصل",
      groupEn: "Communication",
    },
    {
      key: "whatsapp",
      href: "/system/whatsapp",
      icon: <MessageCircle className="h-5 w-5" />,
      permissionCodes: ["whatsapp.view", "system.view"],
      titleAr: "واتساب",
      titleEn: "WhatsApp",
      descriptionAr: "المحادثات والسجلات والقوالب والبث.",
      descriptionEn: "Inbox, logs, templates, and broadcasts.",
      groupAr: "التواصل",
      groupEn: "Communication",
    },
    {
      key: "users",
      href: "/system/users",
      icon: <Users className="h-5 w-5" />,
      permissionCodes: ["users.view"],
      titleAr: "مستخدمو النظام",
      titleEn: "System Users",
      descriptionAr: "إدارة المستخدمين والأدوار والصلاحيات.",
      descriptionEn: "Manage users, roles, and permissions.",
      groupAr: "النظام",
      groupEn: "System",
    },
    {
      key: "settings",
      href: "/system/settings",
      icon: <Settings className="h-5 w-5" />,
      permissionCodes: ["system.settings", "settings.view"],
      titleAr: "الإعدادات",
      titleEn: "Settings",
      descriptionAr: "إعدادات النظام والتكاملات.",
      descriptionEn: "System settings and integrations.",
      groupAr: "النظام",
      groupEn: "System",
    },
  ];
}

/* ============================================================
   Export / Print
============================================================ */

function downloadExcel({
  filename,
  title,
  locale,
  shortcuts,
}: {
  filename: string;
  title: string;
  locale: AppLocale;
  shortcuts: ShortcutItem[];
}) {
  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const align = isArabic ? "right" : "left";
  const t = dictionary(locale);

  const rowsHtml = shortcuts
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(shortcutTitle(item, locale))}</td>
          <td>${escapeHtml(shortcutGroup(item, locale))}</td>
          <td>${escapeHtml(shortcutDescription(item, locale))}</td>
          <td>${escapeHtml(item.href)}</td>
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
          <tr><td class="summary-label">${escapeHtml(t.available)}</td><td colspan="3">${escapeHtml(formatNumber(shortcuts.length))}</td></tr>

          <tr><td colspan="4"></td></tr>
          <tr>
            <th>${escapeHtml(t.shortcutsTitle)}</th>
            <th>${escapeHtml("Group")}</th>
            <th>${escapeHtml("Description")}</th>
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
  shortcuts,
}: {
  locale: AppLocale;
  title: string;
  shortcuts: ShortcutItem[];
}) {
  const isArabic = locale === "ar";
  const t = dictionary(locale);

  const rows = shortcuts
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(shortcutTitle(item, locale))}</td>
          <td>${escapeHtml(shortcutGroup(item, locale))}</td>
          <td>${escapeHtml(shortcutDescription(item, locale))}</td>
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

        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t.shortcutsTitle)}</th>
              <th>${escapeHtml("Group")}</th>
              <th>${escapeHtml("Description")}</th>
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

export default function SystemDashboardPage() {
  const auth = useAuth() as unknown;

  const [locale, setLocale] = useState<AppLocale>(() => getStoredLocale());
  const [refreshKey, setRefreshKey] = useState(0);

  const labels = useMemo(() => dictionary(locale), [locale]);
  const isArabic = locale === "ar";

  const shortcuts = useMemo(
    () =>
      getShortcuts().filter((item) =>
        hasAnyPermission(auth, item.permissionCodes),
      ),
    [auth],
  );

  const groupedShortcuts = useMemo(() => {
    const groups = [
      labels.operations,
      labels.network,
      labels.finance,
      labels.reports,
      labels.communication,
      labels.system,
    ];

    return groups
      .map((group) => ({
        group,
        items: shortcuts.filter((item) => shortcutGroup(item, locale) === group),
      }))
      .filter((group) => group.items.length > 0);
  }, [labels.communication, labels.finance, labels.network, labels.operations, labels.reports, labels.system, locale, shortcuts]);

  function refreshDashboard() {
    setRefreshKey((current) => current + 1);
    toast.success(labels.refreshed);
  }

  function exportExcel() {
    downloadExcel({
      filename: `primey-care-system-dashboard-${new Date().toISOString().slice(0, 10)}.xls`,
      title: labels.pageTitle,
      locale,
      shortcuts,
    });

    toast.success(labels.exportSuccess);
  }

  function printPage() {
    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      toast.error(labels.printError);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintHtml({
        locale,
        title: labels.pageTitle,
        shortcuts,
      }),
    );
    printWindow.document.close();

    toast.success(labels.printSuccess);
  }

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = getStoredLocale();

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

  return (
    <div className="w-full space-y-4" dir="ltr">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className={isArabic ? "text-right" : "text-left"} dir={isArabic ? "rtl" : "ltr"}>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {labels.pageTitle}
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {labels.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <CustomDateRangePicker key={refreshKey} />

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={refreshDashboard}
          >
            <RefreshCcw className="h-4 w-4" />
            <span>{labels.refresh}</span>
          </Button>

          <Button className="h-10 rounded-xl" onClick={exportExcel}>
            <Download className="h-4 w-4" />
            <span>{labels.exportExcel}</span>
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={printPage}
          >
            <Printer className="h-4 w-4" />
            <span>{labels.print}</span>
          </Button>
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

      <Card className="rounded-2xl border bg-card shadow-sm" dir={isArabic ? "rtl" : "ltr"}>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base font-bold">
                {labels.shortcutsTitle}
              </CardTitle>
              <CardDescription>{labels.shortcutsDesc}</CardDescription>
            </div>

            <Badge variant="outline" className="w-fit rounded-full">
              <Home className="h-3.5 w-3.5" />
              {formatNumber(shortcuts.length)} {labels.available}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {groupedShortcuts.map((group) => (
            <div key={group.group} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <p className="text-sm font-bold">{group.group}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {group.items.map((item) => (
                  <ShortcutCard
                    key={item.key}
                    href={item.href}
                    icon={item.icon}
                    title={shortcutTitle(item, locale)}
                    description={shortcutDescription(item, locale)}
                    openLabel={labels.open}
                  />
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================================================
   Small Components
============================================================ */

function ShortcutCard({
  href,
  icon,
  title,
  description,
  openLabel,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  openLabel: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full rounded-2xl border bg-background/70 shadow-sm transition hover:bg-muted/40">
        <CardContent className="flex h-full flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {icon}
            </div>

            <Badge variant="outline" className="rounded-full">
              {openLabel}
            </Badge>
          </div>

          <div>
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}