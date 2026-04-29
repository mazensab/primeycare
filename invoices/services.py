# ============================================================
# 📂 invoices/services.py
# 🧠 Invoice Services — Primey Care
# ------------------------------------------------------------
# ✅ إنشاء فاتورة من الطلب
# ✅ توليد رقم فاتورة آمن
# ✅ مزامنة عناصر الفاتورة من عناصر الطلب
# ✅ إصدار الفاتورة رسميًا
# ✅ جدولة الترحيل المحاسبي بعد commit
# ✅ منع paid أثناء الإصدار فقط
# ✅ إلغاء آمن بدون حذف مالي
# ✅ إدارة أخطاء واضحة + logging
# ============================================================

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from importlib import import_module
from typing import Any, Callable, Optional

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from invoices.models import (
    Invoice,
    InvoiceItem,
    InvoiceStatus,
    InvoiceType,
)

logger = logging.getLogger(__name__)


# ============================================================
# ⚙️ ثوابت عامة
# ============================================================

INVOICE_STATUS_DRAFT = InvoiceStatus.DRAFT
INVOICE_STATUS_ISSUED = InvoiceStatus.ISSUED
INVOICE_STATUS_CANCELLED = InvoiceStatus.CANCELLED
INVOICE_STATUS_PAID = InvoiceStatus.PAID
INVOICE_STATUS_PARTIALLY_PAID = InvoiceStatus.PARTIALLY_PAID

FINAL_PAYMENT_STATUSES = {
    INVOICE_STATUS_PAID,
    INVOICE_STATUS_PARTIALLY_PAID,
}

ISSUABLE_BASE_STATUSES = {
    INVOICE_STATUS_DRAFT,
    INVOICE_STATUS_ISSUED,
    INVOICE_STATUS_PAID,
    INVOICE_STATUS_PARTIALLY_PAID,
}

CANDIDATE_POSTING_TARGETS = [
    ("accounting.services.posting", "post_invoice_issue"),
    ("accounting.services.posting", "post_invoice"),
    ("accounting.services", "post_invoice_issue"),
    ("accounting.services", "post_invoice"),
    ("accounting.services.invoice_posting", "post_invoice_issue"),
    ("accounting.services.invoice_posting", "post_invoice"),
]


# ============================================================
# 🧱 استثناءات مخصصة
# ============================================================

class InvoiceServiceError(Exception):
    """الاستثناء الأساسي لخدمات الفواتير."""


class InvoiceValidationError(InvoiceServiceError):
    """خطأ تحقق منطقي أثناء معالجة الفاتورة."""


class InvoicePostingError(InvoiceServiceError):
    """خطأ أثناء الترحيل المحاسبي الخاص بالفاتورة."""


# ============================================================
# 📦 نتائج الخدمات
# ============================================================

@dataclass(slots=True)
class InvoiceCreateResult:
    invoice: Invoice
    created: bool
    message: str


@dataclass(slots=True)
class InvoiceIssueResult:
    invoice: Invoice
    status_before: str
    status_after: str
    accounting_post_requested: bool
    accounting_post_dispatched: bool
    accounting_post_message: str


@dataclass(slots=True)
class InvoiceCancelResult:
    invoice: Invoice
    status_before: str
    status_after: str
    message: str


# ============================================================
# 🛠️ Helpers عامة
# ============================================================

def _safe_getattr(obj: Any, attr_name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _first_non_empty(*values: Any) -> Any:
    for value in values:
        if value not in (None, "", [], {}, ()):
            return value
    return None


def _call_if_exists(obj: Any, method_name: str, *args: Any, **kwargs: Any) -> Any:
    method = getattr(obj, method_name, None)
    if callable(method):
        return method(*args, **kwargs)
    return None


def _money(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "0.00")).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def _resolve_invoice_identifier(invoice: Any) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(invoice, "invoice_number"),
            _safe_getattr(invoice, "number"),
            _safe_getattr(invoice, "code"),
            _safe_getattr(invoice, "pk"),
            "unknown-invoice",
        )
    )


def _resolve_invoice_status(invoice: Any) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(invoice, "status"),
            INVOICE_STATUS_DRAFT,
        )
    )


def _resolve_invoice_total(invoice: Any) -> Decimal:
    candidates = [
        _safe_getattr(invoice, "total_amount"),
        _safe_getattr(invoice, "grand_total"),
        _safe_getattr(invoice, "total"),
        _safe_getattr(invoice, "net_total"),
        _safe_getattr(invoice, "amount"),
    ]

    for value in candidates:
        if value is not None:
            resolved = _money(value)
            if resolved > Decimal("0.00"):
                return resolved

    return Decimal("0.00")


