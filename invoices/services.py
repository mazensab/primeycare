# ============================================================
# 📂 invoices/services.py
# 🧠 Invoice Services — Primey Care V1.2
# ------------------------------------------------------------
# ✅ طبقة خدمات رسمية لإدارة دورة الفاتورة
# ✅ إصدار الفاتورة بشكل آمن ومنظم
# ✅ أتمتة الترحيل المحاسبي عند إصدار الفاتورة
# ✅ منع تغيير الحالة إلى PAID أثناء الإصدار
# ✅ الحفاظ على حالة السداد إذا كانت الفاتورة مدفوعة/مدفوعة جزئيًا
# ✅ مراعاة idempotency قدر الإمكان عبر الاعتماد على طبقة الترحيل
# ✅ إدارة أخطاء واضحة + logging
# ============================================================

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from importlib import import_module
from typing import Any, Callable, Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


# ============================================================
# ⚙️ ثوابت عامة
# ============================================================

INVOICE_STATUS_DRAFT = "DRAFT"
INVOICE_STATUS_PENDING = "PENDING"
INVOICE_STATUS_ISSUED = "ISSUED"
INVOICE_STATUS_CANCELLED = "CANCELLED"
INVOICE_STATUS_PAID = "PAID"
INVOICE_STATUS_PARTIALLY_PAID = "PARTIALLY_PAID"

FINAL_PAYMENT_STATUSES = {
    INVOICE_STATUS_PAID,
    INVOICE_STATUS_PARTIALLY_PAID,
}

