# ============================================================
# 📂 payments/services.py
# 🧠 Primey Care | Payment Services
# ------------------------------------------------------------
# ✅ إنشاء دفعة مرتبطة بفاتورة / طلب / عميل
# ✅ تأكيد الدفع
# ✅ تحديث حالة الفاتورة قدر الإمكان
# ✅ جدولة حركة الخزينة بعد commit
# ✅ جدولة الترحيل المحاسبي بعد commit
# ✅ إلغاء آمن للدفعات غير المؤكدة
# ✅ منع التكرار قدر الإمكان
# ============================================================

from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal
from importlib import import_module
from typing import Any, Callable, Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import Payment, PaymentMethod, PaymentProvider, PaymentStatus

logger = logging.getLogger(__name__)


# ============================================================
# ⚙️ دوال مرشحة للربط مع الخزينة والمحاسبة
# ============================================================

CANDIDATE_ACCOUNTING_POSTING_TARGETS = [
    ("accounting.services.posting", "post_payment_confirm"),
    ("accounting.services.posting", "post_payment_confirmation"),
    ("accounting.services.posting", "post_payment"),
    ("accounting.services", "post_payment_confirm"),
    ("accounting.services", "post_payment_confirmation"),
    ("accounting.services", "post_payment"),
    ("accounting.services.payment_posting", "post_payment_confirm"),
    ("accounting.services.payment_posting", "post_payment_confirmation"),
    ("accounting.services.payment_posting", "post_payment"),
]

CANDIDATE_TREASURY_TARGETS = [
    ("treasury.services", "create_payment_treasury_movement"),
    ("treasury.services", "create_payment_receipt_movement"),
    ("treasury.services.movements", "create_payment_treasury_movement"),
    ("treasury.services.movements", "create_payment_receipt_movement"),
    ("treasury.services.posting", "create_payment_treasury_movement"),
    ("treasury.services.posting", "create_payment_receipt_movement"),
]


# ============================================================
# 🧱 استثناءات مخصصة
# ============================================================

class PaymentServiceError(Exception):
    """الاستثناء الأساسي لخدمات الدفعات."""


class PaymentValidationError(PaymentServiceError):
    """خطأ تحقق منطقي أثناء معالجة الدفعة."""


class PaymentTreasuryError(PaymentServiceError):
    """خطأ أثناء إنشاء حركة الخزينة الخاصة بالدفعة."""


class PaymentPostingError(PaymentServiceError):
    """خطأ أثناء الترحيل المحاسبي الخاص بالدفعة."""


# ============================================================
# 📦 نتائج الخدمات
# ============================================================

@dataclass(slots=True)
class PaymentCreateResult:
    payment: Payment
    created: bool


@dataclass(slots=True)
class PaymentConfirmationResult:
    payment: Payment
    status_before: str
    status_after: str
    treasury_requested: bool
    treasury_dispatched: bool
    treasury_message: str
    accounting_post_requested: bool
    accounting_post_dispatched: bool
    accounting_post_message: str


@dataclass(slots=True)
class PaymentCancelResult:
    payment: Payment
    status_before: str
    status_after: str


# ============================================================
# 🛠️ Helpers عامة
# ============================================================

def _safe_decimal(value: Any, default: Decimal = Decimal("0.00")) -> Decimal:
    if value in (None, ""):
        return default

    try:
        return Decimal(str(value))
    except Exception:
        return default


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


def _resolve_payment_identifier(payment: Payment) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(payment, "payment_number"),
            _safe_getattr(payment, "reference"),
            _safe_getattr(payment, "number"),
            _safe_getattr(payment, "code"),
            _safe_getattr(payment, "pk"),
            "unknown-payment",
        )
    )


def _resolve_import_callable(candidates: list[tuple[str, str]]) -> Optional[Callable[..., Any]]:
    for module_path, function_name in candidates:
        try:
            module = import_module(module_path)
            fn = getattr(module, function_name, None)
            if callable(fn):
                logger.info("✅ تم العثور على الدالة: %s.%s", module_path, function_name)
                return fn
        except Exception as exc:
            logger.debug(
                "تعذر تحميل %s.%s أثناء البحث عن الدالة المطلوبة: %s",
                module_path,
                function_name,
                exc,
            )
            continue

    return None