def _resolve_issue_date(invoice: Any) -> date:
    current_value = _first_non_empty(
        _safe_getattr(invoice, "issue_date"),
        _safe_getattr(invoice, "issued_date"),
        _safe_getattr(invoice, "invoice_date"),
        _safe_getattr(invoice, "date"),
    )

    if isinstance(current_value, date):
        return current_value

    return timezone.localdate()


def _resolve_order_customer(order: Any) -> Any:
    customer = _safe_getattr(order, "customer")
    if not customer:
        raise InvoiceValidationError("لا يمكن إنشاء فاتورة لأن الطلب غير مرتبط بعميل.")
    return customer


def _order_item_title(order_item: Any) -> str:
    candidates = [
        _safe_getattr(order_item, "title"),
        _safe_getattr(order_item, "name"),
        _safe_getattr(_safe_getattr(order_item, "product"), "name"),
        _safe_getattr(_safe_getattr(order_item, "program"), "name"),
        _safe_getattr(_safe_getattr(order_item, "service"), "name"),
        _safe_getattr(_safe_getattr(order_item, "service_item"), "name"),
        _safe_getattr(_safe_getattr(order_item, "product"), "title"),
        _safe_getattr(_safe_getattr(order_item, "program"), "title"),
        _safe_getattr(_safe_getattr(order_item, "service"), "title"),
    ]

    title = _first_non_empty(*candidates)
    return str(title or f"عنصر طلب #{_safe_getattr(order_item, 'id', '')}".strip())


def _order_item_unit_price(order_item: Any) -> Decimal:
    return _money(
        _first_non_empty(
            _safe_getattr(order_item, "unit_price"),
            _safe_getattr(order_item, "price"),
            _safe_getattr(order_item, "amount"),
        )
    )


def _order_item_total(order_item: Any) -> Decimal:
    return _money(
        _first_non_empty(
            _safe_getattr(order_item, "total_amount"),
            _safe_getattr(order_item, "line_total"),
            _safe_getattr(order_item, "total"),
        )
    )


def _order_item_discount(order_item: Any) -> Decimal:
    explicit_discount = _safe_getattr(order_item, "discount_amount")
    if explicit_discount not in (None, ""):
        return _money(explicit_discount)

    quantity = Decimal(str(_safe_getattr(order_item, "quantity", 1) or 1))
    unit_price = _order_item_unit_price(order_item)
    line_subtotal = _money(unit_price * quantity)
    line_total = _order_item_total(order_item)

    discount = _money(line_subtotal - line_total)
    if discount < Decimal("0.00"):
        return Decimal("0.00")

    return discount


def _generate_invoice_number(order: Any) -> str:
    today = timezone.localdate()
    date_part = today.strftime("%Y%m%d")
    order_id = str(_safe_getattr(order, "id", "0")).zfill(6)

    base = f"INV-{date_part}-{order_id}"

    if not Invoice.objects.filter(invoice_number=base).exists():
        return base

    for counter in range(2, 1000):
        candidate = f"{base}-{counter}"
        if not Invoice.objects.filter(invoice_number=candidate).exists():
            return candidate

    timestamp = timezone.now().strftime("%H%M%S%f")
    return f"{base}-{timestamp}"


def _resolve_posting_callable() -> Optional[Callable[..., Any]]:
    for module_path, function_name in CANDIDATE_POSTING_TARGETS:
        try:
            module = import_module(module_path)
            fn = getattr(module, function_name, None)

            if callable(fn):
                logger.info(
                    "✅ تم العثور على دالة الترحيل المحاسبي للفواتير: %s.%s",
                    module_path,
                    function_name,
                )
                return fn

        except Exception as exc:
            logger.debug(
                "تعذر تحميل %s.%s أثناء البحث عن دالة الترحيل: %s",
                module_path,
                function_name,
                exc,
            )

    logger.warning("⚠️ لم يتم العثور على دالة ترحيل محاسبي للفواتير.")
    return None


def _save_invoice(invoice: Invoice, update_fields: Optional[list[str]] = None) -> None:
    if update_fields:
        valid_update_fields = [field for field in update_fields if hasattr(invoice, field)]
        if valid_update_fields:
            invoice.save(update_fields=valid_update_fields)
            return

    invoice.save()


def _refresh_invoice(invoice: Invoice) -> None:
    invoice.refresh_from_db()


