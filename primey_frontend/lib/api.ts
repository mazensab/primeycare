/* ============================================================
   📂 lib/api.ts
   Primey Care - Frontend API Client
   ------------------------------------------------------------
   ✅ ملف موحد لكل طلبات API داخل الفرونت
   ✅ بدون hardcoded localhost
   ✅ متوافق مع اللوكل والإنتاج
   ✅ يعتمد على /api في المتصفح
   ✅ يعتمد على NEXT_PUBLIC_API_URL عند التنفيذ من السيرفر
   ✅ يدعم الكوكيز والجلسة
   ✅ يدعم CSRF للطلبات غير GET
   ✅ يعالج الأخطاء بشكل موحد
   ✅ مناسب لكل صفحات النظام لاحقًا
============================================================ */

export type ApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type ApiQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type ApiQuery = Record<string, ApiQueryValue>;

export type ApiRequestOptions = {
  method?: ApiMethod;
  query?: ApiQuery;
  body?: unknown;
  headers?: HeadersInit;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
  credentials?: RequestCredentials;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  status: number;
  raw: unknown;
};

export type ApiFailure = {
  ok: false;
  data: null;
  status: number;
  message: string;
  error?: string;
  raw?: unknown;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type PaginatedApiResponse<T> = {
  ok?: boolean;
  message?: string;
  results?: T[];
  data?: T[] | Record<string, unknown>;
  count?: number;
  pagination?: {
    page?: number;
    page_size?: number;
    total_pages?: number;
    total_items?: number;
    has_next?: boolean;
    has_previous?: boolean;
  };
  meta?: {
    page?: number;
    page_size?: number;
    total_pages?: number;
    total_items?: number;
    has_next?: boolean;
    has_previous?: boolean;
    [key: string]: unknown;
  };
};

const DEFAULT_ERROR_MESSAGE = "تعذر الاتصال بالخادم. حاول مرة أخرى.";

/* ============================================================
   🌐 API Base URL
   ------------------------------------------------------------
   - في المتصفح: نستخدم /api مباشرة حتى يعمل rewrite في اللوكل
   - في السيرفر: نستخدم NEXT_PUBLIC_API_URL إن وُجد
============================================================ */

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeBaseUrl(value?: string | null) {
  if (!value) return "";
  return value.replace(/\/+$/, "");
}

function normalizePath(path: string) {
  if (!path) return "/";

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return path.startsWith("/") ? path : `/${path}`;
}

export function getApiBaseUrl() {
  if (isBrowser()) {
    return "";
  }

  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      ""
  );
}

export function buildApiUrl(path: string, query?: ApiQuery) {
  const normalizedPath = normalizePath(path);

  const baseUrl =
    normalizedPath.startsWith("http://") ||
    normalizedPath.startsWith("https://")
      ? ""
      : getApiBaseUrl();

  const url = `${baseUrl}${normalizedPath}`;

  if (!query) return url;

  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  const queryString = searchParams.toString();

  if (!queryString) return url;

  return `${url}${url.includes("?") ? "&" : "?"}${queryString}`;
}

/* ============================================================
   🔐 CSRF Helpers
============================================================ */

function getCookie(name: string) {
  if (!isBrowser()) return "";

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || "";
  }

  return "";
}

function getCsrfToken() {
  return getCookie("csrftoken") || getCookie("csrf_token") || "";
}

function shouldAttachCsrf(method: ApiMethod) {
  return !["GET"].includes(method);
}

/* ============================================================
   🧠 Response Helpers
============================================================ */

function extractErrorMessage(payload: unknown, fallback = DEFAULT_ERROR_MESSAGE) {
  if (!payload || typeof payload !== "object") return fallback;

  const record = payload as Record<string, unknown>;

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }

  if (typeof record.error === "string" && record.error.trim()) {
    return record.error;
  }

  if (typeof record.detail === "string" && record.detail.trim()) {
    return record.detail;
  }

  return fallback;
}

async function readJsonSafely(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

/* ============================================================
   🚀 Main API Request
============================================================ */

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<ApiResult<T>> {
  const method = options.method || "GET";
  const url = buildApiUrl(path, options.query);

  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  const hasBody = options.body !== undefined && options.body !== null;

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (shouldAttachCsrf(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set("X-CSRFToken", csrfToken);
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      credentials: options.credentials || "include",
      cache: options.cache || "no-store",
      next: options.next,
    });

    const payload = await readJsonSafely(response);

    if (!response.ok) {
      return {
        ok: false,
        data: null,
        status: response.status,
        message: extractErrorMessage(payload),
        error:
          payload && typeof payload === "object"
            ? String((payload as Record<string, unknown>).error || "")
            : undefined,
        raw: payload,
      };
    }

    return {
      ok: true,
      data: payload as T,
      status: response.status,
      raw: payload,
    };
  } catch (error) {
    return {
      ok: false,
      data: null,
      status: 0,
      message:
        error instanceof Error && error.message
          ? error.message
          : DEFAULT_ERROR_MESSAGE,
      raw: error,
    };
  }
}

/* ============================================================
   🧩 Shortcuts
============================================================ */

