# ============================================================
# 📂 api/treasury/detail.py
# 🧠 Primey Care | Treasury API - Detail/Actions V2
# ------------------------------------------------------------
# ✅ تفاصيل حساب خزينة
# ✅ تعديل حساب خزينة / بنك / بوابة دفع / محفظة
# ✅ تعطيل حساب خزينة بدل الحذف الخطير
# ✅ تفاصيل حركة خزينة
# ✅ تعديل حركة خزينة مسودة فقط
# ✅ إلغاء حركة خزينة رسميًا مع عكس الأثر إن كانت مؤكدة
# ✅ تأكيد حركة خزينة مع تطبيق أثر الرصيد
# ✅ كشف حساب خزينة / بنك
# ✅ متوافق مع Treasury Backend الجديد
# ============================================================

from __future__ import annotations

import json
import logging
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import HttpRequest, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from accounting.models import Account, JournalEntry
from treasury.models import (
    TreasuryAccount,
    TreasuryAccountStatus,
    TreasuryAccountType,
    TreasuryTransaction,
    TreasuryTransactionSource,
    TreasuryTransactionStatus,
    TreasuryTransactionType,
)
from treasury.services import (
    build_treasury_statement_payload,
    cancel_treasury_transaction,
    confirm_treasury_transaction,
)

from .list import (
    serialize_treasury_account,
    serialize_treasury_transaction,
)


logger = logging.getLogger(__name__)


# ============================================================
# Helpers
# ============================================================

def _decimal_to_string(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, dict):
        return {key: _decimal_to_string(val) for key, val in value.items()}

    if isinstance(value, list):
        return [_decimal_to_string(item) for item in value]

    if isinstance(value, tuple):
        return tuple(_decimal_to_string(item) for item in value)

    return value


def _json_response(
    *,
    success: bool,
    message: str = "",
    data: Any = None,
    status: int = 200,
    errors: Any = None,
) -> JsonResponse:
    payload: dict[str, Any] = {
        "success": success,
        "ok": success,
        "message": message,
        "data": _decimal_to_string(data),
    }

    if errors is not None:
        payload["errors"] = errors

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _read_json_body(request: HttpRequest) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ValidationError("صيغة JSON غير صحيحة.") from exc

    if not isinstance(body, dict):
        raise ValidationError("جسم الطلب يجب أن يكون كائن JSON.")

    return body


def _serialize_validation_error(exc: ValidationError) -> Any:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return exc.messages

    return str(exc)


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _to_decimal(
    value: Any,
    *,
    field_name: str,
    default: str | Decimal | None = None,
) -> Decimal:
    if value in (None, ""):
        if default is None:
            raise ValidationError({field_name: "القيمة المالية مطلوبة."})
        value = default

    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError({field_name: "القيمة المالية غير صحيحة."}) from exc

    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _to_bool(value: Any, *, default: bool = False) -> bool:
    if value in (None, ""):
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        raw = value.strip().lower()

        if raw in {"1", "true", "yes", "y", "on"}:
            return True

        if raw in {"0", "false", "no", "n", "off"}:
            return False

    return bool(value)


def _validate_choice(value: str, choices, *, field_name: str, message: str) -> None:
    valid_values = {choice_value for choice_value, _label in choices}

    if value not in valid_values:
        raise ValidationError({field_name: message})


def _parse_metadata(value: Any) -> dict[str, Any]:
    if value in (None, ""):
        return {}

    if not isinstance(value, dict):
        raise ValidationError({"metadata": "metadata يجب أن تكون كائن JSON."})

    return value


def _resolve_actor(request: HttpRequest):
    user = getattr(request, "user", None)

    if user is not None and getattr(user, "is_authenticated", False):
        return user

    return None


def _resolve_ledger_account(value: Any) -> Account | None:
    if value in (None, "", 0, "0"):
        return None

    try:
        account_id = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError({"ledger_account_id": "معرّف الحساب المحاسبي غير صحيح."}) from exc

    account = Account.objects.filter(pk=account_id).first()

    if not account:
        raise ValidationError({"ledger_account_id": "الحساب المحاسبي غير موجود."})

    if getattr(account, "is_group", False):
        raise ValidationError({"ledger_account_id": "لا يمكن ربط حساب خزينة بحساب محاسبي تجميعي."})

    if not getattr(account, "is_active", True):
        raise ValidationError({"ledger_account_id": "لا يمكن ربط حساب خزينة بحساب محاسبي غير نشط."})

    return account


