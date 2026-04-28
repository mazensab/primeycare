"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Ban,
  Eye,
  Filter,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AppLocale = "ar" | "en";

type UserListItem = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  last_login: string | null;
  date_joined: string | null;
  groups: string[];
  profile: {
    display_name: string;
    user_type: string;
    phone_number: string | null;
    whatsapp_number: string | null;
    alternate_email: string | null;
    preferred_language: string;
    timezone: string;
    is_profile_completed: boolean;
    extra_data: Record<string, unknown>;
    tags: string[];
  };
};

type UsersListResponse = {
  success: boolean;
  message: string;
  results: UserListItem[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
};

const USER_TYPE_OPTIONS = [
  { value: "", ar: "كل الأنواع", en: "All types" },
  { value: "SUPER_ADMIN", ar: "سوبر أدمن", en: "Super Admin" },
  { value: "SYSTEM", ar: "مستخدم نظام", en: "System User" },
  { value: "STAFF", ar: "موظف", en: "Staff" },
  { value: "ACCOUNTANT", ar: "محاسب", en: "Accountant" },
  { value: "CUSTOMER", ar: "عميل", en: "Customer" },
  { value: "CENTER", ar: "مركز", en: "Center" },
  { value: "PROVIDER", ar: "مقدم خدمة", en: "Provider" },
  { value: "AGENT", ar: "مندوب", en: "Agent" },
  { value: "BROKER", ar: "وكيل", en: "Broker" },
  { value: "PARTNER", ar: "شريك", en: "Partner" },
  { value: "OTHER", ar: "أخرى", en: "Other" },
];

const ACTIVE_OPTIONS = [
  { value: "", ar: "كل الحالات", en: "All statuses" },
  { value: "true", ar: "نشط", en: "Active" },
  { value: "false", ar: "معطل", en: "Inactive" },
];

function getLocale(): AppLocale {
  if (typeof window === "undefined") return "ar";

  const htmlLang = document.documentElement.lang;
  if (htmlLang === "en") return "en";

  const stored = localStorage.getItem("primey-locale");
  if (stored === "en" || stored === "ar") return stored;

  return "ar";
}

function getApiBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  return fromEnv || "http://127.0.0.1:8000";
}