def _should_force_issued_status(status_before: str) -> bool:
    return status_before not in FINAL_PAYMENT_STATUSES


# ============================================================
# 🧾 إنشاء / مزامنة الفاتورة من الطلب
# ============================================================

def sync_invoice_items_from_order(invoice: Invoice, *, reset: bool = True) -> int:
    """
    مزامنة عناصر الفاتورة من عناصر الطلب.
    reset=True يعني إعادة بناء العناصر من الطلب لمنع التكرار.
    """
    if not invoice or not invoice.order_id:
        raise InvoiceValidationError("لا يمكن مزامنة عناصر فاتورة غير مرتبطة بطلب.")

    order_items = list(invoice.order.items.all().order_by("id"))

    if reset:
        invoice.items.all().delete()

    created_count = 0

    for index, order_item in enumerate(order_items, start=1):
        quantity = int(_safe_getattr(order_item, "quantity", 1) or 1)
        unit_price = _order_item_unit_price(order_item)
        discount_amount = _order_item_discount(order_item)

        InvoiceItem.objects.create(
            invoice=invoice,
            order_item=order_item,
            title=_order_item_title(order_item),
            quantity=quantity,
            unit_price=unit_price,
            discount_amount=discount_amount,
            sort_order=index,
        )

        created_count += 1

    invoice.recalculate_totals()
    invoice.refresh_payment_snapshot()
    invoice.sync_status()
    invoice.save(
        update_fields=[
            "subtotal",
            "discount_amount",
            "taxable_amount",
            "tax_amount",
            "total_amount",
            "paid_amount",
            "due_amount",
            "status",
            "updated_at",
        ]
    )

    return created_count


@transaction.atomic
def create_invoice_from_order(
    order: Any,
    *,
    actor: Any = None,
    invoice_type: str = InvoiceType.SALES,
    status: str = InvoiceStatus.DRAFT,
    issue_date: Optional[date] = None,
    due_date: Optional[date] = None,
    tax_rate: Decimal = Decimal("15.00"),
    notes: str = "",
    internal_notes: str = "",
    sync_items: bool = True,
    issue_immediately: bool = False,
    auto_post_accounting: bool = True,
) -> InvoiceCreateResult:
    """
    إنشاء فاتورة من الطلب.
    - يمنع التكرار لأن العلاقة OneToOne بين الطلب والفاتورة.
    - إذا كانت موجودة يرجعها بدل إنشاء نسخة جديدة.
    - يمكن إصدارها مباشرة عبر issue_immediately=True.
    """
    if order is None:
        raise InvoiceValidationError("order is required.")

    order_id = _safe_getattr(order, "id")
    if not order_id:
        raise InvoiceValidationError("لا يمكن إنشاء فاتورة من طلب غير محفوظ.")

    locked_order = order.__class__.objects.select_for_update().get(pk=order_id)
    customer = _resolve_order_customer(locked_order)

    existing_invoice = Invoice.objects.select_for_update().filter(order=locked_order).first()
    if existing_invoice:
        if sync_items and existing_invoice.status == InvoiceStatus.DRAFT:
            sync_invoice_items_from_order(existing_invoice, reset=True)

        if issue_immediately and existing_invoice.status == InvoiceStatus.DRAFT:
            issue_invoice(
                existing_invoice,
                actor=actor,
                auto_post_accounting=auto_post_accounting,
            )
            existing_invoice.refresh_from_db()

        return InvoiceCreateResult(
            invoice=existing_invoice,
            created=False,
            message="الفاتورة موجودة مسبقًا لهذا الطلب.",
        )

    if due_date is None:
        due_date = timezone.localdate() + timedelta(days=7)

    invoice_number = _generate_invoice_number(locked_order)

    try:
        invoice = Invoice.objects.create(
            order=locked_order,
            customer=customer,
            invoice_number=invoice_number,
            invoice_type=invoice_type,
            status=status,
            issue_date=issue_date,
            due_date=due_date,
            tax_rate=tax_rate,
            notes=notes,
            internal_notes=internal_notes,
        )
    except IntegrityError as exc:
        logger.exception("فشل إنشاء الفاتورة للطلب %s بسبب تعارض قاعدة البيانات.", order_id)
        raise InvoiceServiceError(f"فشل إنشاء الفاتورة للطلب {order_id}: {exc}") from exc

    if sync_items:
        sync_invoice_items_from_order(invoice, reset=True)

    if issue_immediately:
        issue_invoice(
            invoice,
            actor=actor,
            auto_post_accounting=auto_post_accounting,
        )
        invoice.refresh_from_db()

    return InvoiceCreateResult(
        invoice=invoice,
        created=True,
        message="تم إنشاء الفاتورة من الطلب بنجاح.",
    )


