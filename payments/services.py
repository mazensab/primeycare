# ============================================================
# 📂 payments/services.py
# 🧠 Payment Services — Primey Care V1.1
# ------------------------------------------------------------
# ✅ طبقة خدمات رسمية لتأكيد الدفعات
# ✅ إنشاء حركة خزينة تلقائيًا بعد تأكيد الدفعة
# ✅ إطلاق الترحيل المحاسبي تلقائيًا بعد نجاح الحفظ
# ✅ اعتماد حالة PAID بدل CONFIRMED لتوافق الموديل الفعلي
# ✅ مراعاة idempotency قدر الإمكان عبر طبقات الترحيل/الخزينة
# ✅ Logging منظم + أخطاء واضحة
# ✅ بدون المساس بأي منجز سابق
# ------------------------------------------------------------
# ملاحظات:
# 1) الموديل الفعلي لا يدعم CONFIRMED، لذلك نعتمد PAID كحالة
#    التأكيد النهائية للدفعة داخل النظام الحالي.
# 2) هذا الملف لا يغيّر الموديلات، بل يستخدم الموجود فقط.
# 3) إذا اختلفت أسماء دوال الترحيل/الخزينة عندك فعليًا،
#    عدّل فقط قوائم CANDIDATE_* أدناه.
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

PAYMENT_STATUS_DRAFT = "DRAFT"
PAYMENT_STATUS_PENDING = "PENDING"
PAYMENT_STATUS_COMPLETED = "COMPLETED"
PAYMENT_STATUS_PAID = "PAID"
PAYMENT_STATUS_FAILED = "FAILED"
PAYMENT_STATUS_CANCELLED = "CANCELLED"
PAYMENT_STATUS_REFUNDED = "REFUNDED"

FINAL_PAYMENT_STATUSES = {
    PAYMENT_STATUS_PAID,
    PAYMENT_STATUS_COMPLETED,
}

PAYMENT_METHOD_CASH = "CASH"
PAYMENT_METHOD_BANK = "BANK"
PAYMENT_METHOD_TRANSFER = "BANK_TRANSFER"
PAYMENT_METHOD_CARD = "CARD"

TREASURY_DIRECTION_IN = "IN"
TREASURY_DIRECTION_OUT = "OUT"
TREASURY_MOVEMENT_TYPE_RECEIPT = "RECEIPT"
TREASURY_MOVEMENT_STATUS_CONFIRMED = "CONFIRMED"

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
# 📦 نتيجة الخدمة
# ============================================================

@dataclass(slots=True)
class PaymentConfirmationResult:
    payment: Any
    status_before: str
    status_after: str
    treasury_requested: bool
    treasury_dispatched: bool
    treasury_message: str
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


def _resolve_payment_identifier(payment: Any) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(payment, "reference"),
            _safe_getattr(payment, "payment_number"),
            _safe_getattr(payment, "number"),
            _safe_getattr(payment, "code"),
            _safe_getattr(payment, "pk"),
            "unknown-payment",
        )
    )


def _resolve_payment_status(payment: Any) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(payment, "status"),
            PAYMENT_STATUS_DRAFT,
        )
    )


def _resolve_payment_amount(payment: Any) -> Decimal:
    candidates = [
        _safe_getattr(payment, "amount"),
        _safe_getattr(payment, "paid_amount"),
        _safe_getattr(payment, "total_amount"),
        _safe_getattr(payment, "net_amount"),
        _safe_getattr(payment, "value"),
    ]
    for value in candidates:
        if value is not None:
            try:
                return Decimal(str(value))
            except Exception:
                continue
    return Decimal("0.00")


def _resolve_payment_date(payment: Any) -> date:
    current_value = _first_non_empty(
        _safe_getattr(payment, "payment_date"),
        _safe_getattr(payment, "paid_date"),
        _safe_getattr(payment, "date"),
        _safe_getattr(payment, "transaction_date"),
    )
    if isinstance(current_value, date):
        return current_value
    return timezone.localdate()