def _resolve_treasury_account(value: Any, *, field_name: str) -> TreasuryAccount | None:
    if value in (None, "", 0, "0"):
        return None

    try:
        account_id = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError({field_name: "معرّف حساب الخزينة غير صحيح."}) from exc

    account = TreasuryAccount.objects.filter(pk=account_id).first()

    if not account:
        raise ValidationError({field_name: "حساب الخزينة غير موجود."})

    return account


def _resolve_journal_entry(value: Any) -> JournalEntry | None:
    if value in (None, "", 0, "0"):
        return None

    try:
        entry_id = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError({"journal_entry_id": "معرّف القيد المحاسبي غير صحيح."}) from exc

    entry = JournalEntry.objects.filter(pk=entry_id).first()

    if not entry:
        raise ValidationError({"journal_entry_id": "القيد المحاسبي غير موجود."})

    return entry


def _has_confirmed_transactions(account: TreasuryAccount) -> bool:
    return (
        TreasuryTransaction.objects.filter(
            treasury_account=account,
            status=TreasuryTransactionStatus.CONFIRMED,
        ).exists()
        or TreasuryTransaction.objects.filter(
            destination_account=account,
            status=TreasuryTransactionStatus.CONFIRMED,
        ).exists()
    )


def _has_any_transactions(account: TreasuryAccount) -> bool:
    return (
        TreasuryTransaction.objects.filter(treasury_account=account).exists()
        or TreasuryTransaction.objects.filter(destination_account=account).exists()
    )


def _parse_optional_date(raw_value: str, *, field_name: str):
    raw_value = _clean_text(raw_value)

    if not raw_value:
        return None

    parsed = parse_date(raw_value)

    if not parsed:
        raise ValidationError({field_name: "صيغة التاريخ يجب أن تكون YYYY-MM-DD."})

    return parsed


# ============================================================
# Apply Updates
# ============================================================