# ============================================================
# ✅ التحقق قبل الإصدار
# ============================================================

def validate_invoice_for_issue(invoice: Invoice) -> None:
    if invoice is None:
        raise InvoiceValidationError("لم يتم تمرير فاتورة صالحة.")

    invoice.refresh_from_db()

    status = _resolve_invoice_status(invoice)
    invoice_id = _resolve_invoice_identifier(invoice)

    invoice.recalculate_totals()
    invoice.refresh_payment_snapshot()

    total = _resolve_invoice_total(invoice)

    if status == INVOICE_STATUS_CANCELLED:
        raise InvoiceValidationError(
            f"لا يمكن إصدار الفاتورة {invoice_id} لأنها ملغاة."
        )

    if status not in ISSUABLE_BASE_STATUSES:
        raise InvoiceValidationError(
            f"لا يمكن إصدار الفاتورة {invoice_id} لأن حالتها الحالية غير مدعومة: {status}."
        )

    if total <= Decimal("0.00"):
        raise InvoiceValidationError(
            f"لا يمكن إصدار الفاتورة {invoice_id} لأن إجماليها غير صالح: {total}."
        )

    try:
        invoice.full_clean()
    except ValidationError as exc:
        raise InvoiceValidationError(
            f"فشل التحقق من الفاتورة قبل الإصدار: {exc}"
        ) from exc


# ============================================================
# 🧾 تهيئة الفاتورة قبل الحفظ
# ============================================================

def _prepare_invoice_issue_fields(invoice: Invoice, status_before: str) -> list[str]:
    changed_fields: list[str] = []
    today = _resolve_issue_date(invoice)

    if _should_force_issued_status(status_before):
        if invoice.status != INVOICE_STATUS_ISSUED:
            invoice.status = INVOICE_STATUS_ISSUED
            changed_fields.append("status")

    if not invoice.issue_date:
        invoice.issue_date = today
        changed_fields.append("issue_date")

    if hasattr(invoice, "updated_at"):
        if "updated_at" not in changed_fields:
            changed_fields.append("updated_at")

    return changed_fields


def _enforce_post_save_status(invoice: Invoice, status_before: str) -> None:
    expected_status = (
        INVOICE_STATUS_ISSUED
        if _should_force_issued_status(status_before)
        else status_before
    )

    invoice.refresh_from_db()
    current_status = _resolve_invoice_status(invoice)

    if current_status != expected_status:
        logger.warning(
            "⚠️ تم اكتشاف تغيير غير متوقع في حالة الفاتورة %s بعد الحفظ: %s -> %s. سيتم تثبيت الحالة الصحيحة %s.",
            _resolve_invoice_identifier(invoice),
            status_before,
            current_status,
            expected_status,
        )

        invoice.status = expected_status
        invoice.save(update_fields=["status", "updated_at"])
        invoice.refresh_from_db()


# ============================================================
# 📘 الترحيل المحاسبي
# ============================================================

def dispatch_invoice_accounting_post(invoice: Invoice, actor: Any = None) -> tuple[bool, str]:
    invoice_id = _resolve_invoice_identifier(invoice)
    posting_callable = _resolve_posting_callable()

    if posting_callable is None:
        message = (
            "لم يتم العثور على دالة ترحيل محاسبي للفواتير. "
            "تحقق من ربط accounting.services.posting."
        )
        logger.warning("Invoice %s: %s", invoice_id, message)
        return False, message

    try:
        invoice.refresh_from_db()

        try:
            posting_callable(invoice=invoice, actor=actor)
        except TypeError:
            try:
                posting_callable(invoice=invoice)
            except TypeError:
                posting_callable(invoice)

        message = f"تم إطلاق الترحيل المحاسبي للفواتير بنجاح للفاتورة {invoice_id}."
        logger.info(message)
        return True, message

    except Exception as exc:
        logger.exception(
            "❌ فشل الترحيل المحاسبي للفواتير للفاتورة %s: %s",
            invoice_id,
            exc,
        )
        raise InvoicePostingError(
            f"فشل الترحيل المحاسبي للفاتورة {invoice_id}: {exc}"
        ) from exc


# ============================================================
# 🚀 الخدمة الرسمية: إصدار الفاتورة
# ============================================================