export function apiGet<T = unknown>(
  path: string,
  query?: ApiQuery,
  options?: Omit<ApiRequestOptions, "method" | "query">
) {
  return apiRequest<T>(path, {
    ...options,
    method: "GET",
    query,
  });
}

export function apiPost<T = unknown>(
  path: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, "method" | "body">
) {
  return apiRequest<T>(path, {
    ...options,
    method: "POST",
    body,
  });
}

export function apiPatch<T = unknown>(
  path: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, "method" | "body">
) {
  return apiRequest<T>(path, {
    ...options,
    method: "PATCH",
    body,
  });
}

export function apiPut<T = unknown>(
  path: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, "method" | "body">
) {
  return apiRequest<T>(path, {
    ...options,
    method: "PUT",
    body,
  });
}

export function apiDelete<T = unknown>(
  path: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, "method" | "body">
) {
  return apiRequest<T>(path, {
    ...options,
    method: "DELETE",
    body,
  });
}

/* ============================================================
   🛡️ Safe Helpers
   ------------------------------------------------------------
   تستخدم في الداشبورد حتى لا تسقط الصفحة إذا فشل API واحد
============================================================ */

export async function safeApiGet<T = unknown>(
  path: string,
  query?: ApiQuery,
  fallback: T | null = null
): Promise<T | null> {
  const result = await apiGet<T>(path, query);

  if (!result.ok) {
    console.error("[Primey Care API Error]", {
      path,
      status: result.status,
      message: result.message,
    });

    return fallback;
  }

  return result.data;
}

export function getResults<T>(payload: unknown): T[] {
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record.results)) {
    return record.results as T[];
  }

  if (Array.isArray(record.data)) {
    return record.data as T[];
  }

  return [];
}

export function getDataObject<T extends Record<string, unknown>>(
  payload: unknown
): T | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;

  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
    return record.data as T;
  }

  return record as T;
}

/* ============================================================
   📌 Primey Care API Paths
============================================================ */

export const API_PATHS = {
  auth: {
    csrf: "/api/auth/csrf/",
    login: "/api/auth/login/",
    logout: "/api/auth/logout/",
    whoami: "/api/auth/whoami/",
    profile: "/api/auth/profile/",
    changePassword: "/api/auth/change-password/",
  },

  orders: {
    list: "/api/orders/",
    open: "/api/orders/open/",
    detail: (id: number | string) => `/api/orders/${id}/`,
  },

  orderItems: {
    list: "/api/order-items/",
    pending: "/api/order-items/pending/",
    detail: (id: number | string) => `/api/order-items/${id}/`,
  },

  products: {
    list: "/api/products/",
    public: "/api/products/public/",
    categories: "/api/products/categories/",
    detail: (id: number | string) => `/api/products/${id}/`,
    categoryDetail: (id: number | string) => `/api/products/categories/${id}/`,
  },

  customers: {
    statement: (id: number | string) => `/api/customers/${id}/statement/`,
  },

  invoices: {
    list: "/api/invoices/",
    detail: (id: number | string) => `/api/invoices/${id}/`,
    issue: (id: number | string) => `/api/invoices/${id}/issue/`,
  },

  payments: {
    list: "/api/payments/",
    detail: (id: number | string) => `/api/payments/${id}/`,
    confirm: (id: number | string) => `/api/payments/${id}/confirm/`,
  },

  agents: {
    list: "/api/agents/",
    detail: (id: number | string) => `/api/agents/${id}/`,
    approve: (id: number | string) => `/api/agents/${id}/approve/`,
  },

  providers: {
    list: "/api/providers/",
    detail: (id: number | string) => `/api/providers/${id}/`,
  },

  contracts: {
    list: "/api/contracts/",
    detail: (id: number | string) => `/api/contracts/${id}/`,
  },

  serviceItems: {
    list: "/api/service-items/",
    active: "/api/service-items/active/",
    detail: (id: number | string) => `/api/service-items/${id}/`,
  },

  accounting: {
    trialBalance: "/api/accounting/reports/trial-balance/",
    profitLoss: "/api/accounting/reports/profit-loss/",
    balanceSheet: "/api/accounting/reports/balance-sheet/",
    ledger: "/api/accounting/ledger/",
    journals: "/api/accounting/journals/",
    accountDetail: (id: number | string) => `/api/accounting/accounts/${id}/`,
    journalDetail: (id: number | string) => `/api/accounting/journals/${id}/`,
  },

  notificationCenter: {
    overview: "/api/notification-center/",
    list: "/api/notification-center/list/",
    logs: "/api/notification-center/logs/",
    settings: "/api/notification-center/settings/",
    preferences: "/api/notification-center/preferences/",
  },

  systemLog: {
    list: "/api/system-log/list/",
    summary: "/api/system-log/summary/",
    detail: (id: number | string) => `/api/system-log/${id}/`,
  },

  performanceCenter: {
    overview: "/api/performance-center/",
    list: "/api/performance-center/list/",
    detail: "/api/performance-center/detail/",
  },

  paymentGateways: {
    list: "/api/payment-gateways/",
  },

  treasury: {
    list: "/api/treasury/",
  },

  whatsapp: {
    base: "/api/whatsapp/",
  },
} as const;