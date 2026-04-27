"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Command } from "cmdk";
import {
  ArrowUpRight,
  BarChart3,
  Boxes,
  Briefcase,
  Building2,
  CreditCard,
  FileText,
  Globe2,
  Home,
  MessageCircle,
  ReceiptText,
  SearchIcon,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserCircle2,
  Users,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/components/providers/AuthProvider";

type AppLocale = "ar" | "en";
type WorkspaceType = "system" | "company" | "center" | "customer";

type SearchItem = {
  title: {
    ar: string;
    en: string;
  };
  href: string;
  aliases?: string[];
  icon?: React.ComponentType<{ className?: string }>;
  description?: {
    ar: string;
    en: string;
  };
};

const systemSearchItems: SearchItem[] = [
  {
    title: { ar: "الرئيسية", en: "Home" },
    href: "/system",
    icon: Home,
    description: {
      ar: "لوحة النظام الرئيسية",
      en: "System dashboard home",
    },
  },
  {
    title: { ar: "المراكز", en: "Centers" },
    href: "/system/centers",
    icon: Building2,
    description: {
      ar: "إدارة المراكز",
      en: "Manage centers",
    },
  },
  {
    title: { ar: "العملاء", en: "Customers" },
    href: "/system/customers",
    icon: Users,
    description: {
      ar: "إدارة العملاء",
      en: "Manage customers",
    },
  },
  {
    title: { ar: "المندوبون", en: "Agents" },
    href: "/system/agents",
    icon: Briefcase,
    description: {
      ar: "إدارة المندوبين",
      en: "Manage agents",
    },
  },
  {
    title: { ar: "المنتجات", en: "Products" },
    href: "/system/products",
    icon: Boxes,
    description: {
      ar: "إدارة المنتجات",
      en: "Manage products",
    },
  },
  {
    title: { ar: "الطلبات", en: "Orders" },
    href: "/system/orders",
    icon: ShoppingCart,
    description: {
      ar: "إدارة الطلبات",
      en: "Manage orders",
    },
  },
  {
    title: { ar: "مقدمو الخدمة", en: "Providers" },
    href: "/system/providers",
    icon: Building2,
    description: {
      ar: "إدارة مقدمي الخدمة",
      en: "Manage providers",
    },
  },
  {
    title: { ar: "العقود", en: "Contracts" },
    href: "/system/contracts",
    icon: FileText,
    description: {
      ar: "إدارة العقود",
      en: "Manage contracts",
    },
  },
  {
    title: { ar: "المدفوعات", en: "Payments" },
    href: "/system/payments",
    icon: CreditCard,
    description: {
      ar: "إدارة المدفوعات",
      en: "Manage payments",
    },
  },
  {
    title: { ar: "الفواتير", en: "Invoices" },
    href: "/system/invoices",
    icon: ReceiptText,
    description: {
      ar: "إدارة الفواتير",
      en: "Manage invoices",
    },
  },
  {
    title: { ar: "المحاسبة", en: "Accounting" },
    href: "/system/accounting",
    icon: BarChart3,
    description: {
      ar: "التقارير والقيود المحاسبية",
      en: "Accounting reports and journals",
    },
  },
  {
    title: { ar: "الخزينة", en: "Treasury" },
    href: "/system/treasury",
    icon: Wallet,
    description: {
      ar: "إدارة الخزينة والبنوك",
      en: "Manage treasury and banks",
    },
  },
  {
    title: { ar: "واتساب", en: "WhatsApp" },
    href: "/system/whatsapp",
    icon: MessageCircle,
    description: {
      ar: "إدارة واتساب",
      en: "Manage WhatsApp",
    },
  },
  {
    title: { ar: "مستخدمو النظام", en: "System Users" },
    href: "/system/users",
    icon: ShieldCheck,
    description: {
      ar: "إدارة مستخدمي النظام",
      en: "Manage system users",
    },
  },
  {
    title: { ar: "الإعدادات", en: "Settings" },
    href: "/system/settings",
    icon: Settings,
    description: {
      ar: "إعدادات النظام",
      en: "System settings",
    },
  },
];

const companySearchItems: SearchItem[] = [
  {
    title: { ar: "الرئيسية", en: "Home" },
    href: "/company",
    aliases: ["/center"],
    icon: Home,
    description: {
      ar: "لوحة المركز",
      en: "Center dashboard home",
    },
  },
  {
    title: { ar: "العملاء", en: "Customers" },
    href: "/company/customers",
    aliases: ["/center/customers"],
    icon: Users,
    description: {
      ar: "إدارة العملاء",
      en: "Manage customers",
    },
  },
  {
    title: { ar: "الطلبات", en: "Orders" },
    href: "/company/orders",
    aliases: ["/center/orders"],
    icon: ShoppingCart,
    description: {
      ar: "إدارة الطلبات",
      en: "Manage orders",
    },
  },
  {
    title: { ar: "المنتجات", en: "Products" },
    href: "/company/products",
    aliases: ["/center/products"],
    icon: Boxes,
    description: {
      ar: "إدارة المنتجات",
      en: "Manage products",
    },
  },
  {
    title: { ar: "العقود", en: "Contracts" },
    href: "/company/contracts",
    aliases: ["/center/contracts"],
    icon: FileText,
    description: {
      ar: "إدارة العقود",
      en: "Manage contracts",
    },
  },
  {
    title: { ar: "المدفوعات", en: "Payments" },
    href: "/company/payments",
    aliases: ["/center/payments"],
    icon: CreditCard,
    description: {
      ar: "إدارة المدفوعات",
      en: "Manage payments",
    },
  },
  {
    title: { ar: "الفواتير", en: "Invoices" },
    href: "/company/invoices",
    aliases: ["/center/invoices"],
    icon: ReceiptText,
    description: {
      ar: "إدارة الفواتير",
      en: "Manage invoices",
    },
  },
  {
    title: { ar: "المحاسبة", en: "Accounting" },
    href: "/company/accounting",
    aliases: ["/center/accounting"],
    icon: BarChart3,
    description: {
      ar: "التقارير والقيود المحاسبية",
      en: "Accounting reports and journals",
    },
  },
  {
    title: { ar: "الخزينة", en: "Treasury" },
    href: "/company/treasury",
    aliases: ["/center/treasury"],
    icon: Wallet,
    description: {
      ar: "إدارة الخزينة والبنوك",
      en: "Manage treasury and banks",
    },
  },
  {
    title: { ar: "الإعدادات", en: "Settings" },
    href: "/company/settings",
    aliases: ["/center/settings"],
    icon: Settings,
    description: {
      ar: "إعدادات المركز",
      en: "Center settings",
    },
  },
];

const customerSearchItems: SearchItem[] = [
  {
    title: { ar: "الرئيسية", en: "Home" },
    href: "/customer",
    icon: Home,
    description: {
      ar: "لوحة العميل",
      en: "Customer dashboard home",
    },
  },
  {
    title: { ar: "حسابي", en: "My Account" },
    href: "/customer/account",
    icon: UserCircle2,
    description: {
      ar: "حساب العميل",
      en: "Customer account",
    },
  },
  {
    title: { ar: "الإعدادات", en: "Settings" },
    href: "/customer/settings",
    icon: Globe2,
    description: {
      ar: "إعدادات العميل",
      en: "Customer settings",
    },
  },
];

function getStoredLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const htmlLang = document.documentElement.lang;
    if (htmlLang === "en") return "en";

    const savedLocale = window.localStorage.getItem("primey-locale");
    return savedLocale === "en" ? "en" : "ar";
  } catch (error) {
    console.error("Read locale error:", error);
    return "ar";
  }
}