def _apply_account_payload(
    *,
    account: TreasuryAccount,
    payload: dict[str, Any],
    protected_balance: bool,
) -> TreasuryAccount:
    if "name" in payload:
        account.name = _clean_text(payload.get("name"))
        if not account.name:
            raise ValidationError({"name": "اسم الحساب مطلوب."})

    if "code" in payload:
        new_code = _clean_text(payload.get("code"))

        if not new_code:
            raise ValidationError({"code": "كود الحساب مطلوب."})

        if TreasuryAccount.objects.exclude(pk=account.pk).filter(code=new_code).exists():
            raise ValidationError({"code": "كود الحساب مستخدم مسبقًا."})

        account.code = new_code

    if "account_type" in payload:
        account_type = _clean_text(payload.get("account_type"))
        _validate_choice(
            account_type,
            TreasuryAccountType.choices,
            field_name="account_type",
            message="نوع الحساب غير صحيح.",
        )
        account.account_type = account_type

    if "status" in payload:
        status_value = _clean_text(payload.get("status"))
        _validate_choice(
            status_value,
            TreasuryAccountStatus.choices,
            field_name="status",
            message="حالة الحساب غير صحيحة.",
        )
        account.status = status_value

    if "ledger_account_id" in payload:
        account.ledger_account = _resolve_ledger_account(payload.get("ledger_account_id"))

    if "opening_balance" in payload:
        if protected_balance:
            raise ValidationError({
                "opening_balance": "لا يمكن تعديل الرصيد الافتتاحي بعد وجود حركات مؤكدة."
            })
        account.opening_balance = _to_decimal(
            payload.get("opening_balance"),
            field_name="opening_balance",
        )

    if "current_balance" in payload:
        if protected_balance:
            raise ValidationError({
                "current_balance": "لا يمكن تعديل الرصيد الحالي مباشرة بعد وجود حركات مؤكدة."
            })
        account.current_balance = _to_decimal(
            payload.get("current_balance"),
            field_name="current_balance",
        )

    if "currency" in payload:
        if protected_balance:
            raise ValidationError({
                "currency": "لا يمكن تعديل العملة بعد وجود حركات مؤكدة."
            })
        account.currency = _clean_text(payload.get("currency") or "SAR").upper()

    if "bank_name" in payload:
        account.bank_name = _clean_text(payload.get("bank_name"))

    if "account_holder_name" in payload:
        account.account_holder_name = _clean_text(payload.get("account_holder_name"))

    if "account_number" in payload:
        account.account_number = _clean_text(payload.get("account_number"))

    if "iban" in payload:
        account.iban = _clean_text(payload.get("iban"))

    if "branch_name" in payload:
        account.branch_name = _clean_text(payload.get("branch_name"))

    if "provider_name" in payload:
        account.provider_name = _clean_text(payload.get("provider_name"))

    if "merchant_id" in payload:
        account.merchant_id = _clean_text(payload.get("merchant_id"))

    if "settlement_days" in payload:
        try:
            account.settlement_days = int(payload.get("settlement_days") or 0)
        except (TypeError, ValueError) as exc:
            raise ValidationError({"settlement_days": "أيام التسوية يجب أن تكون رقمًا صحيحًا."}) from exc

        if account.settlement_days < 0:
            raise ValidationError({"settlement_days": "أيام التسوية لا يمكن أن تكون سالبة."})

    if "allow_negative_balance" in payload:
        account.allow_negative_balance = _to_bool(
            payload.get("allow_negative_balance"),
            default=False,
        )

    if "description" in payload:
        account.description = _clean_text(payload.get("description"))

    if "is_default" in payload:
        account.is_default = _to_bool(payload.get("is_default"), default=False)

        if account.is_default:
            TreasuryAccount.objects.exclude(pk=account.pk).filter(is_default=True).update(
                is_default=False
            )

    if "metadata" in payload:
        account.metadata = _parse_metadata(payload.get("metadata"))

    return account