ISSUABLE_BASE_STATUSES = {
    INVOICE_STATUS_DRAFT,
    INVOICE_STATUS_PENDING,
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
# 📦 نتيجة الخدمة
# ============================================================

@dataclass(slots=True)
class InvoiceIssueResult:
    invoice: Any
    status_before: str
    status_after: str
    accounting_post_requested: bool
    accounting_post_dispatched: bool
    accounting_post_message: str


# ============================================================
# 🛠️ Helpers عامة
# ============================================================

def _safe_getattr(obj: Any, attr_name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _call_if_exists(obj: Any, method_name: str, *args: Any, **kwargs: Any) -> Any:
    method = getattr(obj, method_name, None)
    if callable(method):
        return method(*args, **kwargs)
    return None


def _first_non_empty(*values: Any) -> Any:
    for value in values:
        if value not in (None, "", [], {}, ()):
            return value
    return None


def _resolve_invoice_identifier(invoice: Any) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(invoice, "number"),
            _safe_getattr(invoice, "invoice_number"),
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
        _safe_getattr(invoice, "grand_total"),
        _safe_getattr(invoice, "total_amount"),
        _safe_getattr(invoice, "total"),
        _safe_getattr(invoice, "net_total"),
        _safe_getattr(invoice, "amount"),
    ]
    for value in candidates:
        if value is not None:
            try:
                return Decimal(str(value))
            except Exception:
                continue
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
            continue

    logger.warning("⚠️ لم يتم العثور على دالة ترحيل محاسبي للفواتير.")
    return None


def _save_invoice(invoice: Any, update_fields: list[str]) -> None:
    valid_update_fields = [field for field in update_fields if hasattr(invoice, field)]
    if valid_update_fields:
        invoice.save(update_fields=valid_update_fields)
    else:
        invoice.save()


def _refresh_invoice(invoice: Any) -> None:
    refresh = getattr(invoice, "refresh_from_db", None)
    if callable(refresh):
        refresh()


def _should_force_issued_status(status_before: str) -> bool:
    return status_before not in FINAL_PAYMENT_STATUSES


# ============================================================
# ✅ التحقق قبل الإصدار
# ============================================================

def validate_invoice_for_issue(invoice: Any) -> None:
    if invoice is None:
        raise InvoiceValidationError("لم يتم تمرير فاتورة صالحة.")

    status = _resolve_invoice_status(invoice)
    invoice_id = _resolve_invoice_identifier(invoice)
    total = _resolve_invoice_total(invoice)

    if status == INVOICE_STATUS_CANCELLED:
        raise InvoiceValidationError(
            f"لا يمكن إصدار الفاتورة {invoice_id} لأنها ملغاة."
        )

    if status not in ISSUABLE_BASE_STATUSES:
        raise InvoiceValidationError(
            f"لا يمكن إصدار الفاتورة {invoice_id} لأن حالتها الحالية غير مدعومة: {status}."
        )

    if status in {INVOICE_STATUS_ISSUED, INVOICE_STATUS_PAID, INVOICE_STATUS_PARTIALLY_PAID}:
        logger.info(
            "الفاتورة %s في حالة %s مسبقًا. سيتم التعامل معها كعملية آمنة.",
            invoice_id,
            status,
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
    except Exception as exc:
        logger.debug(
            "تم تجاهل full_clean لعدم توافقه الكامل مع الحالة الحالية للفاتورة %s: %s",
            invoice_id,
            exc,
        )


# ============================================================
# 🧾 تهيئة الفاتورة قبل الحفظ
# ============================================================

def _prepare_invoice_issue_fields(invoice: Any, status_before: str) -> list[str]:
    changed_fields: list[str] = []
    today = _resolve_issue_date(invoice)
    now = timezone.now()

    if _should_force_issued_status(status_before) and hasattr(invoice, "status"):
        if invoice.status != INVOICE_STATUS_ISSUED:
            invoice.status = INVOICE_STATUS_ISSUED
            changed_fields.append("status")

    for field_name in ("issue_date", "issued_date", "invoice_date"):
        if hasattr(invoice, field_name) and not getattr(invoice, field_name):
            setattr(invoice, field_name, today)
            changed_fields.append(field_name)
            break

    for field_name in ("issued_at",):
        if hasattr(invoice, field_name) and not getattr(invoice, field_name):
            setattr(invoice, field_name, now)
            changed_fields.append(field_name)
            break

    if hasattr(invoice, "updated_at"):
        invoice.updated_at = now
        if "updated_at" not in changed_fields:
            changed_fields.append("updated_at")

    return changed_fields


def _enforce_post_save_status(invoice: Any, status_before: str) -> None:
    if not hasattr(invoice, "status"):
        return

    expected_status = (
        INVOICE_STATUS_ISSUED
        if _should_force_issued_status(status_before)
        else status_before
    )
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
        _save_invoice(invoice, ["status"])
        _refresh_invoice(invoice)


# ============================================================
# 📘 الترحيل المحاسبي
# ============================================================

def dispatch_invoice_accounting_post(invoice: Any, actor: Any = None) -> tuple[bool, str]:
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
    invoice: Any,
    *,
    actor: Any = None,
    auto_post_accounting: bool = True,
) -> InvoiceIssueResult:
    """
    إصدار الفاتورة رسميًا مع إطلاق الترحيل المحاسبي تلقائيًا بعد نجاح الحفظ.

    مبدأ مهم:
    - issue != paid
    - الإصدار لا يجب أن يحول الفاتورة إلى PAID
    """
    if invoice is None:
        raise InvoiceValidationError("invoice is required.")

    invoice_id = _resolve_invoice_identifier(invoice)
    status_before = _resolve_invoice_status(invoice)

    logger.info("🚀 بدء إصدار الفاتورة %s | status_before=%s", invoice_id, status_before)

    validate_invoice_for_issue(invoice)

    changed_fields = _prepare_invoice_issue_fields(invoice, status_before=status_before)

    for method_name in ("recalculate_totals", "calculate_totals", "refresh_totals"):
        try:
            _call_if_exists(invoice, method_name)
        except Exception as exc:
            logger.warning(
                "تعذر تنفيذ %s للفاتورة %s: %s",
                method_name,
                invoice_id,
                exc,
            )

    _save_invoice(invoice, changed_fields)
    _refresh_invoice(invoice)
    _enforce_post_save_status(invoice, status_before=status_before)
    _refresh_invoice(invoice)

    accounting_post_dispatched = False
    accounting_post_message = "لم يُطلب الترحيل المحاسبي."

    if auto_post_accounting:
        def _post_after_commit() -> None:
            nonlocal accounting_post_dispatched, accounting_post_message
            success, message = dispatch_invoice_accounting_post(invoice=invoice, actor=actor)
            accounting_post_dispatched = success
            accounting_post_message = message

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
# 🔁 خدمة مساعدة لإعادة الترحيل عند الحاجة
# ============================================================

def repost_invoice_accounting(invoice: Any, *, actor: Any = None) -> tuple[bool, str]:
    if invoice is None:
        raise InvoiceValidationError("invoice is required for reposting.")

    invoice_id = _resolve_invoice_identifier(invoice)
    logger.info("🔁 إعادة ترحيل محاسبي للفاتورة %s", invoice_id)

    return dispatch_invoice_accounting_post(invoice=invoice, actor=actor)