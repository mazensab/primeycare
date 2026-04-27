# ============================================================
# 📂 invoices/admin.py
# 🧠 Primey Care | Invoices Admin
# ------------------------------------------------------------
# ✅ إدارة الفواتير
# ✅ عناصر الفاتورة
# ✅ ربط الدفعات بالفواتير
# ============================================================

from django.contrib import admin

from .models import Invoice, InvoiceItem, InvoicePayment


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 0
    fields = (
        "order_item",
        "title",
        "quantity",
        "unit_price",
        "discount_amount",
        "line_total",
        "sort_order",
    )
    readonly_fields = ("line_total",)


class InvoicePaymentInline(admin.TabularInline):
    model = InvoicePayment
    extra = 0
    fields = (
        "payment",
        "amount_applied",
        "applied_at",
        "notes",
    )
    readonly_fields = ("applied_at",)


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "invoice_number",
        "order",
        "customer",
        "invoice_type",
        "status",
        "subtotal",
        "discount_amount",
        "tax_amount",
        "total_amount",
        "paid_amount",
        "due_amount",
        "issue_date",
        "due_date",
        "created_at",
    )
    list_filter = (
        "invoice_type",
        "status",
        "issue_date",
        "due_date",
        "created_at",
    )
    search_fields = (
        "invoice_number",
        "order__id",
        "customer__name",
        "customer__phone",
        "customer__email",
        "notes",
        "internal_notes",
    )
    readonly_fields = (
        "subtotal",
        "discount_amount",
        "taxable_amount",
        "tax_amount",
        "total_amount",
        "paid_amount",
        "due_amount",
        "created_at",
        "updated_at",
    )
    ordering = ("-created_at",)
    inlines = [InvoiceItemInline, InvoicePaymentInline]


@admin.register(InvoiceItem)
class InvoiceItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "invoice",
        "title",
        "order_item",
        "quantity",
        "unit_price",
        "discount_amount",
        "line_total",
        "sort_order",
        "created_at",
    )
    list_filter = (
        "invoice",
        "created_at",
    )
    search_fields = (
        "title",
        "invoice__invoice_number",
        "invoice__customer__name",
    )
    readonly_fields = (
        "line_total",
        "created_at",
        "updated_at",
    )
    ordering = ("invoice", "sort_order", "id")


@admin.register(InvoicePayment)
class InvoicePaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "invoice",
        "payment",
        "amount_applied",
        "applied_at",
    )
    list_filter = (
        "applied_at",
    )
    search_fields = (
        "invoice__invoice_number",
        "payment__payment_number",
        "notes",
    )
    readonly_fields = (
        "applied_at",
    )
    ordering = ("-applied_at",)