def _apply_transaction_payload(
    *,
    txn: TreasuryTransaction,
    payload: dict[str, Any],
) -> TreasuryTransaction:
    if "transaction_number" in payload:
        transaction_number = _clean_text(payload.get("transaction_number"))

        if not transaction_number:
            raise ValidationError({"transaction_number": "رقم الحركة مطلوب."})

        if (
            TreasuryTransaction.objects.exclude(pk=txn.pk)
            .filter(transaction_number=transaction_number)
            .exists()
        ):
            raise ValidationError({"transaction_number": "رقم الحركة مستخدم مسبقًا."})

        txn.transaction_number = transaction_number

    if "transaction_type" in payload:
        transaction_type = _clean_text(payload.get("transaction_type"))
        _validate_choice(
            transaction_type,
            TreasuryTransactionType.choices,
            field_name="transaction_type",
            message="نوع الحركة غير صحيح.",
        )
        txn.transaction_type = transaction_type

    if "source" in payload:
        source = _clean_text(payload.get("source"))
        _validate_choice(
            source,
            TreasuryTransactionSource.choices,
            field_name="source",
            message="مصدر الحركة غير صحيح.",
        )
        txn.source = source

    if "transaction_date" in payload:
        transaction_date = _parse_optional_date(
            _clean_text(payload.get("transaction_date")),
            field_name="transaction_date",
        )

        if not transaction_date:
            raise ValidationError({"transaction_date": "تاريخ الحركة مطلوب بصيغة YYYY-MM-DD."})

        txn.transaction_date = transaction_date

    if "treasury_account_id" in payload:
        treasury_account = _resolve_treasury_account(
            payload.get("treasury_account_id"),
            field_name="treasury_account_id",
        )

        if not treasury_account:
            raise ValidationError({"treasury_account_id": "حساب الخزينة مطلوب."})

        txn.treasury_account = treasury_account

    if "destination_account_id" in payload:
        txn.destination_account = _resolve_treasury_account(
            payload.get("destination_account_id"),
            field_name="destination_account_id",
        )

    if "amount" in payload:
        txn.amount = _to_decimal(payload.get("amount"), field_name="amount")

    if "fees_amount" in payload:
        txn.fees_amount = _to_decimal(
            payload.get("fees_amount"),
            field_name="fees_amount",
            default="0.00",
        )

    if "net_amount" in payload:
        if payload.get("net_amount") in (None, ""):
            txn.net_amount = txn.amount - txn.fees_amount
        else:
            txn.net_amount = _to_decimal(
                payload.get("net_amount"),
                field_name="net_amount",
            )

    if "amount" in payload or "fees_amount" in payload:
        if "net_amount" not in payload:
            txn.net_amount = txn.amount - txn.fees_amount

    if txn.fees_amount < Decimal("0.00"):
        raise ValidationError({"fees_amount": "مبلغ الرسوم لا يمكن أن يكون سالبًا."})

    if txn.fees_amount > txn.amount:
        raise ValidationError({"fees_amount": "مبلغ الرسوم لا يمكن أن يكون أكبر من مبلغ الحركة."})

    if txn.net_amount <= Decimal("0.00"):
        raise ValidationError({"net_amount": "صافي مبلغ الحركة يجب أن يكون أكبر من صفر."})

    if "currency" in payload:
        txn.currency = _clean_text(payload.get("currency") or txn.currency or "SAR").upper()

    if "reference" in payload:
        txn.reference = _clean_text(payload.get("reference"))

    if "external_reference" in payload:
        txn.external_reference = _clean_text(payload.get("external_reference"))

    if "source_type" in payload:
        txn.source_type = _clean_text(payload.get("source_type"))

    if "source_id" in payload:
        txn.source_id = _clean_text(payload.get("source_id"))

    if "source_number" in payload:
        txn.source_number = _clean_text(payload.get("source_number"))

    if "party_type" in payload:
        txn.party_type = _clean_text(payload.get("party_type"))

    if "party_id" in payload:
        txn.party_id = _clean_text(payload.get("party_id"))

    if "party_name" in payload:
        txn.party_name = _clean_text(payload.get("party_name"))

    if "description" in payload:
        txn.description = _clean_text(payload.get("description"))

    if "notes" in payload:
        txn.notes = _clean_text(payload.get("notes"))

    if "journal_entry_id" in payload:
        txn.journal_entry = _resolve_journal_entry(payload.get("journal_entry_id"))

    if "journal_entry_reference" in payload:
        txn.journal_entry_reference = _clean_text(payload.get("journal_entry_reference"))

    if "metadata" in payload:
        txn.metadata = _parse_metadata(payload.get("metadata"))

    return txn


# ============================================================
# Treasury Account Detail
# ============================================================

@csrf_exempt
@require_http_methods(["GET", "PATCH", "PUT", "DELETE"])
def treasury_account_detail(request: HttpRequest, account_id: int) -> JsonResponse:
    account = get_object_or_404(
        TreasuryAccount.objects.select_related("ledger_account"),
        pk=account_id,
    )

    if request.method == "GET":
        return _json_response(
            success=True,
            message="تم جلب تفاصيل حساب الخزينة بنجاح.",
            data=serialize_treasury_account(account),
        )

    if request.method == "DELETE":
        try:
            account.status = TreasuryAccountStatus.INACTIVE
            account.save(update_fields=["status", "updated_at"])

            message = (
                "تم تعطيل حساب الخزينة لوجود حركات مرتبطة به."
                if _has_any_transactions(account)
                else "تم تعطيل حساب الخزينة بنجاح."
            )

            return _json_response(
                success=True,
                message=message,
                data=serialize_treasury_account(account),
            )

        except ValidationError as exc:
            return _json_response(
                success=False,
                message="تعذر تعطيل حساب الخزينة.",
                errors=_serialize_validation_error(exc),
                status=400,
            )

        except Exception as exc:
            logger.exception("Failed to disable treasury account: %s", exc)
            return _json_response(
                success=False,
                message="حدث خطأ غير متوقع أثناء تعطيل حساب الخزينة.",
                errors=str(exc),
                status=500,
            )

    try:
        payload = _read_json_body(request)
        protected_balance = _has_confirmed_transactions(account)

        with transaction.atomic():
            _apply_account_payload(
                account=account,
                payload=payload,
                protected_balance=protected_balance,
            )
            account.full_clean()
            account.save()

        account.refresh_from_db()

        return _json_response(
            success=True,
            message="تم تحديث حساب الخزينة بنجاح.",
            data=serialize_treasury_account(account),
        )

    except ValidationError as exc:
        return _json_response(
            success=False,
            message="تعذر تحديث حساب الخزينة.",
            errors=_serialize_validation_error(exc),
            status=400,
        )

    except Exception as exc:
        logger.exception("Failed to update treasury account: %s", exc)
        return _json_response(
            success=False,
            message="حدث خطأ غير متوقع أثناء تحديث حساب الخزينة.",
            errors=str(exc),
            status=500,
        )


