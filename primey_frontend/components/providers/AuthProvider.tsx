"use client";

// ======================================================
// 🔐 Primey Care — Auth Provider
// ======================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

// ======================================================
// TYPES
// ======================================================

type AuthPermissions = {
  is_superuser?: boolean;
  is_staff?: boolean;
  groups?: string[];
};

type AuthProfile = {
  user_type?: string | null;
  extra_data?: Record<string, unknown>;
};

export type AuthSession = {
  authenticated: boolean;
  is_superuser: boolean;
  is_staff?: boolean;
  is_system_user?: boolean;
  workspace?: string | null;
  dashboard_path?: string | null;
  role?: string | null;
  user_type?: string | null;
  scope_type?: string | null;
  company?: unknown;
  company_id?: number | null;
  center_id?: number | null;
  customer_id?: number | null;
  agent_id?: number | null;
  user?: unknown;
  subscription?: {
    apps?: string[];
    [key: string]: unknown;
  } | null;
  permissions?: AuthPermissions | null;
  profile?: AuthProfile | null;
};

type AuthContextValue = {
  session: AuthSession;
  setSession: React.Dispatch<React.SetStateAction<AuthSession>>;
};

const DEFAULT_AUTH_SESSION: AuthSession = {
  authenticated: false,
  is_superuser: false,
  is_staff: false,
  is_system_user: false,
  workspace: null,
  dashboard_path: "/login",
  role: null,
  user_type: null,
  scope_type: null,
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
    user_type: null,
    extra_data: {},
  },
};

// ======================================================
// HELPERS
// ======================================================

function resolveApiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "";
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${safePath}` : safePath;
}

function normalizeSession(input: Partial<AuthSession> | null | undefined): AuthSession {
  return {
    ...DEFAULT_AUTH_SESSION,
    ...input,
    authenticated: input?.authenticated === true,
    is_superuser:
      input?.is_superuser === true ||
      input?.permissions?.is_superuser === true,
    is_staff:
      input?.is_staff === true ||
      input?.permissions?.is_staff === true,
    permissions: {
      ...DEFAULT_AUTH_SESSION.permissions,
      ...(input?.permissions || {}),
      groups: Array.isArray(input?.permissions?.groups)
        ? input?.permissions?.groups
        : [],
    },
    profile: {
      ...DEFAULT_AUTH_SESSION.profile,
      ...(input?.profile || {}),
      extra_data:
        input?.profile?.extra_data &&
        typeof input.profile.extra_data === "object"
          ? input.profile.extra_data
          : {},
    },
  };
}

// ======================================================
// CONTEXT
// ======================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// ======================================================
// PROVIDER
// ======================================================

export function AuthProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser?: Partial<AuthSession>;
}) {
  const router = useRouter();

  const [session, setSession] = useState<AuthSession>(
    normalizeSession(initialUser)
  );

  useEffect(() => {
    let active = true;

    async function validateSession() {
      try {
        const res = await fetch(resolveApiUrl("/api/auth/whoami/"), {
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to validate session");
        }

        const data = await res.json();

        if (!data?.authenticated) {
          if (active) {
            localStorage.setItem("primey_logout", Date.now().toString());
            setSession(normalizeSession(null));
            router.replace("/login");
          }
          return;
        }

        if (active) {
          setSession(normalizeSession(data));
        }
      } catch (error) {
        if (active) {
          console.error("AuthProvider session validation failed:", error);
          setSession(normalizeSession(null));
          router.replace("/login");
        }
      }
    }

    validateSession();
    const interval = window.setInterval(validateSession, 60000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [router]);

  useEffect(() => {
    function syncLogout(e: StorageEvent) {
      if (e.key === "primey_logout") {
        setSession(normalizeSession(null));
        router.replace("/login");
      }
    }

    window.addEventListener("storage", syncLogout);
    return () => window.removeEventListener("storage", syncLogout);
  }, [router]);

  const contextValue = useMemo(
    () => ({
      session,
      setSession,
    }),
    [session]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// ======================================================
// HOOK
// ======================================================

export function useAuth(): AuthSession {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return ctx.session;
}