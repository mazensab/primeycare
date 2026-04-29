# ============================================================
# 📂 api/treasury/detail.py
# 🧠 Primey Care | Treasury API - Detail/Actions
# ------------------------------------------------------------
# ✅ تفاصيل حساب خزينة
# ✅ تعديل حساب خزينة
# ✅ تعطيل حساب خزينة بدل الحذف الخطير
# ✅ تفاصيل حركة خزينة
# ✅ تعديل حركة خزينة مسودة
# ✅ إلغاء حركة خزينة رسميًا مع عكس الأثر إن كانت مؤكدة
# ✅ تأكيد حركة خزينة
# ✅ كشف حساب خزينة / بنك
# ============================================================

from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import HttpRequest, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from django.views.decorators.http import require_http_methods

from accounting.models import Account
from treasury.models import (
    TreasuryAccount,
    TreasuryAccountStatus,
    TreasuryAccountType,
    TreasuryTransaction,
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


# ============================================================
# Helpers
# ============================================================

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
        "message": message,
        "data": data,
    }

    if errors is not None:
        payload["errors"] = errors

    return JsonResponse(payload, status=status, json_dumps_params={"ensure_ascii": False})


def _read_json_body(request: HttpRequest) -> dict[str, Any]:
    if not request.body:
        return {}

    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        raise ValidationError("صيغة JSON غير صحيحة.")

    if not isinstance(body, dict):
        raise ValidationError("جسم الطلب يجب أن يكون كائن JSON.")

    return body


def _serialize_validation_error(exc: ValidationError) -> Any:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return exc.messages

    return str(exc)


def _to_decimal(value: Any, *, field_name: str) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({field_name: "القيمة المالية غير صحيحة."})

    return amount.quantize(Decimal("0.01"))


def _to_bool(value: Any, *, default: bool = False) -> bool:
    if value in (None, ""):
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}

    return bool(value)


def _resolve_ledger_account(value: Any) -> Account | None:
    if value in (None, "", 0, "0"):
        return None

    try:
        account_id = int(value)
    except (TypeError, ValueError):
        raise ValidationError({"ledger_account_id": "معرّف الحساب المحاسبي غير صحيح."})

    account = Account.objects.filter(pk=account_id).first()
    if not account:
        raise ValidationError({"ledger_account_id": "الحساب المحاسبي غير موجود."})

    return account


def _resolve_treasury_account(value: Any, *, field_name: str) -> TreasuryAccount | None:
    if value in (None, "", 0, "0"):
        return None

    try:
        account_id = int(value)
    except (TypeError, ValueError):
        raise ValidationError({field_name: "معرّف حساب الخزينة غير صحيح."})

    account = TreasuryAccount.objects.filter(pk=account_id).first()
    if not account:
        raise ValidationError({field_name: "حساب الخزينة غير موجود."})

    return account


def _has_confirmed_transactions(account: TreasuryAccount) -> bool:
    return TreasuryTransaction.objects.filter(
        treasury_account=account,
        status=TreasuryTransactionStatus.CONFIRMED,
    ).exists() or TreasuryTransaction.objects.filter(
        destination_account=account,
        status=TreasuryTransactionStatus.CONFIRMED,
    ).exists()