# ============================================================
# Treasury Transaction Detail
# ============================================================

@csrf_exempt
@require_http_methods(["GET", "PATCH", "PUT", "DELETE"])
def treasury_transaction_detail(request: HttpRequest, transaction_id: int) -> JsonResponse:
    txn = get_object_or_404(
        TreasuryTransaction.objects.select_related(
            "treasury_account",
            "treasury_account__ledger_account",
            "destination_account",
            "destination_account__ledger_account",
            "journal_entry",
            "created_by",
            "confirmed_by",
            "cancelled_by",
        ),
        pk=transaction_id,
    )

    if request.method == "GET":
        return _json_response(
            success=True,
            message="تم جلب تفاصيل حركة الخزينة بنجاح.",
            data=serialize_treasury_transaction(txn),
        )

    if request.method == "DELETE":
        return treasury_transaction_cancel(request, transaction_id)

    try:
        if txn.status == TreasuryTransactionStatus.CONFIRMED:
            raise ValidationError("لا يمكن تعديل حركة خزينة مؤكدة. أنشئ حركة تسوية بدل تعديل الأصل.")

        if txn.status == TreasuryTransactionStatus.CANCELLED:
            raise ValidationError("لا يمكن تعديل حركة خزينة ملغاة.")

        payload = _read_json_body(request)

        if "status" in payload:
            status_value = _clean_text(payload.get("status"))

            _validate_choice(
                status_value,
                TreasuryTransactionStatus.choices,
                field_name="status",
                message="حالة الحركة غير صحيحة.",
            )

            if status_value == TreasuryTransactionStatus.CONFIRMED:
                return treasury_transaction_confirm(request, txn.pk)

            if status_value == TreasuryTransactionStatus.CANCELLED:
                return treasury_transaction_cancel(request, txn.pk)

            txn.status = status_value

        with transaction.atomic():
            _apply_transaction_payload(txn=txn, payload=payload)
            txn.full_clean()
            txn.save()

        txn.refresh_from_db()

        return _json_response(
            success=True,
            message="تم تحديث حركة الخزينة بنجاح.",
            data=serialize_treasury_transaction(txn),
        )

    except ValidationError as exc:
        return _json_response(
            success=False,
            message="تعذر تحديث حركة الخزينة.",
            errors=_serialize_validation_error(exc),
            status=400,
        )

    except Exception as exc:
        logger.exception("Failed to update treasury transaction: %s", exc)
        return _json_response(
            success=False,
            message="حدث خطأ غير متوقع أثناء تحديث حركة الخزينة.",
            errors=str(exc),
            status=500,
        )


# ============================================================
# Confirm Transaction
# ============================================================

@csrf_exempt
@require_http_methods(["POST"])
def treasury_transaction_confirm(request: HttpRequest, transaction_id: int) -> JsonResponse:
    txn = get_object_or_404(
        TreasuryTransaction.objects.select_related(
            "treasury_account",
            "treasury_account__ledger_account",
            "destination_account",
            "destination_account__ledger_account",
            "journal_entry",
            "created_by",
            "confirmed_by",
            "cancelled_by",
        ),
        pk=transaction_id,
    )

    try:
        confirmed_txn = confirm_treasury_transaction(
            txn,
            actor=_resolve_actor(request),
        )

        return _json_response(
            success=True,
            message="تم تأكيد حركة الخزينة وتطبيق أثرها على الرصيد بنجاح.",
            data=serialize_treasury_transaction(confirmed_txn),
        )

    except ValidationError as exc:
        return _json_response(
            success=False,
            message="تعذر تأكيد حركة الخزينة.",
            errors=_serialize_validation_error(exc),
            status=400,
        )

    except Exception as exc:
        logger.exception("Failed to confirm treasury transaction: %s", exc)
        return _json_response(
            success=False,
            message="حدث خطأ غير متوقع أثناء تأكيد حركة الخزينة.",
            errors=str(exc),
            status=500,
        )


