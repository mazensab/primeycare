# ============================================================
# 📂 api/treasury/list.py
# 🧠 Primey Care | Treasury API - List/Create
# ------------------------------------------------------------
# ✅ قائمة حسابات الخزينة
# ✅ إنشاء حساب خزينة / بنك
# ✅ قائمة حركات الخزينة
# ✅ إنشاء حركة خزينة
# ✅ يدعم الفلاتر والبحث والترقيم البسيط
# ============================================================

from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Q, Sum
from django.http import HttpRequest, JsonResponse
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
from treasury.services import create_treasury_transaction


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


def _to_decimal(value: Any, *, field_name: str, default: str = "0.00") -> Decimal:
    if value in (None, ""):
        value = default

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


def _get_int(value: Any, *, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _serialize_validation_error(exc: ValidationError) -> Any:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return exc.messages

    return str(exc)


def _resolve_ledger_account(value: Any) -> Account | None:
    if value in (None, "", 0, "0"):
        return None

    try:
        account_id = int(value)
    except (TypeError, ValueError):
        raise ValidationError({"ledger_account": "معرّف الحساب المحاسبي غير صحيح."})

    account = Account.objects.filter(pk=account_id).first()
    if not account:
        raise ValidationError({"ledger_account": "الحساب المحاسبي غير موجود."})

    return account


def _serialize_ledger_account(account: Account | None) -> dict[str, Any] | None:
    if not account:
        return None

    return {
        "id": account.pk,
        "code": getattr(account, "code", ""),
        "name": getattr(account, "name", ""),
        "name_ar": getattr(account, "name_ar", ""),
        "name_en": getattr(account, "name_en", ""),
        "is_group": bool(getattr(account, "is_group", False)),
    }


def serialize_treasury_account(account: TreasuryAccount) -> dict[str, Any]:
    return {
        "id": account.pk,
        "name": account.name,
        "code": account.code,
        "account_type": account.account_type,
        "account_type_label": account.get_account_type_display(),
        "status": account.status,
        "status_label": account.get_status_display(),
        "ledger_account": _serialize_ledger_account(account.ledger_account),
        "ledger_account_id": account.ledger_account_id,
        "opening_balance": str(account.opening_balance),
        "current_balance": str(account.current_balance),
        "currency": account.currency,
        "bank_name": account.bank_name,
        "account_holder_name": account.account_holder_name,
        "account_number": account.account_number,
        "iban": account.iban,
        "branch_name": account.branch_name,
        "description": account.description,
        "is_default": account.is_default,
        "created_at": account.created_at.isoformat() if account.created_at else None,
        "updated_at": account.updated_at.isoformat() if account.updated_at else None,
    }


def serialize_treasury_transaction(txn: TreasuryTransaction) -> dict[str, Any]:
    return {
        "id": txn.pk,
        "transaction_number": txn.transaction_number,
        "transaction_type": txn.transaction_type,
        "transaction_type_label": txn.get_transaction_type_display(),
        "status": txn.status,
        "status_label": txn.get_status_display(),
        "transaction_date": txn.transaction_date.isoformat() if txn.transaction_date else None,
        "treasury_account": serialize_treasury_account(txn.treasury_account),
        "treasury_account_id": txn.treasury_account_id,
        "destination_account": (
            serialize_treasury_account(txn.destination_account)
            if txn.destination_account_id
            else None
        ),
        "destination_account_id": txn.destination_account_id,
        "amount": str(txn.amount),
        "currency": txn.currency,
        "reference": txn.reference,
        "external_reference": txn.external_reference,
        "description": txn.description,
        "notes": txn.notes,
        "journal_entry_reference": txn.journal_entry_reference,
        "created_at": txn.created_at.isoformat() if txn.created_at else None,
        "updated_at": txn.updated_at.isoformat() if txn.updated_at else None,
    }


def _build_pagination_payload(paginator: Paginator, page_obj) -> dict[str, Any]:
    return {
        "page": page_obj.number,
        "page_size": paginator.per_page,
        "total_pages": paginator.num_pages,
        "total_items": paginator.count,
        "has_next": page_obj.has_next(),
        "has_previous": page_obj.has_previous(),
    }


def _apply_account_filters(queryset, request: HttpRequest):
    search = request.GET.get("search", "").strip()
    account_type = request.GET.get("account_type", "").strip()
    status = request.GET.get("status", "").strip()
    currency = request.GET.get("currency", "").strip()
    is_default = request.GET.get("is_default", "").strip()

    if search:
        queryset = queryset.filter(
            Q(name__icontains=search)
            | Q(code__icontains=search)
            | Q(bank_name__icontains=search)
            | Q(account_holder_name__icontains=search)
            | Q(account_number__icontains=search)
            | Q(iban__icontains=search)
        )

    if account_type:
        queryset = queryset.filter(account_type=account_type)

    if status:
        queryset = queryset.filter(status=status)

    if currency:
        queryset = queryset.filter(currency__iexact=currency)

    if is_default:
        queryset = queryset.filter(is_default=_to_bool(is_default))

    return queryset


def _apply_transaction_filters(queryset, request: HttpRequest):
    search = request.GET.get("search", "").strip()
    transaction_type = request.GET.get("transaction_type", "").strip()
    status = request.GET.get("status", "").strip()
    currency = request.GET.get("currency", "").strip()
    treasury_account_id = request.GET.get("treasury_account_id", "").strip()
    destination_account_id = request.GET.get("destination_account_id", "").strip()
    date_from = parse_date(request.GET.get("date_from", "").strip())
    date_to = parse_date(request.GET.get("date_to", "").strip())

    if search:
        queryset = queryset.filter(
            Q(transaction_number__icontains=search)
            | Q(reference__icontains=search)
            | Q(external_reference__icontains=search)
            | Q(description__icontains=search)
            | Q(notes__icontains=search)
            | Q(journal_entry_reference__icontains=search)
            | Q(treasury_account__name__icontains=search)
            | Q(treasury_account__code__icontains=search)
        )

    if transaction_type:
        queryset = queryset.filter(transaction_type=transaction_type)

    if status:
        queryset = queryset.filter(status=status)

    if currency:
        queryset = queryset.filter(currency__iexact=currency)

    if treasury_account_id:
        queryset = queryset.filter(treasury_account_id=treasury_account_id)

    if destination_account_id:
        queryset = queryset.filter(destination_account_id=destination_account_id)

    if date_from:
        queryset = queryset.filter(transaction_date__gte=date_from)

    if date_to:
        queryset = queryset.filter(transaction_date__lte=date_to)

    return queryset


# ============================================================
# Treasury Accounts API
# ============================================================

@require_http_methods(["GET", "POST"])
def treasury_accounts(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        queryset = (
            TreasuryAccount.objects.select_related("ledger_account")
            .all()
            .order_by("account_type", "code", "id")
        )
        queryset = _apply_account_filters(queryset, request)

        page = _get_int(request.GET.get("page"), default=1)
        page_size = _get_int(request.GET.get("page_size"), default=20)
        page_size = max(1, min(page_size, 100))

        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page)

        active_count = queryset.filter(status=TreasuryAccountStatus.ACTIVE).count()
        total_current_balance = queryset.aggregate(total=Sum("current_balance"))["total"] or Decimal("0.00")

        return _json_response(
            success=True,
            message="تم جلب حسابات الخزينة بنجاح.",
            data={
                "items": [serialize_treasury_account(account) for account in page_obj.object_list],
                "pagination": _build_pagination_payload(paginator, page_obj),
                "summary": {
                    "total_accounts": queryset.count(),
                    "active_accounts": active_count,
                    "total_current_balance": str(total_current_balance),
                    "currency": request.GET.get("currency", "SAR") or "SAR",
                },
                "choices": {
                    "account_types": [
                        {"value": value, "label": label}
                        for value, label in TreasuryAccountType.choices
                    ],
                    "statuses": [
                        {"value": value, "label": label}
                        for value, label in TreasuryAccountStatus.choices
                    ],
                },
            },
        )

    try:
        payload = _read_json_body(request)

        name = str(payload.get("name", "")).strip()
        code = str(payload.get("code", "")).strip()
        account_type = str(payload.get("account_type", "")).strip()
        status_value = str(payload.get("status", TreasuryAccountStatus.ACTIVE)).strip()

        if not name:
            raise ValidationError({"name": "اسم الحساب مطلوب."})

        if not code:
            raise ValidationError({"code": "كود الحساب مطلوب."})

        if account_type not in TreasuryAccountType.values:
            raise ValidationError({"account_type": "نوع الحساب غير صحيح."})

        if status_value not in TreasuryAccountStatus.values:
            raise ValidationError({"status": "حالة الحساب غير صحيحة."})

        if TreasuryAccount.objects.filter(code=code).exists():
            raise ValidationError({"code": "كود الحساب مستخدم مسبقًا."})

        opening_balance = _to_decimal(
            payload.get("opening_balance", "0.00"),
            field_name="opening_balance",
        )

        current_balance = _to_decimal(
            payload.get("current_balance", opening_balance),
            field_name="current_balance",
            default=str(opening_balance),
        )

        is_default = _to_bool(payload.get("is_default"), default=False)

        with transaction.atomic():
            if is_default:
                TreasuryAccount.objects.filter(is_default=True).update(is_default=False)

            account = TreasuryAccount(
                name=name,
                code=code,
                account_type=account_type,
                status=status_value,
                ledger_account=_resolve_ledger_account(payload.get("ledger_account_id")),
                opening_balance=opening_balance,
                current_balance=current_balance,
                currency=str(payload.get("currency", "SAR") or "SAR").strip().upper(),
                bank_name=str(payload.get("bank_name", "") or "").strip(),
                account_holder_name=str(payload.get("account_holder_name", "") or "").strip(),
                account_number=str(payload.get("account_number", "") or "").strip(),
                iban=str(payload.get("iban", "") or "").strip(),
                branch_name=str(payload.get("branch_name", "") or "").strip(),
                description=str(payload.get("description", "") or "").strip(),
                is_default=is_default,
            )
            account.full_clean()
            account.save()

        return _json_response(
            success=True,
            message="تم إنشاء حساب الخزينة بنجاح.",
            data=serialize_treasury_account(account),
            status=201,
        )

    except ValidationError as exc:
        return _json_response(
            success=False,
            message="تعذر إنشاء حساب الخزينة.",
            errors=_serialize_validation_error(exc),
            status=400,
        )
    except Exception as exc:
        return _json_response(
            success=False,
            message="حدث خطأ غير متوقع أثناء إنشاء حساب الخزينة.",
            errors=str(exc),
            status=500,
        )


# ============================================================
# Treasury Transactions API
# ============================================================

@require_http_methods(["GET", "POST"])
def treasury_transactions(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        queryset = (
            TreasuryTransaction.objects.select_related(
                "treasury_account",
                "treasury_account__ledger_account",
                "destination_account",
                "destination_account__ledger_account",
            )
            .all()
            .order_by("-transaction_date", "-id")
        )
        queryset = _apply_transaction_filters(queryset, request)

        page = _get_int(request.GET.get("page"), default=1)
        page_size = _get_int(request.GET.get("page_size"), default=20)
        page_size = max(1, min(page_size, 100))

        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page)

        confirmed_qs = queryset.filter(status=TreasuryTransactionStatus.CONFIRMED)
        total_confirmed_amount = confirmed_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

        return _json_response(
            success=True,
            message="تم جلب حركات الخزينة بنجاح.",
            data={
                "items": [serialize_treasury_transaction(txn) for txn in page_obj.object_list],
                "pagination": _build_pagination_payload(paginator, page_obj),
                "summary": {
                    "total_transactions": queryset.count(),
                    "confirmed_transactions": confirmed_qs.count(),
                    "total_confirmed_amount": str(total_confirmed_amount),
                    "currency": request.GET.get("currency", "SAR") or "SAR",
                },
                "choices": {
                    "transaction_types": [
                        {"value": value, "label": label}
                        for value, label in TreasuryTransactionType.choices
                    ],
                    "statuses": [
                        {"value": value, "label": label}
                        for value, label in TreasuryTransactionStatus.choices
                    ],
                },
            },
        )

    try:
        payload = _read_json_body(request)

        transaction_number = str(payload.get("transaction_number", "")).strip()
        transaction_type = str(payload.get("transaction_type", "")).strip()
        status_value = str(payload.get("status", TreasuryTransactionStatus.DRAFT)).strip()
        transaction_date = parse_date(str(payload.get("transaction_date", "")).strip())

        if not transaction_number:
            raise ValidationError({"transaction_number": "رقم الحركة مطلوب."})

        if transaction_type not in TreasuryTransactionType.values:
            raise ValidationError({"transaction_type": "نوع الحركة غير صحيح."})

        if status_value not in TreasuryTransactionStatus.values:
            raise ValidationError({"status": "حالة الحركة غير صحيحة."})

        if not transaction_date:
            raise ValidationError({"transaction_date": "تاريخ الحركة مطلوب بصيغة YYYY-MM-DD."})

        treasury_account_id = payload.get("treasury_account_id")
        treasury_account = TreasuryAccount.objects.filter(pk=treasury_account_id).first()
        if not treasury_account:
            raise ValidationError({"treasury_account_id": "حساب الخزينة غير موجود."})

        destination_account = None
        destination_account_id = payload.get("destination_account_id")
        if destination_account_id not in (None, "", 0, "0"):
            destination_account = TreasuryAccount.objects.filter(pk=destination_account_id).first()
            if not destination_account:
                raise ValidationError({"destination_account_id": "حساب الوجهة غير موجود."})

        amount = _to_decimal(payload.get("amount"), field_name="amount")

        txn = create_treasury_transaction(
            transaction_number=transaction_number,
            transaction_type=transaction_type,
            treasury_account=treasury_account,
            transaction_date=transaction_date,
            amount=amount,
            currency=str(payload.get("currency", treasury_account.currency or "SAR") or "SAR").strip().upper(),
            status=status_value,
            destination_account=destination_account,
            reference=str(payload.get("reference", "") or "").strip(),
            external_reference=str(payload.get("external_reference", "") or "").strip(),
            description=str(payload.get("description", "") or "").strip(),
            notes=str(payload.get("notes", "") or "").strip(),
            journal_entry_reference=str(payload.get("journal_entry_reference", "") or "").strip(),
        )

        return _json_response(
            success=True,
            message="تم إنشاء حركة الخزينة بنجاح.",
            data=serialize_treasury_transaction(txn),
            status=201,
        )

    except ValidationError as exc:
        return _json_response(
            success=False,
            message="تعذر إنشاء حركة الخزينة.",
            errors=_serialize_validation_error(exc),
            status=400,
        )
    except Exception as exc:
        return _json_response(
            success=False,
            message="حدث خطأ غير متوقع أثناء إنشاء حركة الخزينة.",
            errors=str(exc),
            status=500,
        )