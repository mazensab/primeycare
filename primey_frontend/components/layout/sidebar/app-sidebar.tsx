"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import {
  ChevronsUpDown,
  ShoppingBagIcon,
  UserCircle2Icon,
  Building2,
  Shield,
  Briefcase,
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

type AppLocale = "ar" | "en";
type WorkspaceType = "system" | "company" | "center" | "customer";

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  type: WorkspaceType;
};

/* ======================================================
   ✅ قراءة لغة النظام بشكل آمن
   الأولوية هنا لـ localStorage لأنه المصدر الرسمي للتبديل
   ثم document.documentElement.lang كاحتياط فقط
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

/* ======================================================
   ✅ تطبيق اتجاه الصفحة عند الحاجة
   لا يغير اللغة من نفسه، فقط يزامن dir/lang مع القيمة الحالية
====================================================== */
function applyDocumentLocale(locale: AppLocale) {
  try {
    if (typeof document === "undefined") return;

    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.body.dir = locale === "ar" ? "rtl" : "ltr";
  } catch (error) {
    console.error("Sidebar locale apply error:", error);
  }
}

export function AppSidebar({ type, ...props }: AppSidebarProps) {
  const pathname = usePathname();
  const { setOpen, setOpenMobile, isMobile, dir } = useSidebar();
  const isTablet = useIsTablet();

  const [locale, setLocale] = useState<AppLocale>("ar");
  const hasInitializedResponsiveState = useRef(false);

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  /* ======================================================
     ✅ ضبط أولي فقط حسب المقاس
     لا نعيد فرض open في كل مرة حتى لا يتعطل زر التصغير
  ====================================================== */
  useEffect(() => {
    if (!hasInitializedResponsiveState.current) {
      setOpen(!isTablet);
      hasInitializedResponsiveState.current = true;
    }
  }, [isTablet, setOpen]);

  /* ======================================================
     ✅ مزامنة لغة السايدر مع الهيدر مباشرة
     يعتمد على:
     - localStorage: primey-locale
     - event: primey-locale-changed
     - storage event

     ملاحظة:
     أضفنا setTimeout خفيف لأن بعض أزرار اللغة تطلق الحدث
     قبل اكتمال تحديث document/lang في نفس اللحظة.
  ====================================================== */
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

  const isArabic = locale === "ar";
  const isSystem = type === "system";
  const isCustomer = type === "customer";
  const isCenter = type === "center" || type === "company";

  const workspaceLabel = isSystem
    ? isArabic
      ? "مساحة عمل النظام"
      : "System Workspace"
    : isCustomer
      ? isArabic
        ? "مساحة العميل"
        : "Customer Workspace"
      : isArabic
        ? "مساحة المركز"
        : "Center Workspace";

  const primaryActionLabel = isSystem
    ? isArabic
      ? "مساحة عمل جديدة"
      : "New Workspace"
    : isCustomer
      ? isArabic
        ? "الخدمات المتاحة"
        : "Available Services"
      : isArabic
        ? "تطبيقات المركز"
        : "Center Apps";

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
                <DropdownMenuLabel
                  className={isArabic ? "text-right" : "text-left"}
                >
                  {workspaceLabel}
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {isSystem && (
                  <>
                    <DropdownMenuItem className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-md border">
                        <Shield className="text-muted-foreground size-4" />
                      </div>
                      <div
                        className={`flex flex-col ${
                          isArabic ? "text-right" : "text-left"
                        }`}
                      >
                        <span className="text-sm font-medium">
                          {isArabic ? "لوحة النظام" : "System Dashboard"}
                        </span>
                        <span className="text-xs text-green-700">
                          {isArabic ? "نشط" : "Active"}
                        </span>
                      </div>
                    </DropdownMenuItem>

                    <DropdownMenuItem className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-md border">
                        <ShoppingBagIcon className="text-muted-foreground size-4" />
                      </div>
                      <div
                        className={`flex flex-col ${
                          isArabic ? "text-right" : "text-left"
                        }`}
                      >
                        <span className="text-sm font-medium">
                          {isArabic ? "إدارة المنصة" : "Platform Management"}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {isArabic ? "منطقة الإدارة" : "Admin Area"}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  </>
                )}

                {isCenter && (
                  <>
                    <DropdownMenuItem className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-md border">
                        <Building2 className="text-muted-foreground size-4" />
                      </div>
                      <div
                        className={`flex flex-col ${
                          isArabic ? "text-right" : "text-left"
                        }`}
                      >
                        <span className="text-sm font-medium">
                          {isArabic ? "لوحة المركز" : "Center Dashboard"}
                        </span>
                        <span className="text-xs text-green-700">
                          {isArabic ? "نشط" : "Active"}
                        </span>
                      </div>
                    </DropdownMenuItem>

                    <DropdownMenuItem className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-md border">
                        <Briefcase className="text-muted-foreground size-4" />
                      </div>
                      <div
                        className={`flex flex-col ${
                          isArabic ? "text-right" : "text-left"
                        }`}
                      >
                        <span className="text-sm font-medium">
                          {isArabic ? "تشغيل المركز" : "Center Operations"}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {isArabic ? "المنطقة التشغيلية" : "Workspace Area"}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  </>
                )}

                {isCustomer && (
                  <>
                    <DropdownMenuItem className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-md border">
                        <UserCircle2Icon className="text-muted-foreground size-4" />
                      </div>
                      <div
                        className={`flex flex-col ${
                          isArabic ? "text-right" : "text-left"
                        }`}
                      >
                        <span className="text-sm font-medium">
                          {isArabic ? "لوحة العميل" : "Customer Dashboard"}
                        </span>
                        <span className="text-xs text-green-700">
                          {isArabic ? "نشط" : "Active"}
                        </span>
                      </div>
                    </DropdownMenuItem>

                    <DropdownMenuItem className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-md border">
                        <ShoppingBagIcon className="text-muted-foreground size-4" />
                      </div>
                      <div
                        className={`flex flex-col ${
                          isArabic ? "text-right" : "text-left"
                        }`}
                      >
                        <span className="text-sm font-medium">
                          {isArabic
                            ? "خدماتي وطلباتي"
                            : "My Services & Orders"}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {isArabic ? "المساحة الشخصية" : "Personal Area"}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />

                <button
                  type="button"
                  disabled
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground opacity-50"
                >
                  <PlusIcon />
                  {primaryActionLabel}
                </button>
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