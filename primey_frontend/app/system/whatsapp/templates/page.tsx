"use client";

/* ============================================================
   📂 app/system/whatsapp/templates/page.tsx
   🧠 Primey Care | WhatsApp Templates Page
   ------------------------------------------------------------
   ✅ إدارة قوالب WhatsApp
   ✅ عرض + بحث + فلاتر
   ✅ إنشاء / تعديل / تعطيل / حذف
   ✅ دعم عربي / إنجليزي عبر primey-locale
   ✅ يستخدم sonner
   ✅ بدون localhost
   ✅ أرقام إنجليزية
============================================================ */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  FileText,
  Filter,
  Languages,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  XCircle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ============================================================
   Types
============================================================ */

type AppLocale = "ar" | "en";

type WhatsAppTemplate = {
  id: number | string;
  scope_type?: string;
  company_reference?: string;
  company_name?: string;
  event_code?: string;
  template_key?: string;
  template_name?: string;
  language_code?: string;
  language?: string;
  message_type?: string;
  template_type?: string;
  header_text?: string;
  body_text?: string;
  body_preview?: string;
  footer_text?: string;
  button_text?: string;
  button_url?: string;
  meta_template_name?: string;
  meta_template_namespace?: string;
  approval_status?: string;
  provider_status?: string;
  rejection_reason?: string;
  is_default?: boolean;
  is_active?: boolean;
  version?: number;
  created_at?: string | null;
  updated_at?: string | null;
};

type TemplatesPayload = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  count?: number;
  results?: WhatsAppTemplate[];
  data?: WhatsAppTemplate[];
  item?: WhatsAppTemplate;
};

type TemplateForm = {
  id?: number | string | null;
  event_code: string;
  template_key: string;
  template_name: string;
  language_code: string;
  message_type: string;
  header_text: string;
  body_text: string;
  footer_text: string;
  button_text: string;
  button_url: string;
  meta_template_name: string;
  meta_template_namespace: string;
  approval_status: string;
  provider_status: string;
  rejection_reason: string;
  is_default: boolean;
  is_active: boolean;
};

/* ============================================================
   API Paths
============================================================ */

const API_PATHS = {
  dashboard: "/system/whatsapp",
  settings: "/system/whatsapp/settings",
  logs: "/system/whatsapp/logs",
  broadcasts: "/system/whatsapp/broadcasts",

  templates: "/api/whatsapp/templates/",
  create: "/api/whatsapp/templates/create/",
  update: (id: number | string) => `/api/whatsapp/templates/${id}/update/`,
  toggle: (id: number | string) => `/api/whatsapp/templates/${id}/toggle/`,
  delete: (id: number | string) => `/api/whatsapp/templates/${id}/delete/`,
} as const;

/* ============================================================
   Locale Helpers
============================================================ */

