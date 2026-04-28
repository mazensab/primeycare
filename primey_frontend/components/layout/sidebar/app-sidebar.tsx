"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Briefcase,
  Building2,
  ChevronsUpDown,
  Shield,
  ShoppingBagIcon,
  UserCircle2Icon,
} from "lucide-react";
import { PlusIcon } from "@radix-ui/react-icons";
import { usePathname } from "next/navigation";
import { useIsTablet } from "@/hooks/use-mobile";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/layout/sidebar/nav-main";
import { NavUser } from "@/components/layout/sidebar/nav-user";
import { ScrollArea } from "@/components/ui/scroll-area";
import Logo from "@/components/layout/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ======================================================
   TYPES
====================================================== */

type AppLocale = "ar" | "en";

type WorkspaceType =
  | "system"
  | "company"
  | "center"
  | "provider"
  | "customer"
  | "agent";

type NormalizedWorkspace = "system" | "provider" | "customer" | "agent";

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  type: WorkspaceType;
};

/* ======================================================
   LOCALE HELPERS
====================================================== */

function readStoredLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const savedLocale = window.localStorage.getItem("primey-locale");
    if (savedLocale === "en") return "en";
    if (savedLocale === "ar") return "ar";

    const htmlLang = document.documentElement.lang;
    return htmlLang === "en" ? "en" : "ar";
  } catch (error) {
    console.error("Sidebar locale read error:", error);
    return "ar";
  }
}

function applyDocumentLocale(locale: AppLocale): void {
  try {
    if (typeof document === "undefined") return;

    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.body.dir = locale === "ar" ? "rtl" : "ltr";
  } catch (error) {
    console.error("Sidebar locale apply error:", error);
  }
}

/* ======================================================
   WORKSPACE HELPERS
====================================================== */

function normalizeWorkspace(type: WorkspaceType): NormalizedWorkspace {
  if (type === "company" || type === "center" || type === "provider") {
    return "provider";
  }

  if (type === "customer") return "customer";
  if (type === "agent") return "agent";

  return "system";
}

function getWorkspaceCopy(
  workspace: NormalizedWorkspace,
  isArabic: boolean,
): {
  workspaceLabel: string;
  primaryActionLabel: string;
  firstItemTitle: string;
  firstItemStatus: string;
  secondItemTitle: string;
  secondItemSubtitle: string;
} {
  if (workspace === "system") {
    return {
      workspaceLabel: isArabic ? "مساحة عمل النظام" : "System Workspace",
      primaryActionLabel: isArabic ? "مساحة عمل جديدة" : "New Workspace",
      firstItemTitle: isArabic ? "لوحة النظام" : "System Dashboard",
      firstItemStatus: isArabic ? "نشط" : "Active",
      secondItemTitle: isArabic ? "إدارة المنصة" : "Platform Management",
      secondItemSubtitle: isArabic ? "منطقة الإدارة" : "Admin Area",
    };
  }

  if (workspace === "provider") {
    return {
      workspaceLabel: isArabic ? "مساحة مقدم الخدمة" : "Provider Workspace",
      primaryActionLabel: isArabic ? "تطبيقات مقدم الخدمة" : "Provider Apps",
      firstItemTitle: isArabic ? "لوحة مقدم الخدمة" : "Provider Dashboard",
      firstItemStatus: isArabic ? "نشط" : "Active",
      secondItemTitle: isArabic ? "تشغيل مقدم الخدمة" : "Provider Operations",
      secondItemSubtitle: isArabic ? "المنطقة التشغيلية" : "Workspace Area",
    };
  }

  if (workspace === "customer") {
    return {
      workspaceLabel: isArabic ? "مساحة العميل" : "Customer Workspace",
      primaryActionLabel: isArabic ? "الخدمات المتاحة" : "Available Services",
      firstItemTitle: isArabic ? "لوحة العميل" : "Customer Dashboard",
      firstItemStatus: isArabic ? "نشط" : "Active",
      secondItemTitle: isArabic ? "خدماتي وطلباتي" : "My Services & Orders",
      secondItemSubtitle: isArabic ? "المساحة الشخصية" : "Personal Area",
    };
  }

  return {
    workspaceLabel: isArabic ? "مساحة المندوب" : "Agent Workspace",
    primaryActionLabel: isArabic ? "أدوات المندوب" : "Agent Tools",
    firstItemTitle: isArabic ? "لوحة المندوب" : "Agent Dashboard",
    firstItemStatus: isArabic ? "نشط" : "Active",
    secondItemTitle: isArabic ? "عملائي وعمولاتي" : "Customers & Commissions",
    secondItemSubtitle: isArabic ? "مساحة المندوب" : "Agent Area",
  };
}

function getWorkspaceIcons(workspace: NormalizedWorkspace) {
  if (workspace === "system") {
    return {
      first: Shield,
      second: ShoppingBagIcon,
    };
  }

  if (workspace === "provider") {
    return {
      first: Building2,
      second: Briefcase,
    };
  }

  if (workspace === "customer") {
    return {
      first: UserCircle2Icon,
      second: ShoppingBagIcon,
    };
  }

  return {
    first: Briefcase,
    second: UserCircle2Icon,
  };
}

/* ======================================================
   COMPONENT
====================================================== */

export function AppSidebar({ type, ...props }: AppSidebarProps) {
  const pathname = usePathname();
  const { setOpen, setOpenMobile, isMobile, dir } = useSidebar();
  const isTablet = useIsTablet();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const hasInitializedResponsiveState = useRef(false);

  const isArabic = locale === "ar";
  const workspace = normalizeWorkspace(type);

  const copy = useMemo(
    () => getWorkspaceCopy(workspace, isArabic),
    [workspace, isArabic],
  );

  const icons = useMemo(() => getWorkspaceIcons(workspace), [workspace]);

  const FirstIcon = icons.first;
  const SecondIcon = icons.second;

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  useEffect(() => {
    if (!hasInitializedResponsiveState.current) {
      setOpen(!isTablet);
      hasInitializedResponsiveState.current = true;
    }
  }, [isTablet, setOpen]);

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readStoredLocale();

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

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="hover:text-foreground h-10 group-data-[collapsible=icon]:px-0!">
                  <Logo />
                  <ChevronsUpDown className="ms-auto group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                className="mt-4 w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={isMobile ? "bottom" : dir === "rtl" ? "left" : "right"}
                align="end"
                sideOffset={4}
              >
                <div dir={isArabic ? "rtl" : "ltr"}>
                  <DropdownMenuLabel
                    className={isArabic ? "text-right" : "text-left"}
                  >
                    {copy.workspaceLabel}
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-md border">
                      <FirstIcon className="text-muted-foreground size-4" />
                    </div>

                    <div
                      className={`flex flex-col ${
                        isArabic ? "text-right" : "text-left"
                      }`}
                    >
                      <span className="text-sm font-medium">
                        {copy.firstItemTitle}
                      </span>
                      <span className="text-xs text-green-700">
                        {copy.firstItemStatus}
                      </span>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuItem className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-md border">
                      <SecondIcon className="text-muted-foreground size-4" />
                    </div>

                    <div
                      className={`flex flex-col ${
                        isArabic ? "text-right" : "text-left"
                      }`}
                    >
                      <span className="text-sm font-medium">
                        {copy.secondItemTitle}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {copy.secondItemSubtitle}
                      </span>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <button
                    type="button"
                    disabled
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground opacity-50"
                  >
                    <PlusIcon />
                    {copy.primaryActionLabel}
                  </button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="h-full">
          <NavMain type={type} />
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}