def _call_with_fallbacks(fn: Callable[..., Any], payment: Payment, actor: Any = None) -> Any:
    try:
        return fn(payment=payment, actor=actor)
    except TypeError:
        try:
            return fn(payment=payment)
        except TypeError:
            return fn(payment)


def _refresh_payment(payment: Payment) -> None:
    payment.refresh_from_db()


def _get_invoice_total(invoice: Any) -> Decimal:
    return _safe_decimal(
        _first_non_empty(
            _safe_getattr(invoice, "total_amount"),
            _safe_getattr(invoice, "grand_total"),
            _safe_getattr(invoice, "net_amount"),
            _safe_getattr(invoice, "amount"),
            _safe_getattr(invoice, "total"),
        )
    )


def _get_invoice_paid_amount(invoice: Any) -> Decimal:
    return _safe_decimal(
        _first_non_empty(
            _safe_getattr(invoice, "paid_amount"),
            _safe_getattr(invoice, "amount_paid"),
            _safe_getattr(invoice, "collected_amount"),
        )
    )


def _set_invoice_status(invoice: Any, paid_amount: Decimal, total_amount: Decimal) -> list[str]:
    changed_fields: list[str] = []

    if hasattr(invoice, "paid_amount"):
        invoice.paid_amount = paid_amount
        changed_fields.append("paid_amount")

    if hasattr(invoice, "amount_paid"):
        invoice.amount_paid = paid_amount
        changed_fields.append("amount_paid")

    if hasattr(invoice, "collected_amount"):
        invoice.collected_amount = paid_amount
        changed_fields.append("collected_amount")

    if hasattr(invoice, "paid_at") and paid_amount >= total_amount and total_amount > Decimal("0.00"):
        if not getattr(invoice, "paid_at", None):
            invoice.paid_at = timezone.now()
            changed_fields.append("paid_at")

    if hasattr(invoice, "status"):
        if paid_amount <= Decimal("0.00"):
            new_status = "ISSUED"
        elif total_amount > Decimal("0.00") and paid_amount < total_amount:
            new_status = "PARTIALLY_PAID"
        else:
            new_status = "PAID"

        invoice.status = new_status
        changed_fields.append("status")

    if hasattr(invoice, "updated_at"):
        invoice.updated_at = timezone.now()
        changed_fields.append("updated_at")

    return list(dict.fromkeys(changed_fields))


def _update_invoice_after_payment(payment: Payment) -> None:
    invoice = getattr(payment, "invoice", None)
    if not invoice:
        return

    total_amount = _get_invoice_total(invoice)

    confirmed_payments = Payment.objects.filter(
        invoice=invoice,
        status__in=[
            PaymentStatus.PAID,
            PaymentStatus.PARTIALLY_PAID,
            PaymentStatus.PARTIALLY_REFUNDED,
            PaymentStatus.REFUNDED,
        ],
    )

    paid_amount = Decimal("0.00")
    for item in confirmed_payments:
        paid_amount += _safe_decimal(item.paid_amount) - _safe_decimal(item.refunded_amount)

    if paid_amount < Decimal("0.00"):
        paid_amount = Decimal("0.00")

    changed_fields = _set_invoice_status(
        invoice=invoice,
        paid_amount=paid_amount,
        total_amount=total_amount,
    )

    if changed_fields:
        try:
            invoice.save(update_fields=changed_fields)
        except Exception:
            invoice.save()

    logger.info(
        "✅ تم تحديث حالة الفاتورة بعد الدفع | invoice=%s | paid=%s | total=%s",
        getattr(invoice, "pk", None),
        paid_amount,
        total_amount,
    )


# ============================================================
# ✅ التحقق
# ============================================================