function formatDate(value: string | null, locale: AppLocale) {
  if (!value) return locale === "ar" ? "—" : "—";

  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      numberingSystem: "latn",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function userTypeLabel(value: string, locale: AppLocale) {
  const item = USER_TYPE_OPTIONS.find((option) => option.value === value);
  if (!item) return value || "—";
  return locale === "ar" ? item.ar : item.en;
}

function getDisplayName(user: UserListItem) {
  return (
    user.profile?.display_name ||
    user.full_name ||
    user.email ||
    user.username ||
    `User #${user.id}`
  );
}

export default function SystemUsersPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [userType, setUserType] = useState("");
  const [isActive, setIsActive] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 20,
    total: 0,
    total_pages: 1,
  });

  const isArabic = locale === "ar";
  const dir = isArabic ? "rtl" : "ltr";

  const labels = useMemo(
    () => ({
      title: isArabic ? "مستخدمو النظام" : "System Users",
      subtitle: isArabic
        ? "إدارة حسابات الدخول لجميع أطراف Primey Care من مكان واحد."
        : "Manage login accounts for all Primey Care actors in one place.",
      addUser: isArabic ? "إضافة مستخدم" : "Add User",
      refresh: isArabic ? "تحديث" : "Refresh",
      search: isArabic ? "بحث عن اسم، بريد، جوال..." : "Search name, email, phone...",
      type: isArabic ? "نوع المستخدم" : "User Type",
      status: isArabic ? "الحالة" : "Status",
      totalUsers: isArabic ? "إجمالي المستخدمين" : "Total Users",
      activeUsers: isArabic ? "النشطون" : "Active",
      inactiveUsers: isArabic ? "المعطلون" : "Inactive",
      systemUsers: isArabic ? "مستخدمو النظام" : "System Users",
      user: isArabic ? "المستخدم" : "User",
      contact: isArabic ? "التواصل" : "Contact",
      role: isArabic ? "الدور" : "Role",
      joined: isArabic ? "تاريخ الإنشاء" : "Joined",
      lastLogin: isArabic ? "آخر دخول" : "Last Login",
      actions: isArabic ? "الإجراءات" : "Actions",
      details: isArabic ? "تفاصيل" : "Details",
      noData: isArabic ? "لا توجد بيانات مستخدمين." : "No users found.",
      loading: isArabic ? "جاري تحميل المستخدمين..." : "Loading users...",
      active: isArabic ? "نشط" : "Active",
      inactive: isArabic ? "معطل" : "Inactive",
      yes: isArabic ? "نعم" : "Yes",
      no: isArabic ? "لا" : "No",
      previous: isArabic ? "السابق" : "Previous",
      next: isArabic ? "التالي" : "Next",
      page: isArabic ? "صفحة" : "Page",
      of: isArabic ? "من" : "of",
    }),
    [isArabic]
  );

  const stats = useMemo(() => {
    const active = users.filter((item) => item.is_active).length;
    const inactive = users.filter((item) => !item.is_active).length;
    const system = users.filter(
      (item) => item.is_staff || item.is_superuser || item.profile.user_type === "SYSTEM"
    ).length;

    return {
      total: pagination.total,
      active,
      inactive,
      system,
    };
  }, [users, pagination.total]);

  async function loadUsers() {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", "20");

      if (q.trim()) params.set("q", q.trim());
      if (userType) params.set("user_type", userType);
      if (isActive) params.set("is_active", isActive);

      const response = await fetch(`${getApiBaseUrl()}/api/users/?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const data = (await response.json()) as UsersListResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load users.");
      }

      setUsers(data.results || []);
      setPagination(data.pagination);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isArabic
            ? "تعذر تحميل المستخدمين."
            : "Unable to load users.";

      toast.error(message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLocale(getLocale());
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadUsers();
    }, 350);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, userType, isActive, page]);

  function resetFilters() {
    setQ("");
    setUserType("");
    setIsActive("");
    setPage(1);
  }

  return (
    <main dir={dir} className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-3xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <Users className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                {labels.title}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                {labels.subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={loadUsers}
              disabled={loading}
              className="rounded-2xl"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              <span>{labels.refresh}</span>
            </Button>

            <Button asChild className="rounded-2xl bg-slate-900 hover:bg-slate-800">
              <Link href="/system/users/create">
                <Plus className="h-4 w-4" />
                <span>{labels.addUser}</span>
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>{labels.totalUsers}</CardDescription>
              <CardTitle className="text-3xl">{formatNumber(stats.total)}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>{labels.activeUsers}</CardDescription>
              <CardTitle className="flex items-center gap-2 text-3xl">
                <BadgeCheck className="h-6 w-6 text-emerald-600" />
                {formatNumber(stats.active)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>{labels.inactiveUsers}</CardDescription>
              <CardTitle className="flex items-center gap-2 text-3xl">
                <Ban className="h-6 w-6 text-rose-600" />
                {formatNumber(stats.inactive)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>{labels.systemUsers}</CardDescription>
              <CardTitle className="flex items-center gap-2 text-3xl">
                <ShieldCheck className="h-6 w-6 text-blue-600" />
                {formatNumber(stats.system)}
              </CardTitle>
            </CardHeader>
          </Card>
        </section>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-slate-500" />
              <CardTitle className="text-base">{isArabic ? "الفلاتر" : "Filters"}</CardTitle>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-3 md:grid-cols-[1fr_220px_180px_auto]">
              <div className="relative">
                <Search
                  className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ${
                    isArabic ? "right-3" : "left-3"
                  }`}
                />
                <Input
                  value={q}
                  onChange={(event) => {
                    setQ(event.target.value);
                    setPage(1);
                  }}
                  placeholder={labels.search}
                  className={`h-11 rounded-2xl ${isArabic ? "pr-10" : "pl-10"}`}
                />
              </div>

              <select
                value={userType}
                onChange={(event) => {
                  setUserType(event.target.value);
                  setPage(1);
                }}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none ring-0 focus:border-slate-400"
              >
                {USER_TYPE_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {isArabic ? option.ar : option.en}
                  </option>
                ))}
              </select>

              <select
                value={isActive}
                onChange={(event) => {
                  setIsActive(event.target.value);
                  setPage(1);
                }}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none ring-0 focus:border-slate-400"
              >
                {ACTIVE_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {isArabic ? option.ar : option.en}
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="outline"
                onClick={resetFilters}
                className="h-11 rounded-2xl"
              >
                {isArabic ? "مسح" : "Clear"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-0 shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm">{labels.loading}</span>
              </div>
            ) : users.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-slate-500">
                <UserCog className="h-10 w-10" />
                <span className="text-sm">{labels.noData}</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-5 py-4 text-start font-semibold">{labels.user}</th>
                      <th className="px-5 py-4 text-start font-semibold">{labels.contact}</th>
                      <th className="px-5 py-4 text-start font-semibold">{labels.role}</th>
                      <th className="px-5 py-4 text-start font-semibold">{labels.status}</th>
                      <th className="px-5 py-4 text-start font-semibold">{labels.joined}</th>
                      <th className="px-5 py-4 text-start font-semibold">{labels.lastLogin}</th>
                      <th className="px-5 py-4 text-end font-semibold">{labels.actions}</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {users.map((user) => (
                      <tr key={user.id} className="bg-white transition hover:bg-slate-50/80">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-700">
                              {getDisplayName(user).slice(0, 1)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-950">
                                {getDisplayName(user)}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                @{user.username}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-slate-800">{user.email || "—"}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {user.profile.phone_number || user.profile.whatsapp_number || "—"}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className="rounded-full">
                              {userTypeLabel(user.profile.user_type, locale)}
                            </Badge>
                            {user.is_superuser ? (
                              <Badge className="rounded-full bg-slate-900">
                                SUPER
                              </Badge>
                            ) : null}
                            {user.is_staff ? (
                              <Badge variant="outline" className="rounded-full">
                                STAFF
                              </Badge>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {user.is_active ? (
                            <Badge className="rounded-full bg-emerald-600">
                              {labels.active}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="rounded-full">
                              {labels.inactive}
                            </Badge>
                          )}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {formatDate(user.date_joined, locale)}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {formatDate(user.last_login, locale)}
                        </td>

                        <td className="px-5 py-4 text-end">
                          <Button asChild variant="outline" size="sm" className="rounded-xl">
                            <Link href={`/system/users/${user.id}`}>
                              <Eye className="h-4 w-4" />
                              <span>{labels.details}</span>
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 rounded-3xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            {labels.page} {formatNumber(pagination.page)} {labels.of}{" "}
            {formatNumber(pagination.total_pages || 1)}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-2xl"
            >
              {labels.previous}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={page >= pagination.total_pages || loading}
              onClick={() =>
                setPage((current) => Math.min(pagination.total_pages || 1, current + 1))
              }
              className="rounded-2xl"
            >
              {labels.next}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}