# ============================================================
# Cancel Transaction
# ============================================================

@csrf_exempt
@require_http_methods(["POST"])
def treasury_transaction_cancel(request: HttpRequest, transaction_id: int) -> JsonResponse:
    txn = get_object_or_404(
        TreasuryTransaction.objects.select_related(
            "treasury_account",
            "treasury_account__ledger_account",
            "destination_account",
            "destination_account__ledger_account",
            "journal_entry",
            "created_by",
            "confirmed_by",
            "cancelled_by",
        ),
        pk=transaction_id,
    )

    try:
        reason = ""

        if request.body:
            try:
                payload = _read_json_body(request)
                reason = _clean_text(payload.get("reason"))
            except ValidationError:
                reason = ""

        cancelled_txn = cancel_treasury_transaction(
            txn,
            actor=_resolve_actor(request),
            reason=reason or "تم الإلغاء من API.",
        )

        return _json_response(
            success=True,
            message="تم إلغاء حركة الخزينة بنجاح.",
            data=serialize_treasury_transaction(cancelled_txn),
        )

    except ValidationError as exc:
        return _json_response(
            success=False,
            message="تعذر إلغاء حركة الخزينة.",
            errors=_serialize_validation_error(exc),
            status=400,
        )

    except Exception as exc:
        logger.exception("Failed to cancel treasury transaction: %s", exc)
        return _json_response(
            success=False,
            message="حدث خطأ غير متوقع أثناء إلغاء حركة الخزينة.",
            errors=str(exc),
            status=500,
        )


# ============================================================
# Treasury Account Statement
# ============================================================

@require_http_methods(["GET"])
def treasury_account_statement(request: HttpRequest, account_id: int) -> JsonResponse:
    account = get_object_or_404(
        TreasuryAccount.objects.select_related("ledger_account"),
        pk=account_id,
    )

    try:
        date_from_raw = request.GET.get("date_from", "").strip()
        date_to_raw = request.GET.get("date_to", "").strip()

        date_from = _parse_optional_date(date_from_raw, field_name="date_from")
        date_to = _parse_optional_date(date_to_raw, field_name="date_to")

        if date_from and date_to and date_from > date_to:
            raise ValidationError({"date_range": "لا يمكن أن يكون date_from أكبر من date_to."})

        include_draft = _to_bool(request.GET.get("include_draft"), default=True)
        include_cancelled = _to_bool(request.GET.get("include_cancelled"), default=False)

        payload = build_treasury_statement_payload(
            treasury_account=account,
            date_from=date_from,
            date_to=date_to,
            include_draft=include_draft,
            include_cancelled=include_cancelled,
        )

        return _json_response(
            success=True,
            message="تم بناء كشف حساب الخزينة بنجاح.",
            data={
                "account": serialize_treasury_account(account),
                "statement": payload,
                "filters": {
                    "date_from": date_from.isoformat() if date_from else None,
                    "date_to": date_to.isoformat() if date_to else None,
                    "include_draft": include_draft,
                    "include_cancelled": include_cancelled,
                },
            },
        )

    except ValidationError as exc:
        return _json_response(
            success=False,
            message="تعذر بناء كشف حساب الخزينة.",
            errors=_serialize_validation_error(exc),
            status=400,
        )

    except Exception as exc:
        logger.exception("Failed to build treasury account statement: %s", exc)
        return _json_response(
            success=False,
            message="حدث خطأ غير متوقع أثناء بناء كشف حساب الخزينة.",
            errors=str(exc),
            status=500,
        )