function readLocale(): AppLocale {
  try {
    if (typeof window === "undefined") return "ar";

    const savedLocale = window.localStorage.getItem("primey-locale");
    if (savedLocale === "en") return "en";
    if (savedLocale === "ar") return "ar";

    return document.documentElement.lang === "en" ? "en" : "ar";
  } catch {
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

/* ============================================================
   Helpers
============================================================ */

function getCookie(name: string) {
  if (typeof document === "undefined") return "";

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  return parts.length === 2 ? parts.pop()?.split(";").shift() || "" : "";
}

function getCSRFToken() {
  return getCookie("csrftoken") || getCookie("csrf_token") || "";
}

function safeString(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getResults(payload: TemplatesPayload | null): WhatsAppTemplate[] {
  if (!payload) return [];
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function approvalStatusClass(status: string) {
  const normalized = status.toUpperCase();

  if (normalized === "APPROVED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  if (normalized === "PENDING") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300";
  }

  if (normalized === "REJECTED") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300";
  }

  return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300";
}

function providerStatusClass(status: string) {
  const normalized = status.toUpperCase();

  if (["SYNCED", "APPROVED"].includes(normalized)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  if (["PENDING", "SYNCING"].includes(normalized)) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300";
  }

  if (["FAILED", "REJECTED"].includes(normalized)) {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300";
  }

  return "border-muted bg-muted text-muted-foreground";
}

function exportTemplatesCsv(items: WhatsAppTemplate[]) {
  const headers = [
    "id",
    "event_code",
    "template_key",
    "template_name",
    "language_code",
    "message_type",
    "approval_status",
    "provider_status",
    "is_default",
    "is_active",
    "version",
    "body_text",
    "created_at",
  ];

  const rows = items.map((item) => [
    item.id,
    item.event_code || "",
    item.template_key || "",
    item.template_name || "",
    item.language_code || item.language || "",
    item.message_type || item.template_type || "",
    item.approval_status || "",
    item.provider_status || "",
    item.is_default ? "true" : "false",
    item.is_active ? "true" : "false",
    item.version || "",
    item.body_text || item.body_preview || "",
    item.created_at || "",
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `primey-whatsapp-templates-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  anchor.click();

  URL.revokeObjectURL(url);
}

function emptyForm(): TemplateForm {
  return {
    id: null,
    event_code: "system_message",
    template_key: "",
    template_name: "",
    language_code: "ar",
    message_type: "TEXT",
    header_text: "",
    body_text: "",
    footer_text: "",
    button_text: "",
    button_url: "",
    meta_template_name: "",
    meta_template_namespace: "",
    approval_status: "DRAFT",
    provider_status: "NOT_SYNCED",
    rejection_reason: "",
    is_default: false,
    is_active: true,
  };
}

function formFromTemplate(item: WhatsAppTemplate): TemplateForm {
  return {
    id: item.id,
    event_code: safeString(item.event_code, "system_message"),
    template_key: safeString(item.template_key),
    template_name: safeString(item.template_name),
    language_code: safeString(item.language_code || item.language, "ar"),
    message_type: safeString(item.message_type || item.template_type, "TEXT"),
    header_text: safeString(item.header_text),
    body_text: safeString(item.body_text || item.body_preview),
    footer_text: safeString(item.footer_text),
    button_text: safeString(item.button_text),
    button_url: safeString(item.button_url),
    meta_template_name: safeString(item.meta_template_name),
    meta_template_namespace: safeString(item.meta_template_namespace),
    approval_status: safeString(item.approval_status, "DRAFT"),
    provider_status: safeString(item.provider_status, "NOT_SYNCED"),
    rejection_reason: safeString(item.rejection_reason),
    is_default: Boolean(item.is_default),
    is_active: Boolean(item.is_active),
  };
}

/* ============================================================
   Dictionary
============================================================ */

function dictionary(locale: AppLocale) {
  const ar = locale === "ar";

  return {
    pageTitle: ar ? "قوالب واتساب" : "WhatsApp Templates",
    pageSubtitle: ar
      ? "إدارة قوالب رسائل واتساب وربطها بأحداث الطلبات والفواتير والمدفوعات والعمولات."
      : "Manage WhatsApp message templates linked to orders, invoices, payments, and commissions.",

    back: ar ? "لوحة واتساب" : "WhatsApp Dashboard",
    settings: ar ? "الإعدادات" : "Settings",
    logs: ar ? "السجلات" : "Logs",
    broadcasts: ar ? "البث" : "Broadcasts",

    refresh: ar ? "تحديث" : "Refresh",
    export: ar ? "تصدير" : "Export",
    create: ar ? "قالب جديد" : "New Template",
    save: ar ? "حفظ القالب" : "Save Template",
    update: ar ? "تحديث القالب" : "Update Template",
    cancel: ar ? "إلغاء" : "Cancel",
    edit: ar ? "تعديل" : "Edit",
    delete: ar ? "حذف" : "Delete",
    toggle: ar ? "تفعيل / تعطيل" : "Toggle",
    copy: ar ? "نسخ" : "Copy",

    totalTemplates: ar ? "إجمالي القوالب" : "Total Templates",
    activeTemplates: ar ? "القوالب النشطة" : "Active Templates",
    approvedTemplates: ar ? "القوالب المعتمدة" : "Approved Templates",
    defaultTemplates: ar ? "القوالب الافتراضية" : "Default Templates",
    rejectedTemplates: ar ? "المرفوضة" : "Rejected",
    pendingTemplates: ar ? "قيد المراجعة" : "Pending",

    filters: ar ? "الفلاتر" : "Filters",
    search: ar ? "ابحث في القوالب..." : "Search templates...",
    all: ar ? "الكل" : "All",
    approvalStatus: ar ? "حالة الاعتماد" : "Approval Status",
    providerStatus: ar ? "حالة المزود" : "Provider Status",
    language: ar ? "اللغة" : "Language",
    eventCode: ar ? "كود الحدث" : "Event Code",
    activeStatus: ar ? "حالة التفعيل" : "Active Status",

    tableTitle: ar ? "قائمة القوالب" : "Templates List",
    tableDesc: ar
      ? "القوالب المستخدمة في إرسال رسائل واتساب من النظام."
      : "Templates used to send WhatsApp messages from the system.",
    template: ar ? "القالب" : "Template",
    event: ar ? "الحدث" : "Event",
    messageType: ar ? "نوع الرسالة" : "Message Type",
    body: ar ? "النص" : "Body",
    status: ar ? "الحالة" : "Status",
    createdAt: ar ? "تاريخ الإنشاء" : "Created At",
    actions: ar ? "الإجراءات" : "Actions",

    formTitleCreate: ar ? "إنشاء قالب واتساب" : "Create WhatsApp Template",
    formTitleEdit: ar ? "تعديل قالب واتساب" : "Edit WhatsApp Template",
    formDesc: ar
      ? "استخدم المتغيرات داخل النص مثل {{customer_name}} و {{invoice_number}}."
      : "Use variables inside text such as {{customer_name}} and {{invoice_number}}.",
    templateKey: ar ? "مفتاح القالب" : "Template Key",
    templateName: ar ? "اسم القالب" : "Template Name",
    headerText: ar ? "نص الرأس" : "Header Text",
    bodyText: ar ? "نص الرسالة" : "Message Body",
    footerText: ar ? "نص التذييل" : "Footer Text",
    buttonText: ar ? "نص الزر" : "Button Text",
    buttonUrl: ar ? "رابط الزر" : "Button URL",
    metaTemplateName: ar ? "Meta Template Name" : "Meta Template Name",
    metaNamespace: ar ? "Meta Namespace" : "Meta Namespace",
    rejectionReason: ar ? "سبب الرفض" : "Rejection Reason",
    isDefault: ar ? "قالب افتراضي" : "Default Template",
    isActive: ar ? "نشط" : "Active",

    noData: ar ? "لا توجد قوالب مطابقة." : "No matching templates.",
    loading: ar ? "جاري تحميل قوالب واتساب..." : "Loading WhatsApp templates...",
    loadFailed: ar ? "تعذر تحميل قوالب واتساب" : "Could not load WhatsApp templates",
    saved: ar ? "تم حفظ قالب واتساب" : "WhatsApp template saved",
    saveFailed: ar ? "تعذر حفظ القالب" : "Could not save template",
    deleted: ar ? "تم حذف القالب" : "Template deleted",
    deleteFailed: ar ? "تعذر حذف القالب" : "Could not delete template",
    toggled: ar ? "تم تحديث حالة القالب" : "Template status updated",
    toggleFailed: ar ? "تعذر تحديث حالة القالب" : "Could not update template status",
    copied: ar ? "تم نسخ النص" : "Copied",

    quickAccess: ar ? "الوصول السريع" : "Quick Access",
    quickAccessDesc: ar
      ? "روابط مباشرة لباقي صفحات واتساب."
      : "Direct links to other WhatsApp pages.",
    open: ar ? "فتح" : "Open",
  };
}

/* ============================================================
   Page
============================================================ */

export default function SystemWhatsAppTemplatesPage() {
  const [locale, setLocale] = useState<AppLocale>("ar");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [query, setQuery] = useState("");

  const [approvalFilter, setApprovalFilter] = useState("ALL");
  const [providerFilter, setProviderFilter] = useState("ALL");
  const [languageFilter, setLanguageFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TemplateForm>(() => emptyForm());

  const t = useMemo(() => dictionary(locale), [locale]);
  const dir = locale === "ar" ? "rtl" : "ltr";
  const isEditing = Boolean(form.id);

  const stats = useMemo(() => {
    const total = templates.length;
    const active = templates.filter((item) => item.is_active).length;
    const approved = templates.filter(
      (item) => safeString(item.approval_status).toUpperCase() === "APPROVED",
    ).length;
    const defaults = templates.filter((item) => item.is_default).length;
    const rejected = templates.filter(
      (item) => safeString(item.approval_status).toUpperCase() === "REJECTED",
    ).length;
    const pending = templates.filter(
      (item) => safeString(item.approval_status).toUpperCase() === "PENDING",
    ).length;

    return {
      total,
      active,
      approved,
      defaults,
      rejected,
      pending,
    };
  }, [templates]);

  const quickLinks = useMemo(
    () => [
      {
        href: API_PATHS.dashboard,
        icon: MessageCircle,
        title: t.back,
        description:
          locale === "ar"
            ? "الرجوع إلى لوحة واتساب الرئيسية."
            : "Return to WhatsApp dashboard.",
      },
      {
        href: API_PATHS.settings,
        icon: Settings,
        title: t.settings,
        description:
          locale === "ar"
            ? "إعداد الاتصال والتوكن والجلسة."
            : "Configure connection, tokens, and session.",
      },
      {
        href: API_PATHS.logs,
        icon: FileText,
        title: t.logs,
        description:
          locale === "ar"
            ? "متابعة سجلات الإرسال."
            : "Review delivery logs.",
      },
      {
        href: API_PATHS.broadcasts,
        icon: Send,
        title: t.broadcasts,
        description:
          locale === "ar"
            ? "إرسال رسائل واتساب جماعية."
            : "Send WhatsApp broadcasts.",
      },
    ],
    [locale, t],
  );

  async function loadTemplates(showToast = false) {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (query.trim()) params.set("q", query.trim());
      if (approvalFilter !== "ALL") params.set("status", approvalFilter);
      if (providerFilter !== "ALL") {
        params.set("provider_status", providerFilter);
      }
      if (languageFilter.trim()) {
        params.set("language_code", languageFilter.trim());
      }
      if (eventFilter.trim()) params.set("event_code", eventFilter.trim());
      if (activeFilter !== "ALL") {
        params.set("is_active", activeFilter === "ACTIVE" ? "true" : "false");
      }

      const url = params.toString()
        ? `${API_PATHS.templates}?${params.toString()}`
        : API_PATHS.templates;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = (await response.json().catch(() => null)) as TemplatesPayload | null;

      if (!response.ok) {
        toast.error(payload?.message || t.loadFailed);
        setTemplates([]);
        return;
      }

      setTemplates(getResults(payload));

      if (showToast) {
        toast.success(t.refresh);
      }
    } catch (error) {
      console.error("WhatsApp templates load failed:", error);
      toast.error(t.loadFailed);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveTemplate() {
    if (!form.event_code.trim()) {
      toast.error("event_code is required");
      return;
    }

    if (!form.template_key.trim()) {
      toast.error("template_key is required");
      return;
    }

    if (!form.body_text.trim()) {
      toast.error("body_text is required");
      return;
    }

    try {
      setSaving(true);

      const csrfToken = getCSRFToken();
      const url = isEditing && form.id ? API_PATHS.update(form.id) : API_PATHS.create;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
        body: JSON.stringify({
          event_code: form.event_code,
          template_key: form.template_key,
          template_name: form.template_name,
          language_code: form.language_code,
          message_type: form.message_type,
          header_text: form.header_text,
          body_text: form.body_text,
          footer_text: form.footer_text,
          button_text: form.button_text,
          button_url: form.button_url,
          meta_template_name: form.meta_template_name,
          meta_template_namespace: form.meta_template_namespace,
          approval_status: form.approval_status,
          provider_status: form.provider_status,
          rejection_reason: form.rejection_reason,
          is_default: form.is_default,
          is_active: form.is_active,
        }),
      });

      const payload = (await response.json().catch(() => null)) as TemplatesPayload | null;

      if (!response.ok) {
        toast.error(payload?.message || t.saveFailed);
        return;
      }

      toast.success(payload?.message || t.saved);
      setForm(emptyForm());
      setShowForm(false);
      await loadTemplates(false);
    } catch (error) {
      console.error("WhatsApp template save failed:", error);
      toast.error(t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function toggleTemplate(item: WhatsAppTemplate) {
    try {
      const csrfToken = getCSRFToken();

      const response = await fetch(API_PATHS.toggle(item.id), {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(payload?.message || t.toggleFailed);
        return;
      }

      toast.success(payload?.message || t.toggled);
      await loadTemplates(false);
    } catch (error) {
      console.error("WhatsApp template toggle failed:", error);
      toast.error(t.toggleFailed);
    }
  }

  async function deleteTemplate(item: WhatsAppTemplate) {
    const confirmed = window.confirm(
      locale === "ar"
        ? "هل تريد حذف هذا القالب؟"
        : "Do you want to delete this template?",
    );

    if (!confirmed) return;

    try {
      const csrfToken = getCSRFToken();

      const response = await fetch(API_PATHS.delete(item.id), {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(payload?.message || t.deleteFailed);
        return;
      }

      toast.success(payload?.message || t.deleted);
      await loadTemplates(false);
    } catch (error) {
      console.error("WhatsApp template delete failed:", error);
      toast.error(t.deleteFailed);
    }
  }

  function startCreate() {
    setForm(emptyForm());
    setShowForm(true);
  }

  function startEdit(item: WhatsAppTemplate) {
    setForm(formFromTemplate(item));
    setShowForm(true);
  }

  function resetFilters() {
    setQuery("");
    setApprovalFilter("ALL");
    setProviderFilter("ALL");
    setLanguageFilter("");
    setEventFilter("");
    setActiveFilter("ALL");

    window.setTimeout(() => {
      void loadTemplates(false);
    }, 0);
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t.copied);
    } catch {
      toast.error(t.copy);
    }
  }

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = readLocale();
      applyDocumentLocale(nextLocale);
      setLocale(nextLocale);
    };

    syncLocale();

    window.addEventListener("primey-locale-changed", syncLocale);
    window.addEventListener("storage", syncLocale);

    return () => {
      window.removeEventListener("primey-locale-changed", syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  useEffect(() => {
    void loadTemplates(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  return (
    <main dir={dir} className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.pageTitle}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-7">
            {t.pageSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href={API_PATHS.dashboard}>
              <ArrowRight className="size-4" />
              {t.back}
            </Link>
          </Button>

          <Button variant="outline" onClick={() => loadTemplates(true)}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
            {t.refresh}
          </Button>

          <Button
            variant="outline"
            onClick={() => exportTemplatesCsv(templates)}
            disabled={templates.length === 0}
          >
            <Download className="size-4" />
            {t.export}
          </Button>

          <Button onClick={startCreate}>
            <Plus className="size-4" />
            {t.create}
          </Button>
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title={t.totalTemplates} value={stats.total} icon={FileText} />
        <StatCard title={t.activeTemplates} value={stats.active} icon={CheckCircle2} />
        <StatCard title={t.approvedTemplates} value={stats.approved} icon={BadgeCheck} />
        <StatCard title={t.defaultTemplates} value={stats.defaults} icon={ShieldCheck} />
        <StatCard title={t.pendingTemplates} value={stats.pending} icon={Languages} />
        <StatCard title={t.rejectedTemplates} value={stats.rejected} icon={XCircle} />
      </section>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t.filters}</CardTitle>
          <CardDescription>
            {locale === "ar"
              ? "فلترة قوالب واتساب حسب الحدث واللغة وحالة الاعتماد."
              : "Filter WhatsApp templates by event, language, and approval status."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 xl:grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr_0.9fr_0.8fr_auto]">
            <div className="relative">
              <Search className="text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.search}
                className="ps-10"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void loadTemplates(false);
                }}
              />
            </div>

            <select
              value={approvalFilter}
              onChange={(event) => setApprovalFilter(event.target.value)}
              className="bg-background h-10 rounded-md border px-3 text-sm"
            >
              <option value="ALL">{t.all}</option>
              <option value="DRAFT">DRAFT</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>

            <select
              value={providerFilter}
              onChange={(event) => setProviderFilter(event.target.value)}
              className="bg-background h-10 rounded-md border px-3 text-sm"
            >
              <option value="ALL">{t.all}</option>
              <option value="NOT_SYNCED">NOT_SYNCED</option>
              <option value="SYNCING">SYNCING</option>
              <option value="SYNCED">SYNCED</option>
              <option value="FAILED">FAILED</option>
            </select>

            <Input
              value={languageFilter}
              onChange={(event) => setLanguageFilter(event.target.value)}
              placeholder={t.language}
            />

            <Input
              value={eventFilter}
              onChange={(event) => setEventFilter(event.target.value)}
              placeholder={t.eventCode}
            />

            <select
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
              className="bg-background h-10 rounded-md border px-3 text-sm"
            >
              <option value="ALL">{t.all}</option>
              <option value="ACTIVE">{t.isActive}</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <div className="flex gap-2">
              <Button onClick={() => loadTemplates(false)} disabled={loading}>
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Filter className="size-4" />
                )}
                {t.filters}
              </Button>

              <Button variant="outline" onClick={resetFilters}>
                {t.all}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_0.6fr]">
        {/* List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>{t.tableTitle}</CardTitle>
                <CardDescription>{t.tableDesc}</CardDescription>
              </div>

              <Badge variant="secondary">
                {t.totalTemplates}: {templates.length}
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-hidden rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.template}</TableHead>
                    <TableHead>{t.event}</TableHead>
                    <TableHead>{t.body}</TableHead>
                    <TableHead>{t.status}</TableHead>
                    <TableHead>{t.createdAt}</TableHead>
                    <TableHead>{t.actions}</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
                          <Loader2 className="size-4 animate-spin" />
                          {t.loading}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : templates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="text-muted-foreground py-12 text-center text-sm">
                          {t.noData}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    templates.map((item) => {
                      const approval = safeString(item.approval_status, "DRAFT");
                      const provider = safeString(
                        item.provider_status,
                        "NOT_SYNCED",
                      );

                      const body = safeString(
                        item.body_preview || item.body_text,
                        "-",
                      );

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">
                                {safeString(
                                  item.template_name || item.template_key,
                                  `Template #${item.id}`,
                                )}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {safeString(item.template_key, "-")}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {item.is_default ? (
                                  <Badge variant="outline">Default</Badge>
                                ) : null}
                                {item.is_active ? (
                                  <Badge variant="outline">Active</Badge>
                                ) : (
                                  <Badge variant="secondary">Inactive</Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant="secondary">
                                {safeString(item.event_code, "-")}
                              </Badge>
                              <div className="text-muted-foreground text-xs">
                                {safeString(
                                  item.message_type || item.template_type,
                                  "TEXT",
                                )}{" "}
                                · {safeString(item.language_code || item.language, "ar")}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="max-w-[360px] space-y-1">
                              <p className="line-clamp-2 text-sm leading-6">
                                {body}
                              </p>
                              <button
                                type="button"
                                onClick={() => copyText(body)}
                                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                              >
                                <Copy className="size-3.5" />
                                {t.copy}
                              </button>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="space-y-2">
                              <Badge className={approvalStatusClass(approval)}>
                                {approval}
                              </Badge>
                              <Badge className={providerStatusClass(provider)}>
                                {provider}
                              </Badge>
                              {item.rejection_reason ? (
                                <div className="text-red-600 line-clamp-2 text-xs">
                                  {item.rejection_reason}
                                </div>
                              ) : null}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="text-muted-foreground text-xs">
                              {formatDate(item.created_at)}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              v{item.version || 1}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEdit(item)}
                              >
                                <Edit3 className="size-4" />
                                {t.edit}
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleTemplate(item)}
                              >
                                {item.is_active ? (
                                  <XCircle className="size-4" />
                                ) : (
                                  <CheckCircle2 className="size-4" />
                                )}
                                {t.toggle}
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteTemplate(item)}
                              >
                                <Trash2 className="size-4" />
                                {t.delete}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Side */}
        <div className="space-y-4">
          {showForm ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {isEditing ? t.formTitleEdit : t.formTitleCreate}
                </CardTitle>
                <CardDescription>{t.formDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <Field label={t.eventCode}>
                  <Input
                    value={form.event_code}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        event_code: event.target.value,
                      }))
                    }
                    placeholder="order_created"
                  />
                </Field>

                <Field label={t.templateKey}>
                  <Input
                    value={form.template_key}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        template_key: event.target.value,
                      }))
                    }
                    placeholder="order_created_ar"
                  />
                </Field>

                <Field label={t.templateName}>
                  <Input
                    value={form.template_name}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        template_name: event.target.value,
                      }))
                    }
                    placeholder="Order Created Arabic"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={t.language}>
                    <select
                      value={form.language_code}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          language_code: event.target.value,
                        }))
                      }
                      className="bg-background h-10 w-full rounded-md border px-3 text-sm"
                    >
                      <option value="ar">ar</option>
                      <option value="en">en</option>
                    </select>
                  </Field>

                  <Field label={t.messageType}>
                    <select
                      value={form.message_type}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          message_type: event.target.value,
                        }))
                      }
                      className="bg-background h-10 w-full rounded-md border px-3 text-sm"
                    >
                      <option value="TEXT">TEXT</option>
                      <option value="TEMPLATE">TEMPLATE</option>
                      <option value="DOCUMENT">DOCUMENT</option>
                    </select>
                  </Field>
                </div>

                <Field label={t.headerText}>
                  <Input
                    value={form.header_text}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        header_text: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field label={t.bodyText}>
                  <textarea
                    value={form.body_text}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        body_text: event.target.value,
                      }))
                    }
                    rows={6}
                    className="bg-background w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="مرحبًا {{customer_name}}، تم إنشاء طلبك رقم {{order_number}}"
                  />
                </Field>

                <Field label={t.footerText}>
                  <Input
                    value={form.footer_text}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        footer_text: event.target.value,
                      }))
                    }
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={t.buttonText}>
                    <Input
                      value={form.button_text}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          button_text: event.target.value,
                        }))
                      }
                    />
                  </Field>

                  <Field label={t.buttonUrl}>
                    <Input
                      value={form.button_url}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          button_url: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={t.approvalStatus}>
                    <select
                      value={form.approval_status}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          approval_status: event.target.value,
                        }))
                      }
                      className="bg-background h-10 w-full rounded-md border px-3 text-sm"
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="PENDING">PENDING</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </Field>

                  <Field label={t.providerStatus}>
                    <select
                      value={form.provider_status}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          provider_status: event.target.value,
                        }))
                      }
                      className="bg-background h-10 w-full rounded-md border px-3 text-sm"
                    >
                      <option value="NOT_SYNCED">NOT_SYNCED</option>
                      <option value="SYNCING">SYNCING</option>
                      <option value="SYNCED">SYNCED</option>
                      <option value="FAILED">FAILED</option>
                    </select>
                  </Field>
                </div>

                {form.approval_status === "REJECTED" ? (
                  <Field label={t.rejectionReason}>
                    <Input
                      value={form.rejection_reason}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          rejection_reason: event.target.value,
                        }))
                      }
                    />
                  </Field>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <ToggleCard
                    label={t.isDefault}
                    checked={form.is_default}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, is_default: value }))
                    }
                  />

                  <ToggleCard
                    label={t.isActive}
                    checked={form.is_active}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, is_active: value }))
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Button onClick={saveTemplate} disabled={saving}>
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    {isEditing ? t.update : t.save}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setForm(emptyForm());
                    }}
                  >
                    {t.cancel}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t.quickAccess}</CardTitle>
                <CardDescription>{t.quickAccessDesc}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-3">
                <Button onClick={startCreate}>
                  <Plus className="size-4" />
                  {t.create}
                </Button>

                {quickLinks.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-2xl border p-4 transition hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl border bg-background p-2">
                            <Icon className="text-muted-foreground size-5" />
                          </div>

                          <div>
                            <p className="font-medium">{item.title}</p>
                            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-6">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        <Badge variant="secondary">{t.open}</Badge>
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </main>
  );
}

/* ============================================================
   Small Components
============================================================ */

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-5">
        <div>
          <p className="text-muted-foreground text-sm">{title}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
        </div>

        <div className="rounded-2xl border bg-background/70 p-3">
          <Icon className="text-muted-foreground size-6" />
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function ToggleCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition hover:bg-muted/50">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4"
      />
    </label>
  );
}