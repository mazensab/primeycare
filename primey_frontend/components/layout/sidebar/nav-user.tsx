"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import {
  BellIcon,
  CreditCardIcon,
  LogOutIcon,
  UserCircle2Icon,
} from "lucide-react";

import { DotsVerticalIcon } from "@radix-ui/react-icons";

type AppLocale = "ar" | "en";

type PrimeyAuthUser = {
  id?: number | string;
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
  avatar?: string | null;
};

type PrimeyAuthSubscription = {
  days_remaining?: number | null;
  apps?: string[];
};

type PrimeyAuthSession = {
  user?: PrimeyAuthUser | null;
  role?: string | null;
  subscription?: PrimeyAuthSubscription | null;
};

/* =====================================================
   ✅ قراءة لغة النظام بشكل آمن
   الأولوية لـ localStorage لأنه المصدر الرسمي للتبديل
   ثم document.documentElement.lang كاحتياط فقط
===================================================== */

function readStoredLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const savedLocale = window.localStorage.getItem("primey-locale");
    if (savedLocale === "en") return "en";
    if (savedLocale === "ar") return "ar";

    const htmlLang = document.documentElement.lang;
    return htmlLang === "en" ? "en" : "ar";
  } catch (error) {
    console.error("Nav user locale read error:", error);
    return "ar";
  }
}

/* =====================================================
   ✅ مزامنة اتجاه الصفحة مع اللغة الحالية
===================================================== */

function applyDocumentLocale(locale: AppLocale) {
  try {
    if (typeof document === "undefined") return;

    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.body.dir = locale === "ar" ? "rtl" : "ltr";
  } catch (error) {
    console.error("Nav user locale apply error:", error);
  }
}

/* =====================================================
   ✅ API Base
   بدون hardcoded localhost داخل الاستخدام المباشر
===================================================== */

function getApiBaseUrl(): string {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000";

  return apiUrl.replace(/\/$/, "");
}

/* =====================================================
   ✅ Safe User Helpers
===================================================== */

function normalizeSession(value: unknown): PrimeyAuthSession {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as PrimeyAuthSession;
}

function getUserDisplayName(
  user: PrimeyAuthUser | null | undefined,
  isArabic: boolean,
): string {
  const fullName = String(user?.full_name || "").trim();
  const username = String(user?.username || "").trim();
  const email = String(user?.email || "").trim();

  if (fullName) return fullName;
  if (username) return username;
  if (email) return email;

  return isArabic ? "مستخدم" : "User";
}

function getAvatarFallback(userName: string, isArabic: boolean): string {
  const cleanName = userName.trim();

  if (!cleanName) {
    return isArabic ? "م" : "U";
  }

  return cleanName.charAt(0).toUpperCase();
}

export function NavUser() {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const authSession = useAuth();

  const session = normalizeSession(authSession);

  const [loading, setLoading] = useState(false);
  const [locale, setLocale] = useState<AppLocale>("ar");

  /* =====================================================
     ✅ مزامنة لغة قائمة المستخدم مع الهيدر مباشرة
  ===================================================== */

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
  const user = session.user || null;

  const userName = getUserDisplayName(user, isArabic);
  const userEmail = String(user?.email || "");
  const userAvatar = String(user?.avatar || "");
  const avatarFallback = getAvatarFallback(userName, isArabic);

  const isCompanyArea =
    pathname?.startsWith("/company") ||
    pathname?.startsWith("/center") ||
    pathname?.startsWith("/provider");

  const accountHref = useMemo(() => {
    return isCompanyArea ? "/company/profile" : "/system/profile";
  }, [isCompanyArea]);

  const billingHref = useMemo(() => {
    return isCompanyArea ? "/company/billing" : "/system/billing";
  }, [isCompanyArea]);

  const notificationsHref = useMemo(() => {
    return isCompanyArea ? "/company/notifications" : "/system/notifications";
  }, [isCompanyArea]);

  /**
   * =====================================================
   * 🔐 SAFE CSRF READER
   * =====================================================
   */

  const getCSRFToken = () => {
    if (typeof document === "undefined") return "";

    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : "";
  };

  /**
   * =====================================================
   * 🔐 FIXED ENTERPRISE LOGOUT
   * =====================================================
   */

  const handleLogout = async () => {
    if (loading) return;

    setLoading(true);

    try {
      const apiBaseUrl = getApiBaseUrl();

      await fetch(`${apiBaseUrl}/api/auth/csrf/`, {
        method: "GET",
        credentials: "include",
      });

      const csrfToken = getCSRFToken();

      await fetch(`${apiBaseUrl}/api/auth/logout/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
      });
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      try {
        window.localStorage.setItem("primey_logout", Date.now().toString());
      } catch (error) {
        console.error("Logout localStorage error:", error);
      }

      router.replace("/login");
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="rounded-full">
                {userAvatar ? (
                  <AvatarImage
                    src={userAvatar}
                    alt={userName}
                    referrerPolicy="no-referrer"
                  />
                ) : null}

                <AvatarFallback className="rounded-lg">
                  {avatarFallback}
                </AvatarFallback>
              </Avatar>

              <div
                className={`grid flex-1 text-sm leading-tight ${
                  isArabic ? "text-right" : "text-left"
                }`}
              >
                <span className="truncate font-medium">{userName}</span>

                <span className="text-muted-foreground truncate text-xs">
                  {userEmail}
                </span>
              </div>

              <DotsVerticalIcon className="ms-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : isArabic ? "left" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div
                className={`flex items-center gap-2 px-1 py-1.5 text-sm ${
                  isArabic ? "text-right" : "text-left"
                }`}
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  {userAvatar ? (
                    <AvatarImage
                      src={userAvatar}
                      alt={userName}
                      referrerPolicy="no-referrer"
                    />
                  ) : null}

                  <AvatarFallback className="rounded-lg">
                    {avatarFallback}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={`grid flex-1 text-sm leading-tight ${
                    isArabic ? "text-right" : "text-left"
                  }`}
                >
                  <span className="truncate font-medium">{userName}</span>

                  <span className="text-muted-foreground truncate text-xs">
                    {userEmail}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => router.push(accountHref)}
                className="cursor-pointer"
              >
                <UserCircle2Icon />
                {isArabic ? "الحساب" : "Account"}
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => router.push(billingHref)}
                className="cursor-pointer"
              >
                <CreditCardIcon />
                {isArabic ? "الفوترة" : "Billing"}
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => router.push(notificationsHref)}
                className="cursor-pointer"
              >
                <BellIcon />
                {isArabic ? "الإشعارات" : "Notifications"}
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
              disabled={loading}
              className="cursor-pointer text-red-600 focus:text-red-600"
            >
              <LogOutIcon />

              {loading
                ? isArabic
                  ? "جارٍ تسجيل الخروج..."
                  : "Signing out..."
                : isArabic
                  ? "تسجيل الخروج"
                  : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}