# ============================================================
# Treasury Account Detail
# ============================================================

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
            if _has_confirmed_transactions(account):
                account.status = TreasuryAccountStatus.INACTIVE
                account.save(update_fields=["status", "updated_at"])

                return _json_response(
                    success=True,
                    message="تم تعطيل حساب الخزينة لوجود حركات مؤكدة مرتبطة به.",
                    data=serialize_treasury_account(account),
                )

            account.delete()

            return _json_response(
                success=True,
                message="تم حذف حساب الخزينة بنجاح.",
                data={"id": account_id},
            )

        except ValidationError as exc:
            return _json_response(
                success=False,
                message="تعذر حذف حساب الخزينة.",
                errors=_serialize_validation_error(exc),
                status=400,
            )
        except Exception as exc:
            return _json_response(
                success=False,
                message="حدث خطأ غير متوقع أثناء حذف حساب الخزينة.",
                errors=str(exc),
                status=500,
            )

    try:
        payload = _read_json_body(request)
        protected_balance = _has_confirmed_transactions(account)

        with transaction.atomic():
            if "name" in payload:
                account.name = str(payload.get("name", "") or "").strip()

            if "code" in payload:
                new_code = str(payload.get("code", "") or "").strip()
                if not new_code:
                    raise ValidationError({"code": "كود الحساب مطلوب."})

                if TreasuryAccount.objects.exclude(pk=account.pk).filter(code=new_code).exists():
                    raise ValidationError({"code": "كود الحساب مستخدم مسبقًا."})

                account.code = new_code

            if "account_type" in payload:
                account_type = str(payload.get("account_type", "")).strip()
                if account_type not in TreasuryAccountType.values:
                    raise ValidationError({"account_type": "نوع الحساب غير صحيح."})
                account.account_type = account_type

            if "status" in payload:
                status_value = str(payload.get("status", "")).strip()
                if status_value not in TreasuryAccountStatus.values:
                    raise ValidationError({"status": "حالة الحساب غير صحيحة."})
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
                account.currency = str(payload.get("currency", "SAR") or "SAR").strip().upper()

            if "bank_name" in payload:
                account.bank_name = str(payload.get("bank_name", "") or "").strip()

            if "account_holder_name" in payload:
                account.account_holder_name = str(payload.get("account_holder_name", "") or "").strip()

            if "account_number" in payload:
                account.account_number = str(payload.get("account_number", "") or "").strip()

            if "iban" in payload:
                account.iban = str(payload.get("iban", "") or "").strip()

            if "branch_name" in payload:
                account.branch_name = str(payload.get("branch_name", "") or "").strip()

            if "description" in payload:
                account.description = str(payload.get("description", "") or "").strip()

            if "is_default" in payload:
                account.is_default = _to_bool(payload.get("is_default"), default=False)
                if account.is_default:
                    TreasuryAccount.objects.exclude(pk=account.pk).filter(is_default=True).update(
                        is_default=False
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
        return _json_response(
            success=False,
            message="حدث خطأ غير متوقع أثناء تحديث حساب الخزينة.",
            errors=str(exc),
            status=500,
        )


# ============================================================
# Treasury Transaction Detail
# ============================================================

@require_http_methods(["GET", "PATCH", "PUT", "DELETE"])
def treasury_transaction_detail(request: HttpRequest, transaction_id: int) -> JsonResponse:
    txn = get_object_or_404(
        TreasuryTransaction.objects.select_related(
            "treasury_account",
            "treasury_account__ledger_account",
            "destination_account",
            "destination_account__ledger_account",
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

        if "transaction_number" in payload:
            transaction_number = str(payload.get("transaction_number", "") or "").strip()
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
            transaction_type = str(payload.get("transaction_type", "")).strip()
            if transaction_type not in TreasuryTransactionType.values:
                raise ValidationError({"transaction_type": "نوع الحركة غير صحيح."})
            txn.transaction_type = transaction_type

        if "status" in payload:
            status_value = str(payload.get("status", "")).strip()
            if status_value not in TreasuryTransactionStatus.values:
                raise ValidationError({"status": "حالة الحركة غير صحيحة."})

            if status_value == TreasuryTransactionStatus.CONFIRMED:
                return treasury_transaction_confirm(request, txn.pk)

            if status_value == TreasuryTransactionStatus.CANCELLED:
                return treasury_transaction_cancel(request, txn.pk)

            txn.status = status_value

        if "transaction_date" in payload:
            transaction_date = parse_date(str(payload.get("transaction_date", "")).strip())
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

        if "currency" in payload:
            txn.currency = str(payload.get("currency", txn.currency or "SAR") or "SAR").strip().upper()

        if "reference" in payload:
            txn.reference = str(payload.get("reference", "") or "").strip()

        if "external_reference" in payload:
            txn.external_reference = str(payload.get("external_reference", "") or "").strip()

        if "description" in payload:
            txn.description = str(payload.get("description", "") or "").strip()

        if "notes" in payload:
            txn.notes = str(payload.get("notes", "") or "").strip()

        if "journal_entry_reference" in payload:
            txn.journal_entry_reference = str(payload.get("journal_entry_reference", "") or "").strip()

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
        return _json_response(
            success=False,
            message="حدث خطأ غير متوقع أثناء تحديث حركة الخزينة.",
            errors=str(exc),
            status=500,
        )


# ============================================================
# Confirm Transaction
# ============================================================

@require_http_methods(["POST"])
def treasury_transaction_confirm(request: HttpRequest, transaction_id: int) -> JsonResponse:
    txn = get_object_or_404(
        TreasuryTransaction.objects.select_related(
            "treasury_account",
            "treasury_account__ledger_account",
            "destination_account",
            "destination_account__ledger_account",
        ),
        pk=transaction_id,
    )

    try:
        confirmed_txn = confirm_treasury_transaction(txn)

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
        return _json_response(
            success=False,
            message="حدث خطأ غير متوقع أثناء تأكيد حركة الخزينة.",
            errors=str(exc),
            status=500,
        )


# ============================================================
# Cancel Transaction
# ============================================================

@require_http_methods(["POST"])
def treasury_transaction_cancel(request: HttpRequest, transaction_id: int) -> JsonResponse:
    txn = get_object_or_404(
        TreasuryTransaction.objects.select_related(
            "treasury_account",
            "treasury_account__ledger_account",
            "destination_account",
            "destination_account__ledger_account",
        ),
        pk=transaction_id,
    )

    try:
        cancelled_txn = cancel_treasury_transaction(txn)

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

        date_from = parse_date(date_from_raw) if date_from_raw else None
        date_to = parse_date(date_to_raw) if date_to_raw else None

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
        return _json_response(
            success=False,
            message="حدث خطأ غير متوقع أثناء بناء كشف حساب الخزينة.",
            errors=str(exc),
            status=500,
        )