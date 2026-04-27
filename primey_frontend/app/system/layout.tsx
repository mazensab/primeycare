"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { SiteHeader } from "@/components/layout/header";
import {
  AuthProvider,
  type AuthSession,
} from "@/components/providers/AuthProvider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

type WorkspaceType = "system" | "company" | "center" | "customer";

function resolveWorkspace(pathname: string): WorkspaceType {
  if (pathname.startsWith("/system")) return "system";
  if (pathname.startsWith("/customer")) return "customer";
  if (pathname.startsWith("/center")) return "center";
  if (pathname.startsWith("/company")) return "company";
  return "system";
}

const INITIAL_SYSTEM_SESSION: AuthSession = {
  authenticated: true,
  is_superuser: false,
  is_staff: false,
  is_system_user: true,
  workspace: "system",
  dashboard_path: "/system",
  role: "SYSTEM",
  user_type: "SYSTEM",
  scope_type: "SYSTEM",
  company: null,
  company_id: null,
  center_id: null,
  customer_id: null,
  agent_id: null,
  user: null,
  subscription: null,
  permissions: {
    is_superuser: false,
    is_staff: false,
    groups: [],
  },
  profile: {
    user_type: "SYSTEM",
    extra_data: {},
  },
};

export default function SystemLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const workspace = resolveWorkspace(pathname);

  return (
    <AuthProvider initialUser={INITIAL_SYSTEM_SESSION}>
      <SidebarProvider>
        <AppSidebar type={workspace} />

        <SidebarInset className="min-h-screen overflow-hidden bg-muted/20">
          <SiteHeader />

          <main className="flex-1 overflow-x-hidden p-3 md:p-4 xl:p-5">
            <div className="mx-auto w-full max-w-[1720px]">{children}</div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  );
}