def validate_payment_for_confirmation(payment: Payment) -> None:
    if payment is None:
        raise PaymentValidationError("لم يتم تمرير دفعة صالحة.")

    payment_id = _resolve_payment_identifier(payment)

    if payment.status in {
        PaymentStatus.FAILED,
        PaymentStatus.CANCELLED,
        PaymentStatus.REFUNDED,
    }:
        raise PaymentValidationError(
            f"لا يمكن تأكيد الدفعة {payment_id} لأن حالتها الحالية هي {payment.status}."
        )

    if payment.amount <= Decimal("0.00"):
        raise PaymentValidationError(
            f"لا يمكن تأكيد الدفعة {payment_id} لأن مبلغها غير صالح: {payment.amount}."
        )

    try:
        payment.full_clean()
    except ValidationError as exc:
        raise PaymentValidationError(
            f"فشل التحقق من الدفعة قبل التأكيد: {exc}"
        ) from exc


def validate_payment_for_cancel(payment: Payment) -> None:
    if payment is None:
        raise PaymentValidationError("لم يتم تمرير دفعة صالحة.")

    payment_id = _resolve_payment_identifier(payment)

    if payment.status in {
        PaymentStatus.PAID,
        PaymentStatus.PARTIALLY_PAID,
        PaymentStatus.REFUNDED,
        PaymentStatus.PARTIALLY_REFUNDED,
    }:
        raise PaymentValidationError(
            f"لا يمكن إلغاء الدفعة {payment_id} لأنها مؤكدة أو مستردة."
        )

    if payment.paid_amount > Decimal("0.00"):
        raise PaymentValidationError(
            f"لا يمكن إلغاء الدفعة {payment_id} لأنها تحتوي على مبلغ مدفوع."
        )


# ============================================================
# 🏦 حركة الخزينة
# ============================================================

def dispatch_payment_treasury_movement(payment: Payment, actor: Any = None) -> tuple[bool, str]:
    payment_id = _resolve_payment_identifier(payment)

    if payment.is_treasury_posted:
        message = f"تم تجاوز إنشاء حركة الخزينة لأن الدفعة {payment_id} مرحلة خزينة مسبقًا."
        logger.info(message)
        return True, message

    treasury_callable = _resolve_import_callable(CANDIDATE_TREASURY_TARGETS)

    if treasury_callable is None:
        message = (
            "لم يتم العثور على دالة إنشاء حركة خزينة للدفعات. "
            "تحقق من ربط treasury.services."
        )
        logger.warning("Payment %s: %s", payment_id, message)
        return False, message

    try:
        result = _call_with_fallbacks(treasury_callable, payment=payment, actor=actor)

        update_fields = ["is_treasury_posted", "updated_at"]
        payment.is_treasury_posted = True

        reference = _first_non_empty(
            _safe_getattr(result, "reference"),
            _safe_getattr(result, "movement_number"),
            _safe_getattr(result, "number"),
            _safe_getattr(result, "id"),
        )
        if reference and hasattr(payment, "treasury_movement_reference"):
            payment.treasury_movement_reference = str(reference)
            update_fields.append("treasury_movement_reference")

        payment.save(update_fields=update_fields)

        message = f"تم إنشاء/إطلاق حركة الخزينة بنجاح للدفعة {payment_id}."
        logger.info(message)
        return True, message

    except Exception as exc:
        logger.exception("❌ فشل إنشاء حركة الخزينة للدفعة %s: %s", payment_id, exc)
        raise PaymentTreasuryError(
            f"فشل إنشاء حركة الخزينة للدفعة {payment_id}: {exc}"
        ) from exc


# ============================================================
# 📘 الترحيل المحاسبي
# ============================================================