@transaction.atomic
def issue_invoice(
    invoice: Invoice,
    *,
    actor: Any = None,
    auto_post_accounting: bool = True,
) -> InvoiceIssueResult:
    """
    إصدار الفاتورة رسميًا.

    مبدأ مهم:
    - issue != paid
    - الإصدار لا يحول الفاتورة إلى PAID
    - الدفع يتم عبر payments لاحقًا
    """
    if invoice is None:
        raise InvoiceValidationError("invoice is required.")

    invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)

    invoice_id = _resolve_invoice_identifier(invoice)
    status_before = _resolve_invoice_status(invoice)

    logger.info("🚀 بدء إصدار الفاتورة %s | status_before=%s", invoice_id, status_before)

    validate_invoice_for_issue(invoice)

    for method_name in ("recalculate_totals", "refresh_payment_snapshot", "sync_status"):
        try:
            _call_if_exists(invoice, method_name)
        except Exception as exc:
            logger.warning(
                "تعذر تنفيذ %s للفاتورة %s: %s",
                method_name,
                invoice_id,
                exc,
            )

    changed_fields = _prepare_invoice_issue_fields(invoice, status_before=status_before)

    _save_invoice(invoice, changed_fields)
    _refresh_invoice(invoice)

    _enforce_post_save_status(invoice, status_before=status_before)
    _refresh_invoice(invoice)

    accounting_post_dispatched = False
    accounting_post_message = "لم يُطلب الترحيل المحاسبي."

    if auto_post_accounting:
        invoice_pk = invoice.pk

        def _post_after_commit() -> None:
            fresh_invoice = Invoice.objects.get(pk=invoice_pk)
            dispatch_invoice_accounting_post(invoice=fresh_invoice, actor=actor)

        transaction.on_commit(_post_after_commit)
        accounting_post_message = "تم جدولة الترحيل المحاسبي بعد نجاح commit."
    else:
        accounting_post_message = "تم إصدار الفاتورة بدون ترحيل محاسبي تلقائي."

    _refresh_invoice(invoice)
    status_after = _resolve_invoice_status(invoice)

    logger.info(
        "✅ تم إصدار الفاتورة %s | status_after=%s | auto_post=%s",
        invoice_id,
        status_after,
        auto_post_accounting,
    )

    return InvoiceIssueResult(
        invoice=invoice,
        status_before=status_before,
        status_after=status_after,
        accounting_post_requested=auto_post_accounting,
        accounting_post_dispatched=accounting_post_dispatched,
        accounting_post_message=accounting_post_message,
    )


# ============================================================
# 🛑 إلغاء آمن للفاتورة
# ============================================================

@transaction.atomic
def cancel_invoice(
    invoice: Invoice,
    *,
    actor: Any = None,
    reason: str = "",
) -> InvoiceCancelResult:
    if invoice is None:
        raise InvoiceValidationError("invoice is required.")

    invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)

    status_before = invoice.status
    invoice_id = _resolve_invoice_identifier(invoice)

    if invoice.status == InvoiceStatus.CANCELLED:
        return InvoiceCancelResult(
            invoice=invoice,
            status_before=status_before,
            status_after=invoice.status,
            message="الفاتورة ملغاة مسبقًا.",
        )

    if invoice.paid_amount > Decimal("0.00"):
        raise InvoiceValidationError(
            f"لا يمكن إلغاء الفاتورة {invoice_id} لأنها تحتوي على مبلغ مدفوع."
        )

    invoice.status = InvoiceStatus.CANCELLED

    if reason:
        current_notes = invoice.internal_notes or ""
        invoice.internal_notes = f"{current_notes}\nسبب الإلغاء: {reason}".strip()

    invoice.save(update_fields=["status", "internal_notes", "updated_at"])
    invoice.refresh_from_db()

    logger.info(
        "🛑 تم إلغاء الفاتورة %s | actor=%s | reason=%s",
        invoice_id,
        actor,
        reason,
    )

    return InvoiceCancelResult(
        invoice=invoice,
        status_before=status_before,
        status_after=invoice.status,
        message="تم إلغاء الفاتورة بنجاح.",
    )


# ============================================================
# 🔁 إعادة الترحيل عند الحاجة
# ============================================================

def repost_invoice_accounting(invoice: Invoice, *, actor: Any = None) -> tuple[bool, str]:
    if invoice is None:
        raise InvoiceValidationError("invoice is required for reposting.")

    invoice_id = _resolve_invoice_identifier(invoice)
    logger.info("🔁 إعادة ترحيل محاسبي للفاتورة %s", invoice_id)

    return dispatch_invoice_accounting_post(invoice=invoice, actor=actor)