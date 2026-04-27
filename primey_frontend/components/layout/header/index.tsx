"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import Notifications from "@/components/layout/header/notifications";
import Search from "@/components/layout/header/search";
import ThemeSwitch from "@/components/layout/header/theme-switch";
import UserMenu from "@/components/layout/header/user-menu";
import { ThemeCustomizerPanel } from "@/components/theme-customizer";
import { ActiveThemeProvider } from "@/components/active-theme";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

type AppLocale = "ar" | "en";

function applyLocaleToDocument(nextLocale: AppLocale) {
  if (typeof document === "undefined") return;

  document.documentElement.lang = nextLocale;
  document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr";
  document.body.setAttribute("dir", nextLocale === "ar" ? "rtl" : "ltr");
}

function getStoredLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";
    const savedLocale = window.localStorage.getItem("primey-locale");
    return savedLocale === "en" ? "en" : "ar";
  } catch (error) {
    console.error("Read locale error:", error);
    return "ar";
  }
}

export function SiteHeader() {
  const { toggleSidebar, open } = useSidebar();
  const [locale, setLocale] = useState<AppLocale>("ar");

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = getStoredLocale();
      setLocale(nextLocale);
      applyLocaleToDocument(nextLocale);
    };

    syncLocale();

    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  const toggleLanguage = () => {
    try {
      const nextLocale: AppLocale = locale === "ar" ? "en" : "ar";
      setLocale(nextLocale);

      if (typeof window !== "undefined") {
        window.localStorage.setItem("primey-locale", nextLocale);
        window.dispatchEvent(new Event("primey-locale-changed"));
      }

      applyLocaleToDocument(nextLocale);
    } catch (error) {
      console.error("Language toggle error:", error);
    }
  };

  const isArabic = locale === "ar";

  const wrapperDirection = useMemo(
    () => (isArabic ? "flex-row-reverse" : "flex-row"),
    [isArabic]
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="w-full px-3 md:px-4 xl:px-5">
        <div className="flex h-16 items-center">
          <div
            className={`flex w-full items-center gap-3 ${wrapperDirection}`}
          >
            <div
              className={`flex shrink-0 items-center gap-2 ${
                isArabic ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <Button
                type="button"
                onClick={toggleSidebar}
                size="icon"
                variant="outline"
                className="h-10 w-10 rounded-xl border-border/70 bg-background shadow-sm"
              >
                {open ? (
                  <PanelLeftClose className="h-4.5 w-4.5" />
                ) : (
                  <PanelLeftOpen className="h-4.5 w-4.5" />
                )}
              </Button>

              <Separator
                orientation="vertical"
                className="mx-1 hidden h-5 lg:flex"
              />
            </div>

            <div className="flex min-w-0 flex-1 justify-center">
              <div className="w-full max-w-[760px]">
                <Search />
              </div>
            </div>

            <div
              className={`flex shrink-0 items-center gap-1 rounded-2xl border border-border/70 bg-background/80 p-1 shadow-sm ${
                isArabic ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={toggleLanguage}
                className="h-9 w-9 rounded-xl"
                aria-label={
                  locale === "ar" ? "Switch to English" : "التبديل إلى العربية"
                }
                title={
                  locale === "ar" ? "Switch to English" : "التبديل إلى العربية"
                }
              >
                <Globe className="h-4.5 w-4.5" />
              </Button>

              <Notifications />
              <ThemeSwitch />

              <ActiveThemeProvider>
                <ThemeCustomizerPanel />
              </ActiveThemeProvider>

              <Separator
                orientation="vertical"
                className="mx-1 hidden h-5 sm:flex"
              />

              <div className="hidden sm:block">
                <UserMenu />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}