def dispatch_payment_accounting_post(payment: Payment, actor: Any = None) -> tuple[bool, str]:
    payment_id = _resolve_payment_identifier(payment)

    if payment.is_accounting_posted:
        message = f"تم تجاوز الترحيل المحاسبي لأن الدفعة {payment_id} مرحلة محاسبيًا مسبقًا."
        logger.info(message)
        return True, message

    posting_callable = _resolve_import_callable(CANDIDATE_ACCOUNTING_POSTING_TARGETS)

    if posting_callable is None:
        message = (
            "لم يتم العثور على دالة ترحيل محاسبي للدفعات. "
            "تحقق من ربط accounting.services.posting."
        )
        logger.warning("Payment %s: %s", payment_id, message)
        return False, message

    try:
        result = _call_with_fallbacks(posting_callable, payment=payment, actor=actor)

        update_fields = ["is_accounting_posted", "updated_at"]
        payment.is_accounting_posted = True

        reference = _first_non_empty(
            _safe_getattr(result, "entry_number"),
            _safe_getattr(result, "journal_number"),
            _safe_getattr(result, "reference"),
            _safe_getattr(result, "number"),
            _safe_getattr(result, "id"),
        )
        if reference and hasattr(payment, "accounting_entry_reference"):
            payment.accounting_entry_reference = str(reference)
            update_fields.append("accounting_entry_reference")

        payment.save(update_fields=update_fields)

        message = f"تم الترحيل المحاسبي للدفعة بنجاح للدفعة {payment_id}."
        logger.info(message)
        return True, message

    except Exception as exc:
        logger.exception("❌ فشل الترحيل المحاسبي للدفعة %s: %s", payment_id, exc)
        raise PaymentPostingError(
            f"فشل الترحيل المحاسبي للدفعة {payment_id}: {exc}"
        ) from exc


# ============================================================
# 🧾 إنشاء دفعة
# ============================================================

@transaction.atomic
def create_payment(
    *,
    order: Any,
    customer: Any,
    amount: Decimal,
    invoice: Any = None,
    payment_method: str = PaymentMethod.CASH,
    provider: str = PaymentProvider.INTERNAL,
    currency: str = "SAR",
    external_reference: str = "",
    transaction_id: str = "",
    notes: str = "",
) -> PaymentCreateResult:
    amount = _safe_decimal(amount)

    if amount <= Decimal("0.00"):
        raise PaymentValidationError("مبلغ الدفع يجب أن يكون أكبر من صفر.")

    payment = Payment.objects.create(
        order=order,
        customer=customer,
        invoice=invoice,
        amount=amount,
        paid_amount=Decimal("0.00"),
        refunded_amount=Decimal("0.00"),
        payment_method=payment_method,
        provider=provider,
        currency=currency or "SAR",
        external_reference=external_reference or "",
        transaction_id=transaction_id or "",
        notes=notes or "",
        initiated_at=timezone.now(),
    )

    logger.info("✅ تم إنشاء دفعة جديدة: %s", payment.payment_number)

    return PaymentCreateResult(
        payment=payment,
        created=True,
    )


# ============================================================
# 🚀 الخدمة الرسمية: تأكيد الدفعة
# ============================================================

