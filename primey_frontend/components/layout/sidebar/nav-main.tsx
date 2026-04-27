"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

import {
  ChevronLeft,
  ChevronRight,
  Home,
  Building2,
  CreditCard,
  FileText,
  Package,
  Settings,
  Users,
  Wallet,
  UserCog,
  BarChart3,
  MessageCircle,
  Send,
  Boxes,
  ShoppingCart,
  Briefcase,
  ShieldCheck,
  ReceiptText,
  Plus,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/* =====================================================
   TYPES
===================================================== */

type AppLocale = "ar" | "en";

type WorkspaceType = "system" | "company" | "center" | "customer";

type NavItem = {
  title: {
    ar: string;
    en: string;
  };
  href: string;
  aliases?: string[];
  icon?: LucideIcon;
  items?: NavItem[];
  newTab?: boolean;
  isNew?: boolean;
  isComing?: boolean;
  isDataBadge?: string;
  roles?: string[];
  apps?: string[];
};

type NavGroup = {
  title: {
    ar: string;
    en: string;
  };
  items: NavItem[];
};

type NavMainProps = {
  type: WorkspaceType;
};

/* =====================================================
   SYSTEM NAV — PRIMEY CARE
===================================================== */

const systemNavItems: NavGroup[] = [
  {
    title: {
      ar: "لوحات النظام",
      en: "System Workspace",
    },
    items: [
      {
        title: { ar: "الرئيسية", en: "Home" },
        href: "/system",
        icon: Home,
      },
      {
        title: { ar: "المراكز", en: "Centers" },
        href: "/system/centers",
        icon: Building2,
        items: [
          {
            title: { ar: "لوحة المراكز", en: "Centers Overview" },
            href: "/system/centers",
            icon: Building2,
          },
          {
            title: { ar: "قائمة المراكز", en: "Centers List" },
            href: "/system/centers/list",
            icon: ListChecks,
          },
          {
            title: { ar: "إنشاء مركز", en: "Create Center" },
            href: "/system/centers/create",
            icon: Plus,
          },
          {
            title: { ar: "تقارير المراكز", en: "Centers Reports" },
            href: "/system/centers/reports",
            icon: BarChart3,
          },
        ],
      },
      {
        title: { ar: "العملاء", en: "Customers" },
        href: "/system/customers",
        icon: Users,
        items: [
          {
            title: { ar: "لوحة العملاء", en: "Customers Overview" },
            href: "/system/customers",
            icon: Users,
          },
          {
            title: { ar: "قائمة العملاء", en: "Customers List" },
            href: "/system/customers/list",
            icon: ListChecks,
          },
          {
            title: { ar: "إنشاء عميل", en: "Create Customer" },
            href: "/system/customers/create",
            icon: Plus,
          },
          {
            title: { ar: "تقارير العملاء", en: "Customers Reports" },
            href: "/system/customers/reports",
            icon: BarChart3,
          },
        ],
      },
      {
        title: { ar: "المندوبون", en: "Agents" },
        href: "/system/agents",
        icon: Briefcase,
        items: [
          {
            title: { ar: "لوحة المندوبين", en: "Agents Overview" },
            href: "/system/agents",
            icon: Briefcase,
          },
          {
            title: { ar: "قائمة المندوبين", en: "Agents List" },
            href: "/system/agents/list",
            icon: ListChecks,
          },
          {
            title: { ar: "إنشاء مندوب", en: "Create Agent" },
            href: "/system/agents/create",
            icon: Plus,
          },
          {
            title: { ar: "تقارير المندوبين", en: "Agents Reports" },
            href: "/system/agents/reports",
            icon: BarChart3,
          },
        ],
      },
      {
        title: { ar: "المنتجات", en: "Products" },
        href: "/system/products",
        icon: Boxes,
      },
      {
        title: { ar: "الطلبات", en: "Orders" },
        href: "/system/orders",
        icon: ShoppingCart,
      },
      {
        title: { ar: "مقدمو الخدمة", en: "Providers" },
        href: "/system/providers",
        icon: Building2,
      },
      {
        title: { ar: "العقود", en: "Contracts" },
        href: "/system/contracts",
        icon: FileText,
      },
      {
        title: { ar: "المدفوعات", en: "Payments" },
        href: "/system/payments",
        icon: CreditCard,
      },
      {
        title: { ar: "الفواتير", en: "Invoices" },
        href: "/system/invoices",
        icon: ReceiptText,
      },
      {
        title: { ar: "المحاسبة", en: "Accounting" },
        href: "/system/accounting",
        icon: BarChart3,
      },
      {
        title: { ar: "الخزينة", en: "Treasury" },
        href: "/system/treasury",
        icon: Wallet,
      },
      {
        title: { ar: "واتساب", en: "WhatsApp" },
        href: "/system/whatsapp",
        icon: MessageCircle,
        items: [
          {
            title: { ar: "الرئيسية", en: "Overview" },
            href: "/system/whatsapp",
          },
          {
            title: { ar: "الإعدادات", en: "Settings" },
            href: "/system/whatsapp/settings",
          },
          {
            title: { ar: "السجل", en: "Logs" },
            href: "/system/whatsapp/logs",
          },
          {
            title: { ar: "القوالب", en: "Templates" },
            href: "/system/whatsapp/templates",
          },
          {
            title: { ar: "البث الجماعي", en: "Broadcasts" },
            href: "/system/whatsapp/broadcasts",
          },
        ],
      },
      {
        title: { ar: "مستخدمو النظام", en: "System Users" },
        href: "/system/users",
        icon: UserCog,
      },
      {
        title: { ar: "الإعدادات", en: "Settings" },
        href: "/system/settings",
        icon: Settings,
      },
    ],
  },
];

/* =====================================================
   CENTER NAV
   - المسار التشغيلي الحالي: /company
   - المسار المعماري المستهدف: /center
   - نبقي company كتوافق خلفي مؤقت
===================================================== */

const centerNavItems: NavGroup[] = [
  {
    title: {
      ar: "لوحة المركز",
      en: "Center Workspace",
    },
    items: [
      {
        title: { ar: "الرئيسية", en: "Home" },
        href: "/company",
        aliases: ["/center"],
        icon: Home,
      },
      {
        title: { ar: "العملاء", en: "Customers" },
        href: "/company/customers",
        aliases: ["/center/customers"],
        icon: Users,
      },
      {
        title: { ar: "الطلبات", en: "Orders" },
        href: "/company/orders",
        aliases: ["/center/orders"],
        icon: ShoppingCart,
      },
      {
        title: { ar: "المنتجات", en: "Products" },
        href: "/company/products",
        aliases: ["/center/products"],
        icon: Boxes,
      },
      {
        title: { ar: "العقود", en: "Contracts" },
        href: "/company/contracts",
        aliases: ["/center/contracts"],
        icon: FileText,
      },
      {
        title: { ar: "المدفوعات", en: "Payments" },
        href: "/company/payments",
        aliases: ["/center/payments"],
        icon: CreditCard,
      },
      {
        title: { ar: "الفواتير", en: "Invoices" },
        href: "/company/invoices",
        aliases: ["/center/invoices"],
        icon: ReceiptText,
      },
      {
        title: { ar: "المحاسبة", en: "Accounting" },
        href: "/company/accounting",
        aliases: ["/center/accounting"],
        icon: BarChart3,
      },
      {
        title: { ar: "الخزينة", en: "Treasury" },
        href: "/company/treasury",
        aliases: ["/center/treasury"],
        icon: Wallet,
      },
      {
        title: { ar: "واتساب", en: "WhatsApp" },
        href: "/company/whatsapp",
        aliases: ["/center/whatsapp"],
        icon: Send,
        roles: ["owner", "admin", "manager"],
        items: [
          {
            title: { ar: "الرئيسية", en: "Overview" },
            href: "/company/whatsapp",
            aliases: ["/center/whatsapp"],
          },
          {
            title: { ar: "الإعدادات", en: "Settings" },
            href: "/company/whatsapp/settings",
            aliases: ["/center/whatsapp/settings"],
          },
          {
            title: { ar: "السجل", en: "Logs" },
            href: "/company/whatsapp/logs",
            aliases: ["/center/whatsapp/logs"],
          },
          {
            title: { ar: "القوالب", en: "Templates" },
            href: "/company/whatsapp/templates",
            aliases: ["/center/whatsapp/templates"],
          },
        ],
      },
      {
        title: { ar: "المستخدمون", en: "Users" },
        href: "/company/users",
        aliases: ["/center/users"],
        icon: UserCog,
        roles: ["owner", "admin"],
      },
      {
        title: { ar: "الإعدادات", en: "Settings" },
        href: "/company/settings",
        aliases: ["/center/settings"],
        icon: Settings,
        roles: ["owner", "admin"],
      },
    ],
  },
];

/* =====================================================
   CUSTOMER NAV
===================================================== */

const customerNavItems: NavGroup[] = [
  {
    title: {
      ar: "مساحة العميل",
      en: "Customer Workspace",
    },
    items: [
      {
        title: { ar: "الرئيسية", en: "Home" },
        href: "/customer",
        icon: Home,
      },
      {
        title: { ar: "طلباتي", en: "My Orders" },
        href: "/customer/orders",
        icon: ShoppingCart,
      },
      {
        title: { ar: "فواتيري", en: "My Invoices" },
        href: "/customer/invoices",
        icon: ReceiptText,
      },
      {
        title: { ar: "مدفوعاتي", en: "My Payments" },
        href: "/customer/payments",
        icon: CreditCard,
      },
      {
        title: { ar: "الباقات والخدمات", en: "Plans & Services" },
        href: "/customer/products",
        icon: Package,
      },
      {
        title: { ar: "الدعم والمحادثات", en: "Support & Chats" },
        href: "/customer/support",
        icon: MessageCircle,
      },
      {
        title: { ar: "حسابي", en: "My Account" },
        href: "/customer/account",
        icon: ShieldCheck,
      },
      {
        title: { ar: "الإعدادات", en: "Settings" },
        href: "/customer/settings",
        icon: Settings,
      },
    ],
  },
];

/* =====================================================
   HELPERS
===================================================== */

function normalizePath(path: string) {
  if (path === "/center") return "/company";

  if (path.startsWith("/center/")) {
    return path.replace("/center", "/company");
  }

  return path;
}

function matchesHref(pathname: string, href: string) {
  const normalizedPathname = normalizePath(pathname);
  const normalizedHref = normalizePath(href);
  const rootRoutes = ["/system", "/company", "/customer"];

  if (rootRoutes.includes(normalizedHref)) {
    return normalizedPathname === normalizedHref;
  }

  return (
    normalizedPathname === normalizedHref ||
    normalizedPathname.startsWith(`${normalizedHref}/`)
  );
}

function isItemActive(pathname: string, item: NavItem) {
  if (matchesHref(pathname, item.href)) {
    return true;
  }

  return (item.aliases || []).some((alias) => matchesHref(pathname, alias));
}

function hasRequiredRole(itemRoles: string[] | undefined, currentRole: string) {
  if (!itemRoles || itemRoles.length === 0) return true;
  if (!currentRole) return false;

  return itemRoles.includes(currentRole);
}

function hasRequiredApps(itemApps: string[] | undefined, enabledApps: string[]) {
  if (!itemApps || itemApps.length === 0) return true;

  return itemApps.some((app) => enabledApps.includes(app));
}

function getStoredLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const savedLocale = window.localStorage.getItem("primey-locale");
    if (savedLocale === "en") return "en";
    if (savedLocale === "ar") return "ar";

    const htmlLang = document.documentElement.lang;
    return htmlLang === "en" ? "en" : "ar";
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

function filterNavItems(
  items: NavItem[],
  currentRole: string,
  enabledApps: string[],
): NavItem[] {
  return items
    .filter((item) => {
      const roleAllowed = hasRequiredRole(item.roles, currentRole);
      const appAllowed = hasRequiredApps(item.apps, enabledApps);

      return roleAllowed && appAllowed;
    })
    .map((item) => ({
      ...item,
      items: item.items
        ? filterNavItems(item.items, currentRole, enabledApps)
        : undefined,
    }));
}

function filterNavGroups(
  groups: NavGroup[],
  currentRole: string,
  enabledApps: string[],
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: filterNavItems(group.items, currentRole, enabledApps),
    }))
    .filter((group) => group.items.length > 0);
}