function getWorkspaceFromPathname(pathname: string): WorkspaceType {
  if (pathname.startsWith("/system")) return "system";
  if (pathname.startsWith("/customer")) return "customer";
  if (pathname.startsWith("/center")) return "center";
  if (pathname.startsWith("/company")) return "company";
  return "system";
}

function normalizePath(path: string) {
  if (path === "/center") return "/company";
  if (path.startsWith("/center/")) return path.replace("/center", "/company");
  return path;
}

function matchesHref(pathname: string, href: string) {
  const normalizedPathname = normalizePath(pathname);
  const normalizedHref = normalizePath(href);

  if (
    normalizedHref === "/system" ||
    normalizedHref === "/company" ||
    normalizedHref === "/customer"
  ) {
    return normalizedPathname === normalizedHref;
  }

  return (
    normalizedPathname === normalizedHref ||
    normalizedPathname.startsWith(`${normalizedHref}/`)
  );
}

function isItemActive(pathname: string, item: SearchItem) {
  if (matchesHref(pathname, item.href)) return true;
  return (item.aliases || []).some((alias) => matchesHref(pathname, alias));
}

export default function Search() {
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const session = useAuth();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [locale, setLocale] = useState<AppLocale>("ar");

  useEffect(() => {
    const syncLocale = () => setLocale(getStoredLocale());

    syncLocale();
    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isCommandK =
        (event.key === "k" || event.key === "K") &&
        (event.metaKey || event.ctrlKey);

      if (isCommandK) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setOpen(false);
    setQuery("");
  }, [pathname]);

  const isArabic = locale === "ar";
  const workspace = getWorkspaceFromPathname(pathname);

  const searchItems = useMemo(() => {
    if (workspace === "system") return systemSearchItems;
    if (workspace === "customer") return customerSearchItems;
    return companySearchItems;
  }, [workspace, session]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return searchItems;

    return searchItems.filter((item) => {
      const arTitle = item.title.ar.toLowerCase();
      const enTitle = item.title.en.toLowerCase();
      const arDescription = item.description?.ar?.toLowerCase() || "";
      const enDescription = item.description?.en?.toLowerCase() || "";

      return (
        arTitle.includes(normalizedQuery) ||
        enTitle.includes(normalizedQuery) ||
        arDescription.includes(normalizedQuery) ||
        enDescription.includes(normalizedQuery)
      );
    });
  }, [query, searchItems]);

  const placeholder = isArabic
    ? "ابحث داخل مساحة العمل الحالية..."
    : "Search current workspace...";

  const emptyText = isArabic ? "لا توجد نتائج مطابقة" : "No matching results";

  const shortcutText = isMobile ? "" : "⌘K";

  const workspaceHeading = isArabic
    ? workspace === "system"
      ? "مساحة النظام"
      : workspace === "customer"
        ? "مساحة العميل"
        : "مساحة المركز"
    : workspace === "system"
      ? "System Workspace"
      : workspace === "customer"
        ? "Customer Workspace"
        : "Center Workspace";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground h-11 w-full justify-between gap-2 rounded-2xl border-border/70 bg-background shadow-sm px-3"
      >
        <span
          className={`flex min-w-0 items-center gap-2 ${
            isArabic ? "flex-row-reverse" : "flex-row"
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted/70">
            <SearchIcon className="h-4 w-4" />
          </span>
          <span className="truncate text-sm">{placeholder}</span>
        </span>

        {shortcutText ? (
          <span className="rounded-lg border border-border/60 bg-muted/40 px-2 py-1 text-[11px] font-medium text-muted-foreground">
            {shortcutText}
          </span>
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
          <DialogTitle className="sr-only">
            {isArabic ? "البحث السريع" : "Quick Search"}
          </DialogTitle>

          <DialogDescription className="sr-only">
            {isArabic
              ? "ابحث داخل مساحة العمل الحالية ثم انتقل مباشرة إلى الصفحة المطلوبة."
              : "Search within the current workspace and jump directly to the page you need."}
          </DialogDescription>

          <Command className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-popover">
            <div className="border-b px-3">
              <div
                className={`flex items-center gap-2 ${
                  isArabic ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <SearchIcon className="h-4 w-4 text-muted-foreground" />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder={placeholder}
                  className={`flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground ${
                    isArabic ? "text-right" : "text-left"
                  }`}
                />
              </div>
            </div>

            <Command.List className="max-h-[420px] overflow-y-auto p-2">
              {filteredItems.length === 0 ? (
                <Command.Empty className="py-10 text-center text-sm text-muted-foreground">
                  {emptyText}
                </Command.Empty>
              ) : (
                <Command.Group
                  heading={workspaceHeading}
                  className="px-2 py-2 text-xs text-muted-foreground"
                >
                  {filteredItems.map((item) => {
                    const Icon = item.icon || SearchIcon;
                    const title = isArabic ? item.title.ar : item.title.en;
                    const description = isArabic
                      ? item.description?.ar
                      : item.description?.en;

                    return (
                      <Command.Item
                        key={item.href}
                        value={`${item.title.ar} ${item.title.en} ${item.description?.ar || ""} ${item.description?.en || ""}`}
                        className="rounded-xl aria-selected:bg-accent aria-selected:text-accent-foreground"
                        asChild
                      >
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 ${
                            isArabic
                              ? "flex-row-reverse text-right"
                              : "flex-row text-left"
                          }`}
                        >
                          <div
                            className={`flex min-w-0 items-center gap-3 ${
                              isArabic ? "flex-row-reverse" : "flex-row"
                            }`}
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <Icon className="h-4 w-4" />
                            </div>

                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {title}
                              </div>
                              {description ? (
                                <div className="truncate text-xs text-muted-foreground">
                                  {description}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div
                            className={`flex shrink-0 items-center gap-2 ${
                              isItemActive(pathname, item)
                                ? "text-primary"
                                : "text-muted-foreground"
                            }`}
                          >
                            {isItemActive(pathname, item) ? (
                              <span className="text-xs font-medium">
                                {isArabic ? "الحالية" : "Current"}
                              </span>
                            ) : null}
                            <ArrowUpRight className="h-4 w-4" />
                          </div>
                        </Link>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}