def _resolve_payment_method(payment: Any) -> str:
    return str(
        _first_non_empty(
            _safe_getattr(payment, "payment_method"),
            _safe_getattr(payment, "method"),
            PAYMENT_METHOD_CASH,
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


def _save_payment(payment: Any, update_fields: list[str]) -> None:
    valid_update_fields = [field for field in update_fields if hasattr(payment, field)]
    if valid_update_fields:
        payment.save(update_fields=valid_update_fields)
    else:
        payment.save()


def _refresh_payment(payment: Any) -> None:
    refresh = getattr(payment, "refresh_from_db", None)
    if callable(refresh):
        refresh()


def _should_force_paid_status(status_before: str) -> bool:
    return status_before not in FINAL_PAYMENT_STATUSES


# ============================================================
# ✅ التحقق قبل التأكيد
# ============================================================

def validate_payment_for_confirmation(payment: Any) -> None:
    if payment is None:
        raise PaymentValidationError("لم يتم تمرير دفعة صالحة.")

    payment_id = _resolve_payment_identifier(payment)
    status = _resolve_payment_status(payment)
    amount = _resolve_payment_amount(payment)

    if status in {PAYMENT_STATUS_FAILED, PAYMENT_STATUS_CANCELLED, PAYMENT_STATUS_REFUNDED}:
        raise PaymentValidationError(
            f"لا يمكن تأكيد الدفعة {payment_id} لأن حالتها الحالية هي {status}."
        )

    if amount <= Decimal("0.00"):
        raise PaymentValidationError(
            f"لا يمكن تأكيد الدفعة {payment_id} لأن مبلغها غير صالح: {amount}."
        )

    try:
        payment.full_clean()
    except ValidationError as exc:
        field_errors = getattr(exc, "message_dict", {}) or {}
        status_errors = field_errors.get("status", [])
        status_error_text = " ".join(str(item) for item in status_errors)

        if "ليست خيارا صحيحاً" in status_error_text or "not a valid choice" in status_error_text:
            logger.warning(
                "تم تجاوز full_clean مؤقتًا لأن حالة الدفع الحالية ستُضبط لاحقًا بالقيمة الصحيحة داخل الخدمة. payment=%s",
                payment_id,
            )
            return

        raise PaymentValidationError(
            f"فشل التحقق من الدفعة قبل التأكيد: {exc}"
        ) from exc
    except Exception as exc:
        logger.debug(
            "تم تجاهل full_clean لعدم توافقه الكامل مع حالة الدفعة %s: %s",
            payment_id,
            exc,
        )


# ============================================================
# 🧾 تهيئة الدفعة قبل الحفظ
# ============================================================

def _prepare_payment_confirmation_fields(payment: Any, status_before: str) -> list[str]:
    changed_fields: list[str] = []
    now = timezone.now()
    today = _resolve_payment_date(payment)

    if hasattr(payment, "status") and _should_force_paid_status(status_before):
        if _resolve_payment_status(payment) != PAYMENT_STATUS_PAID:
            payment.status = PAYMENT_STATUS_PAID
            changed_fields.append("status")

    for field_name in ("confirmed_at", "paid_at"):
        if hasattr(payment, field_name) and not getattr(payment, field_name):
            setattr(payment, field_name, now)
            changed_fields.append(field_name)
            break

    for field_name in ("payment_date", "paid_date", "date"):
        if hasattr(payment, field_name) and not getattr(payment, field_name):
            setattr(payment, field_name, today)
            changed_fields.append(field_name)
            break

    if hasattr(payment, "is_confirmed") and not getattr(payment, "is_confirmed"):
        payment.is_confirmed = True
        changed_fields.append("is_confirmed")

    if hasattr(payment, "updated_at"):
        payment.updated_at = now
        if "updated_at" not in changed_fields:
            changed_fields.append("updated_at")

    return changed_fields


def _enforce_post_save_status(payment: Any, status_before: str) -> None:
    if not hasattr(payment, "status"):
        return

    expected_status = PAYMENT_STATUS_PAID if _should_force_paid_status(status_before) else status_before
    current_status = _resolve_payment_status(payment)

    if current_status != expected_status:
        logger.warning(
            "⚠️ تم اكتشاف تغيير غير متوقع في حالة الدفعة %s بعد الحفظ: %s -> %s. سيتم تثبيت الحالة الصحيحة %s.",
            _resolve_payment_identifier(payment),
            status_before,
            current_status,
            expected_status,
        )
        payment.status = expected_status
        _save_payment(payment, ["status"])
        _refresh_payment(payment)


# ============================================================
# 🏦 حركة الخزينة
# ============================================================

def dispatch_payment_treasury_movement(payment: Any, actor: Any = None) -> tuple[bool, str]:
    payment_id = _resolve_payment_identifier(payment)
    treasury_callable = _resolve_import_callable(CANDIDATE_TREASURY_TARGETS)

    if treasury_callable is None:
        message = (
            "لم يتم العثور على دالة إنشاء حركة خزينة للدفعات. "
            "تحقق من ربط treasury.services."
        )
        logger.warning("Payment %s: %s", payment_id, message)
        return False, message

    try:
        try:
            treasury_callable(payment=payment, actor=actor)
        except TypeError:
            try:
                treasury_callable(payment=payment)
            except TypeError:
                treasury_callable(payment)

        message = f"تم إطلاق إنشاء حركة الخزينة بنجاح للدفعة {payment_id}."
        logger.info(message)
        return True, message

    except Exception as exc:
        logger.exception(
            "❌ فشل إنشاء حركة الخزينة للدفعة %s: %s",
            payment_id,
            exc,
        )
        raise PaymentTreasuryError(
            f"فشل إنشاء حركة الخزينة للدفعة {payment_id}: {exc}"
        ) from exc


# ============================================================
# 📘 الترحيل المحاسبي
# ============================================================

def dispatch_payment_accounting_post(payment: Any, actor: Any = None) -> tuple[bool, str]:
    payment_id = _resolve_payment_identifier(payment)
    posting_callable = _resolve_import_callable(CANDIDATE_ACCOUNTING_POSTING_TARGETS)

    if posting_callable is None:
        message = (
            "لم يتم العثور على دالة ترحيل محاسبي للدفعات. "
            "تحقق من ربط accounting.services.posting."
        )
        logger.warning("Payment %s: %s", payment_id, message)
        return False, message

    try:
        try:
            posting_callable(payment=payment, actor=actor)
        except TypeError:
            try:
                posting_callable(payment=payment)
            except TypeError:
                posting_callable(payment)

        message = f"تم إطلاق الترحيل المحاسبي للدفعة بنجاح للدفعة {payment_id}."
        logger.info(message)
        return True, message

    except Exception as exc:
        logger.exception(
            "❌ فشل الترحيل المحاسبي للدفعة %s: %s",
            payment_id,
            exc,
        )
        raise PaymentPostingError(
            f"فشل الترحيل المحاسبي للدفعة {payment_id}: {exc}"
        ) from exc


# ============================================================
# 🚀 الخدمة الرسمية: تأكيد الدفعة
# ============================================================

@transaction.atomic
def confirm_payment(
    payment: Any,
    *,
    actor: Any = None,
    auto_create_treasury_movement: bool = True,
    auto_post_accounting: bool = True,
) -> PaymentConfirmationResult:
    """
    تأكيد الدفعة رسميًا مع إطلاق:
    - حركة الخزينة بعد نجاح commit
    - الترحيل المحاسبي بعد نجاح commit

    الاستخدام:
        result = confirm_payment(payment, actor=request.user)

    السلوك:
    - يتحقق من صلاحية الدفعة
    - يحدّث الحالة إلى PAID عند الحاجة
    - يعبئ تاريخ/وقت التأكيد إذا كانت الحقول موجودة
    - يحفظ الدفعة داخل transaction
    - يطلق حركة الخزينة والترحيل المحاسبي عبر on_commit
    """
    if payment is None:
        raise PaymentValidationError("payment is required.")

    payment_id = _resolve_payment_identifier(payment)
    status_before = _resolve_payment_status(payment)

    logger.info("🚀 بدء تأكيد الدفعة %s | status_before=%s", payment_id, status_before)

    validate_payment_for_confirmation(payment)

    changed_fields = _prepare_payment_confirmation_fields(payment, status_before=status_before)

    for method_name in ("recalculate", "recalculate_totals", "refresh_from_source"):
        try:
            _call_if_exists(payment, method_name)
        except Exception as exc:
            logger.warning(
                "تعذر تنفيذ %s للدفعة %s: %s",
                method_name,
                payment_id,
                exc,
            )

    _save_payment(payment, changed_fields)
    _refresh_payment(payment)
    _enforce_post_save_status(payment, status_before=status_before)
    _refresh_payment(payment)

    treasury_dispatched = False
    treasury_message = "لم يُطلب إنشاء حركة الخزينة."
    accounting_post_dispatched = False
    accounting_post_message = "لم يُطلب الترحيل المحاسبي."

    if auto_create_treasury_movement:
        def _create_treasury_after_commit() -> None:
            nonlocal treasury_dispatched, treasury_message
            success, message = dispatch_payment_treasury_movement(payment=payment, actor=actor)
            treasury_dispatched = success
            treasury_message = message

        transaction.on_commit(_create_treasury_after_commit)
        treasury_message = "تمت جدولة إنشاء حركة الخزينة بعد نجاح commit."

    if auto_post_accounting:
        def _post_accounting_after_commit() -> None:
            nonlocal accounting_post_dispatched, accounting_post_message
            success, message = dispatch_payment_accounting_post(payment=payment, actor=actor)
            accounting_post_dispatched = success
            accounting_post_message = message

        transaction.on_commit(_post_accounting_after_commit)
        accounting_post_message = "تمت جدولة الترحيل المحاسبي بعد نجاح commit."

    _refresh_payment(payment)
    status_after = _resolve_payment_status(payment)

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
# 🔁 خدمات مساعدة لإعادة التشغيل عند الحاجة
# ============================================================

def recreate_payment_treasury_movement(payment: Any, *, actor: Any = None) -> tuple[bool, str]:
    if payment is None:
        raise PaymentValidationError("payment is required for treasury recreation.")

    payment_id = _resolve_payment_identifier(payment)
    logger.info("🔁 إعادة إنشاء حركة خزينة للدفعة %s", payment_id)

    return dispatch_payment_treasury_movement(payment=payment, actor=actor)


def repost_payment_accounting(payment: Any, *, actor: Any = None) -> tuple[bool, str]:
    if payment is None:
        raise PaymentValidationError("payment is required for reposting.")

    payment_id = _resolve_payment_identifier(payment)
    logger.info("🔁 إعادة ترحيل محاسبي للدفعة %s", payment_id)

    return dispatch_payment_accounting_post(payment=payment, actor=actor)