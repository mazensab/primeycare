# ================================================================
# 📂 system_log/models.py
# 🧠 Primey Care - System Log Models
# ------------------------------------------------
# ✅ متوافق مع Primey Care
# ✅ بدون أي اعتماد على company_manager
# ✅ يدعم مراجع مرنة للشركة / الجهة
# ✅ مناسب للتسجيل التشغيلي و Audit Trail
# ================================================================

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()


class SystemLog(models.Model):
    # ------------------------------------------------------------
    # 🟦 Scope / Company Reference
    # ------------------------------------------------------------
    scope_type = models.CharField(
        max_length=30,
        default="SYSTEM",
        db_index=True,
        verbose_name="نوع النطاق",
        help_text="SYSTEM / COMPANY / OTHER",
    )

    company_reference = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        verbose_name="مرجع الجهة / الشركة",
    )

    company_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="اسم الجهة / الشركة",
    )

    # ------------------------------------------------------------
    # 👤 User
    # ------------------------------------------------------------
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_logs",
        verbose_name="المستخدم المنفّذ",
    )

    # ------------------------------------------------------------
    # 🧩 Event Info
    # ------------------------------------------------------------
    module = models.CharField(
        max_length=100,
        verbose_name="الوحدة",
        help_text="مثال: customers, invoices, whatsapp, payments",
    )

    action = models.CharField(
        max_length=100,
        verbose_name="الإجراء",
        help_text="مثال: create, update, delete, sync, login",
    )

    event_code = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        verbose_name="رمز الحدث",
    )

    # ------------------------------------------------------------
    # 🟧 Severity
    # ------------------------------------------------------------
    SEVERITY_CHOICES = [
        ("info", "معلومة"),
        ("warning", "تحذير"),
        ("error", "خطأ"),
        ("critical", "حرج"),
    ]

    severity = models.CharField(
        max_length=20,
        choices=SEVERITY_CHOICES,
        default="info",
        db_index=True,
        verbose_name="مستوى الخطورة",
    )

    # ------------------------------------------------------------
    # 🟨 Message / Metadata
    # ------------------------------------------------------------
    message = models.TextField(
        verbose_name="الرسالة",
        help_text="وصف الحدث الذي حصل داخل النظام",
    )

    path = models.CharField(
        max_length=500,
        blank=True,
        default="",
        verbose_name="المسار",
    )

    method = models.CharField(
        max_length=20,
        blank=True,
        default="",
        verbose_name="الطريقة",
    )

    status_code = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="رمز الاستجابة",
    )

    ip_address = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="عنوان IP",
    )

    extra_data = models.JSONField(
        null=True,
        blank=True,
        verbose_name="بيانات إضافية",
        help_text="تخزين أي تفاصيل إضافية (مثل قبل/بعد التعديل)",
    )

    # ------------------------------------------------------------
    # 🟩 Time
    # ------------------------------------------------------------
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="وقت الإنشاء",
    )

    class Meta:
        verbose_name = "سجل نظام"
        verbose_name_plural = "سجلات النظام"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["scope_type", "created_at"]),
            models.Index(fields=["company_reference", "created_at"]),
            models.Index(fields=["module", "created_at"]),
            models.Index(fields=["severity", "created_at"]),
            models.Index(fields=["event_code", "created_at"]),
        ]

    def __str__(self):
        return f"[{self.created_at}] {self.module} → {self.action}"