function hasActiveChild(pathname: string, item: NavItem) {
  return Boolean(
    item.items?.some((subItem) => {
      if (isItemActive(pathname, subItem)) return true;

      return hasActiveChild(pathname, subItem);
    }),
  );
}

/* =====================================================
   COMPONENT
===================================================== */

export function NavMain({ type }: NavMainProps) {
  const pathname = usePathname();
  const session = useAuth();

  const [locale, setLocale] = useState<AppLocale>("ar");

  const currentRole = String(session?.role || "").toLowerCase();
  const enabledApps = Array.isArray(session?.subscription?.apps)
    ? session.subscription.apps.map((app: string) => String(app).toLowerCase())
    : [];

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = getStoredLocale();

      applyDocumentLocale(nextLocale);
      setLocale(nextLocale);
    };

    const syncLocaleAfterPaint = () => {
      syncLocale();

      window.setTimeout(() => {
        syncLocale();
      }, 0);
    };

    syncLocaleAfterPaint();

    window.addEventListener("primey-locale-changed", syncLocaleAfterPaint);
    window.addEventListener("storage", syncLocaleAfterPaint);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocaleAfterPaint);
      window.removeEventListener("storage", syncLocaleAfterPaint);
    };
  }, []);

  const isArabic = locale === "ar";
  const ChevronIcon = isArabic ? ChevronLeft : ChevronRight;

  const navItems = useMemo(() => {
    if (type === "system") {
      return systemNavItems;
    }

    if (type === "customer") {
      return customerNavItems;
    }

    return filterNavGroups(centerNavItems, currentRole, enabledApps);
  }, [type, currentRole, enabledApps]);

  return (
    <>
      {navItems.map((nav) => (
        <SidebarGroup key={nav.title.en}>
          <SidebarGroupLabel>
            {isArabic ? nav.title.ar : nav.title.en}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {nav.items.map((item) => {
                const Icon = item.icon;
                const itemTitle = isArabic ? item.title.ar : item.title.en;
                const activeParent =
                  isItemActive(pathname, item) || hasActiveChild(pathname, item);

                if (item.items?.length) {
                  return (
                    <SidebarMenuItem key={item.title.en}>
                      <Collapsible defaultOpen={activeParent}>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip={itemTitle}
                            isActive={activeParent}
                          >
                            <div
                              className={`flex w-full items-center gap-2 ${
                                isArabic
                                  ? "flex-row-reverse text-right"
                                  : "flex-row text-left"
                              }`}
                            >
                              {Icon ? <Icon className="shrink-0" /> : null}

                              <span className="flex-1 truncate">
                                {itemTitle}
                              </span>

                              {item.isNew ? (
                                <SidebarMenuBadge>
                                  {isArabic ? "جديد" : "New"}
                                </SidebarMenuBadge>
                              ) : null}

                              <ChevronIcon className="h-4 w-4 shrink-0" />
                            </div>
                          </SidebarMenuButton>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((subItem) => {
                              const SubIcon = subItem.icon;
                              const subTitle = isArabic
                                ? subItem.title.ar
                                : subItem.title.en;

                              return (
                                <SidebarMenuSubItem key={subItem.title.en}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={isItemActive(pathname, subItem)}
                                  >
                                    <Link
                                      href={subItem.href}
                                      target={
                                        subItem.newTab ? "_blank" : undefined
                                      }
                                      className={`flex w-full items-center gap-2 ${
                                        isArabic
                                          ? "flex-row-reverse text-right"
                                          : "flex-row text-left"
                                      }`}
                                    >
                                      {SubIcon ? (
                                        <SubIcon className="h-4 w-4 shrink-0" />
                                      ) : null}

                                      <span className="flex-1 truncate">
                                        {subTitle}
                                      </span>

                                      {subItem.isNew ? (
                                        <SidebarMenuBadge>
                                          {isArabic ? "جديد" : "New"}
                                        </SidebarMenuBadge>
                                      ) : null}
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </Collapsible>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.title.en}>
                    <SidebarMenuButton
                      tooltip={itemTitle}
                      isActive={isItemActive(pathname, item)}
                      asChild
                    >
                      <Link
                        href={item.href}
                        target={item.newTab ? "_blank" : undefined}
                        className={`flex w-full items-center gap-2 ${
                          isArabic
                            ? "flex-row-reverse text-right"
                            : "flex-row text-left"
                        }`}
                      >
                        {Icon ? <Icon className="shrink-0" /> : null}

                        <span className="flex-1 truncate">{itemTitle}</span>
                      </Link>
                    </SidebarMenuButton>

                    {item.isNew ? (
                      <SidebarMenuBadge>
                        {isArabic ? "جديد" : "New"}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}