@transaction.atomic
def confirm_payment(
    payment: Payment,
    *,
    actor: Any = None,
    paid_amount: Decimal | None = None,
    external_reference: str | None = None,
    transaction_id: str | None = None,
    gateway_response_code: str | None = None,
    gateway_message: str | None = None,
    auto_create_treasury_movement: bool = True,
    auto_post_accounting: bool = True,
) -> PaymentConfirmationResult:
    """
    تأكيد الدفعة رسميًا مع:
    - تعبئة paid_amount إذا لم تكن معبأة
    - تثبيت paid_at
    - تحديث الفاتورة المرتبطة
    - جدولة حركة الخزينة بعد نجاح commit
    - جدولة الترحيل المحاسبي بعد نجاح commit
    """
    if payment is None:
        raise PaymentValidationError("payment is required.")

    payment_id = _resolve_payment_identifier(payment)
    status_before = payment.status

    logger.info("🚀 بدء تأكيد الدفعة %s | status_before=%s", payment_id, status_before)

    amount_to_confirm = _safe_decimal(paid_amount, default=payment.amount)
    if amount_to_confirm <= Decimal("0.00"):
        amount_to_confirm = payment.amount

    payment.paid_amount = amount_to_confirm

    if external_reference is not None:
        payment.external_reference = external_reference

    if transaction_id is not None:
        payment.transaction_id = transaction_id

    if gateway_response_code is not None:
        payment.gateway_response_code = gateway_response_code

    if gateway_message is not None:
        payment.gateway_message = gateway_message

    if not payment.paid_at:
        payment.paid_at = timezone.now()

    validate_payment_for_confirmation(payment)

    payment.save(
        update_fields=[
            "paid_amount",
            "external_reference",
            "transaction_id",
            "gateway_response_code",
            "gateway_message",
            "paid_at",
            "status",
            "updated_at",
        ]
    )
    _refresh_payment(payment)

    _update_invoice_after_payment(payment)

    treasury_dispatched = False
    treasury_message = "لم يُطلب إنشاء حركة الخزينة."
    accounting_post_dispatched = False
    accounting_post_message = "لم يُطلب الترحيل المحاسبي."

    if auto_create_treasury_movement:
        def _create_treasury_after_commit() -> None:
            dispatch_payment_treasury_movement(payment=payment, actor=actor)

        transaction.on_commit(_create_treasury_after_commit)
        treasury_message = "تمت جدولة إنشاء حركة الخزينة بعد نجاح commit."

    if auto_post_accounting:
        def _post_accounting_after_commit() -> None:
            dispatch_payment_accounting_post(payment=payment, actor=actor)

        transaction.on_commit(_post_accounting_after_commit)
        accounting_post_message = "تمت جدولة الترحيل المحاسبي بعد نجاح commit."

    _refresh_payment(payment)
    status_after = payment.status

    logger.info(
        "✅ تم تأكيد الدفعة %s | status_after=%s | treasury=%s | accounting=%s",
        payment_id,
        status_after,
        auto_create_treasury_movement,
        auto_post_accounting,
    )

    return PaymentConfirmationResult(
        payment=payment,
        status_before=status_before,
        status_after=status_after,
        treasury_requested=auto_create_treasury_movement,
        treasury_dispatched=treasury_dispatched,
        treasury_message=treasury_message,
        accounting_post_requested=auto_post_accounting,
        accounting_post_dispatched=accounting_post_dispatched,
        accounting_post_message=accounting_post_message,
    )


# ============================================================
# 🚫 إلغاء دفعة غير مؤكدة
# ============================================================

@transaction.atomic
def cancel_payment(
    payment: Payment,
    *,
    actor: Any = None,
    reason: str = "",
) -> PaymentCancelResult:
    if payment is None:
        raise PaymentValidationError("payment is required.")

    status_before = payment.status

    validate_payment_for_cancel(payment)

    payment.status = PaymentStatus.CANCELLED
    payment.cancelled_at = timezone.now()

    if reason:
        payment.failure_reason = reason

    payment.save(
        update_fields=[
            "status",
            "cancelled_at",
            "failure_reason",
            "updated_at",
        ]
    )

    _refresh_payment(payment)

    logger.info(
        "🚫 تم إلغاء الدفعة %s بواسطة %s",
        _resolve_payment_identifier(payment),
        getattr(actor, "pk", None),
    )

    return PaymentCancelResult(
        payment=payment,
        status_before=status_before,
        status_after=payment.status,
    )


# ============================================================
# 🔁 خدمات مساعدة لإعادة التشغيل عند الحاجة
# ============================================================

def recreate_payment_treasury_movement(payment: Payment, *, actor: Any = None) -> tuple[bool, str]:
    if payment is None:
        raise PaymentValidationError("payment is required for treasury recreation.")

    payment_id = _resolve_payment_identifier(payment)
    logger.info("🔁 إعادة إنشاء حركة خزينة للدفعة %s", payment_id)

    return dispatch_payment_treasury_movement(payment=payment, actor=actor)


def repost_payment_accounting(payment: Payment, *, actor: Any = None) -> tuple[bool, str]:
    if payment is None:
        raise PaymentValidationError("payment is required for reposting.")

    payment_id = _resolve_payment_identifier(payment)
    logger.info("🔁 إعادة ترحيل محاسبي للدفعة %s", payment_id)

    return dispatch_payment_accounting_post(payment=payment, actor=actor)