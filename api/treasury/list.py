# ============================================================
# 📂 api/treasury/list.py
# 🧠 Primey Care | Treasury API - List/Create V2
# ------------------------------------------------------------
# ✅ قائمة حسابات الخزينة
# ✅ إنشاء حساب خزينة / بنك / بوابة دفع / محفظة
# ✅ aliases للصناديق والبنوك
# ✅ قائمة حركات الخزينة
# ✅ إنشاء حركة خزينة
# ✅ متوافق مع Treasury Backend الجديد
# ✅ يدعم:
#    - source
#    - source_type / source_id / source_number
#    - party_type / party_id / party_name
#    - fees_amount / net_amount
#    - balance_before / balance_after
#    - balance_applied / balance_reversed
#    - journal_entry / journal_entry_reference
#    - provider_name / merchant_id / settlement_days
#    - allow_negative_balance
#    - metadata
# ============================================================

from __future__ import annotations

import json
import logging
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from django.core.exceptions import ValidationError
from django.core.paginator import EmptyPage, Paginator
from django.db import transaction
from django.db.models import Q, Sum
from django.http import HttpRequest, JsonResponse
from django.utils import timezone
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
from treasury.services import create_treasury_transaction


logger = logging.getLogger(__name__)


# ============================================================
# Constants
# ============================================================

DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 200

ALLOWED_ACCOUNT_ORDERING = {
    "code": "code",
    "-code": "-code",
    "name": "name",
    "-name": "-name",
    "account_type": "account_type",
    "-account_type": "-account_type",
    "status": "status",
    "-status": "-status",
    "current_balance": "current_balance",
    "-current_balance": "-current_balance",
    "created_at": "created_at",
    "-created_at": "-created_at",
    "updated_at": "updated_at",
    "-updated_at": "-updated_at",
}

ALLOWED_TRANSACTION_ORDERING = {
    "transaction_date": "transaction_date",
    "-transaction_date": "-transaction_date",
    "id": "id",
    "-id": "-id",
    "transaction_number": "transaction_number",
    "-transaction_number": "-transaction_number",
    "transaction_type": "transaction_type",
    "-transaction_type": "-transaction_type",
    "source": "source",
    "-source": "-source",
    "status": "status",
    "-status": "-status",
    "amount": "amount",
    "-amount": "-amount",
    "net_amount": "net_amount",
    "-net_amount": "-net_amount",
    "fees_amount": "fees_amount",
    "-fees_amount": "-fees_amount",
    "source_number": "source_number",
    "-source_number": "-source_number",
    "created_at": "created_at",
    "-created_at": "-created_at",
    "updated_at": "updated_at",
    "-updated_at": "-updated_at",
}


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


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _to_decimal(value: Any, *, field_name: str, default: str = "0.00") -> Decimal:
    if value in (None, ""):
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


def _parse_optional_bool(value: Any) -> bool | None:
    if value in (None, ""):
        return None

    return _to_bool(value)


def _get_int(value: Any, *, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _parse_int(value: Any, *, field_name: str) -> int | None:
    if value in (None, "", 0, "0"):
        return None

    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError({field_name: "القيمة يجب أن تكون رقمًا صحيحًا."}) from exc

    if parsed <= 0:
        raise ValidationError({field_name: "القيمة يجب أن تكون أكبر من صفر."})

    return parsed


def _parse_ordering(
    value: str | None,
    *,
    allowed: dict[str, str],
    default: str,
) -> str:
    raw = (value or "").strip() or default

    if raw not in allowed:
        raise ValidationError(
            {
                "ordering": (
                    "قيمة الترتيب غير مدعومة. القيم المسموحة: "
                    + ", ".join(allowed.keys())
                )
            }
        )

    return allowed[raw]


def _serialize_validation_error(exc: ValidationError) -> Any:
    if hasattr(exc, "message_dict"):
        return exc.message_dict

    if hasattr(exc, "messages"):
        return exc.messages

    return str(exc)


def _enum_values(choices) -> set[str]:
    return {value for value, _label in choices}


def _validate_choice(value: str, choices, *, field_name: str, message: str) -> None:
    if value not in _enum_values(choices):
        raise ValidationError({field_name: message})


def _iso_date(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _safe_attr(obj: Any, attr_name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


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


def _parse_metadata(value: Any) -> dict[str, Any]:
    if value in (None, ""):
        return {}

    if not isinstance(value, dict):
        raise ValidationError({"metadata": "metadata يجب أن تكون كائن JSON."})

    return value


# ============================================================
# Serializers
# ============================================================

def _serialize_ledger_account(account: Account | None) -> dict[str, Any] | None:
    if not account:
        return None

    return {
        "id": account.pk,
        "code": getattr(account, "code", ""),
        "name": getattr(account, "name", ""),
        "name_ar": getattr(account, "name", ""),
        "name_en": getattr(account, "name_en", ""),
        "account_type": getattr(account, "account_type", ""),
        "nature": getattr(account, "nature", ""),
        "is_group": bool(getattr(account, "is_group", False)),
        "is_active": bool(getattr(account, "is_active", True)),
        "currency": getattr(account, "currency", "SAR"),
    }


def _serialize_user(user) -> dict[str, Any] | None:
    if not user:
        return None

    try:
        display_name = user.get_full_name()
    except Exception:
        display_name = ""

    return {
        "id": getattr(user, "id", None),
        "name": display_name or getattr(user, "email", "") or getattr(user, "username", ""),
        "email": getattr(user, "email", ""),
        "username": getattr(user, "username", ""),
    }


def _serialize_journal_entry(entry: JournalEntry | None) -> dict[str, Any] | None:
    if not entry:
        return None

    return {
        "id": entry.id,
        "entry_number": entry.entry_number,
        "entry_date": _iso_date(entry.entry_date),
        "status": entry.status,
        "posting_source": entry.posting_source,
        "reference": entry.reference,
        "source_type": entry.source_type,
        "source_id": entry.source_id,
        "source_number": entry.source_number,
        "total_debit": entry.total_debit,
        "total_credit": entry.total_credit,
        "currency": entry.currency,
    }


def serialize_treasury_account(
    account: TreasuryAccount,
    *,
    include_metadata: bool = True,
) -> dict[str, Any]:
    payload = {
        "id": account.pk,
        "name": account.name,
        "code": account.code,
        "account_type": account.account_type,
        "account_type_label": account.get_account_type_display(),
        "status": account.status,
        "status_label": account.get_status_display(),
        "ledger_account": _serialize_ledger_account(account.ledger_account),
        "ledger_account_id": account.ledger_account_id,
        "opening_balance": account.opening_balance,
        "current_balance": account.current_balance,
        "currency": account.currency,
        "bank_name": account.bank_name,
        "account_holder_name": account.account_holder_name,
        "account_number": account.account_number,
        "iban": account.iban,
        "branch_name": account.branch_name,
        "provider_name": account.provider_name,
        "merchant_id": account.merchant_id,
        "settlement_days": account.settlement_days,
        "allow_negative_balance": account.allow_negative_balance,
        "description": account.description,
        "is_default": account.is_default,
        "created_at": _iso_datetime(account.created_at),
        "updated_at": _iso_datetime(account.updated_at),
    }

    if include_metadata:
        payload["metadata"] = account.metadata or {}

    return payload


def serialize_treasury_transaction(
    txn: TreasuryTransaction,
    *,
    include_metadata: bool = True,
) -> dict[str, Any]:
    payload = {
        "id": txn.pk,
        "transaction_number": txn.transaction_number,
        "transaction_type": txn.transaction_type,
        "transaction_type_label": txn.get_transaction_type_display(),
        "source": txn.source,
        "source_label": txn.get_source_display(),
        "status": txn.status,
        "status_label": txn.get_status_display(),
        "transaction_date": _iso_date(txn.transaction_date),
        "treasury_account": serialize_treasury_account(txn.treasury_account, include_metadata=False),
        "treasury_account_id": txn.treasury_account_id,
        "destination_account": (
            serialize_treasury_account(txn.destination_account, include_metadata=False)
            if txn.destination_account_id
            else None
        ),
        "destination_account_id": txn.destination_account_id,
        "amount": txn.amount,
        "fees_amount": txn.fees_amount,
        "net_amount": txn.net_amount,
        "currency": txn.currency,
        "reference": txn.reference,
        "external_reference": txn.external_reference,
        "source_type": txn.source_type,
        "source_id": txn.source_id,
        "source_number": txn.source_number,
        "party_type": txn.party_type,
        "party_id": txn.party_id,
        "party_name": txn.party_name,
        "description": txn.description,
        "notes": txn.notes,
        "journal_entry": _serialize_journal_entry(txn.journal_entry),
        "journal_entry_id": txn.journal_entry_id,
        "journal_entry_reference": txn.journal_entry_reference,
        "balance_before": txn.balance_before,
        "balance_after": txn.balance_after,
        "balance_applied": txn.balance_applied,
        "balance_reversed": txn.balance_reversed,
        "created_by": _serialize_user(txn.created_by),
        "confirmed_by": _serialize_user(txn.confirmed_by),
        "cancelled_by": _serialize_user(txn.cancelled_by),
        "confirmed_at": _iso_datetime(txn.confirmed_at),
        "cancelled_at": _iso_datetime(txn.cancelled_at),
        "created_at": _iso_datetime(txn.created_at),
        "updated_at": _iso_datetime(txn.updated_at),
    }

    if include_metadata:
        payload["metadata"] = txn.metadata or {}

    return payload


def _build_pagination_payload(paginator: Paginator, page_obj) -> dict[str, Any]:
    return {
        "page": page_obj.number,
        "page_size": paginator.per_page,
        "total_pages": paginator.num_pages,
        "total_items": paginator.count,
        "has_next": page_obj.has_next(),
        "has_previous": page_obj.has_previous(),
        "next_page": page_obj.next_page_number() if page_obj.has_next() else None,
        "previous_page": page_obj.previous_page_number() if page_obj.has_previous() else None,
    }


# ============================================================
# Filters
# ============================================================

def _apply_account_filters(queryset, request: HttpRequest):
    search = request.GET.get("search", "").strip()
    account_type = request.GET.get("account_type", "").strip()
    status = request.GET.get("status", "").strip()
    currency = request.GET.get("currency", "").strip()
    provider_name = request.GET.get("provider_name", "").strip()
    is_default = _parse_optional_bool(request.GET.get("is_default"))
    allow_negative_balance = _parse_optional_bool(request.GET.get("allow_negative_balance"))
    has_ledger_account = _parse_optional_bool(request.GET.get("has_ledger_account"))

    if search:
        queryset = queryset.filter(
            Q(name__icontains=search)
            | Q(code__icontains=search)
            | Q(bank_name__icontains=search)
            | Q(account_holder_name__icontains=search)
            | Q(account_number__icontains=search)
            | Q(iban__icontains=search)
            | Q(branch_name__icontains=search)
            | Q(provider_name__icontains=search)
            | Q(merchant_id__icontains=search)
            | Q(description__icontains=search)
            | Q(ledger_account__code__icontains=search)
            | Q(ledger_account__name__icontains=search)
        )

    if account_type:
        _validate_choice(
            account_type,
            TreasuryAccountType.choices,
            field_name="account_type",
            message="نوع حساب الخزينة غير صحيح.",
        )
        queryset = queryset.filter(account_type=account_type)

    if status:
        _validate_choice(
            status,
            TreasuryAccountStatus.choices,
            field_name="status",
            message="حالة حساب الخزينة غير صحيحة.",
        )
        queryset = queryset.filter(status=status)

    if currency:
        queryset = queryset.filter(currency__iexact=currency)

    if provider_name:
        queryset = queryset.filter(provider_name__icontains=provider_name)

    if is_default is not None:
        queryset = queryset.filter(is_default=is_default)

    if allow_negative_balance is not None:
        queryset = queryset.filter(allow_negative_balance=allow_negative_balance)

    if has_ledger_account is True:
        queryset = queryset.filter(ledger_account__isnull=False)

    if has_ledger_account is False:
        queryset = queryset.filter(ledger_account__isnull=True)

    return queryset


def _apply_transaction_filters(queryset, request: HttpRequest):
    search = request.GET.get("search", "").strip()
    transaction_type = request.GET.get("transaction_type", "").strip()
    source = request.GET.get("source", "").strip()
    status = request.GET.get("status", "").strip()
    currency = request.GET.get("currency", "").strip()

    treasury_account_id = request.GET.get("treasury_account_id", "").strip()
    destination_account_id = request.GET.get("destination_account_id", "").strip()
    account_id = request.GET.get("account_id", "").strip()

    source_type = request.GET.get("source_type", "").strip()
    source_id = request.GET.get("source_id", "").strip()
    source_number = request.GET.get("source_number", "").strip()

    party_type = request.GET.get("party_type", "").strip()
    party_id = request.GET.get("party_id", "").strip()
    party_name = request.GET.get("party_name", "").strip()

    external_reference = request.GET.get("external_reference", "").strip()
    journal_entry_id = request.GET.get("journal_entry_id", "").strip()
    balance_applied = _parse_optional_bool(request.GET.get("balance_applied"))
    balance_reversed = _parse_optional_bool(request.GET.get("balance_reversed"))

    date_from_raw = request.GET.get("date_from", "").strip()
    date_to_raw = request.GET.get("date_to", "").strip()

    date_from = parse_date(date_from_raw) if date_from_raw else None
    date_to = parse_date(date_to_raw) if date_to_raw else None

    if date_from_raw and not date_from:
        raise ValidationError({"date_from": "صيغة التاريخ يجب أن تكون YYYY-MM-DD."})

    if date_to_raw and not date_to:
        raise ValidationError({"date_to": "صيغة التاريخ يجب أن تكون YYYY-MM-DD."})

    if date_from and date_to and date_from > date_to:
        raise ValidationError({"date_range": "لا يمكن أن يكون date_from أكبر من date_to."})

    if search:
        queryset = queryset.filter(
            Q(transaction_number__icontains=search)
            | Q(reference__icontains=search)
            | Q(external_reference__icontains=search)
            | Q(source_type__icontains=search)
            | Q(source_id__icontains=search)
            | Q(source_number__icontains=search)
            | Q(party_type__icontains=search)
            | Q(party_id__icontains=search)
            | Q(party_name__icontains=search)
            | Q(description__icontains=search)
            | Q(notes__icontains=search)
            | Q(journal_entry_reference__icontains=search)
            | Q(journal_entry__entry_number__icontains=search)
            | Q(treasury_account__name__icontains=search)
            | Q(treasury_account__code__icontains=search)
            | Q(destination_account__name__icontains=search)
            | Q(destination_account__code__icontains=search)
        )

    if transaction_type:
        _validate_choice(
            transaction_type,
            TreasuryTransactionType.choices,
            field_name="transaction_type",
            message="نوع حركة الخزينة غير صحيح.",
        )
        queryset = queryset.filter(transaction_type=transaction_type)

    if source:
        _validate_choice(
            source,
            TreasuryTransactionSource.choices,
            field_name="source",
            message="مصدر حركة الخزينة غير صحيح.",
        )
        queryset = queryset.filter(source=source)

    if status:
        _validate_choice(
            status,
            TreasuryTransactionStatus.choices,
            field_name="status",
            message="حالة حركة الخزينة غير صحيحة.",
        )
        queryset = queryset.filter(status=status)

    if currency:
        queryset = queryset.filter(currency__iexact=currency)

    if account_id:
        queryset = queryset.filter(
            Q(treasury_account_id=account_id)
            | Q(destination_account_id=account_id)
        )

    if treasury_account_id:
        queryset = queryset.filter(treasury_account_id=treasury_account_id)

    if destination_account_id:
        queryset = queryset.filter(destination_account_id=destination_account_id)

    if source_type:
        queryset = queryset.filter(source_type__icontains=source_type)

    if source_id:
        queryset = queryset.filter(source_id=source_id)

    if source_number:
        queryset = queryset.filter(source_number__icontains=source_number)

    if party_type:
        queryset = queryset.filter(party_type__icontains=party_type)

    if party_id:
        queryset = queryset.filter(party_id=party_id)

    if party_name:
        queryset = queryset.filter(party_name__icontains=party_name)

    if external_reference:
        queryset = queryset.filter(external_reference__icontains=external_reference)

    if journal_entry_id:
        queryset = queryset.filter(journal_entry_id=journal_entry_id)

    if balance_applied is not None:
        queryset = queryset.filter(balance_applied=balance_applied)

    if balance_reversed is not None:
        queryset = queryset.filter(balance_reversed=balance_reversed)

    if date_from:
        queryset = queryset.filter(transaction_date__gte=date_from)

    if date_to:
        queryset = queryset.filter(transaction_date__lte=date_to)

    return queryset


# ============================================================
# Summaries / Choices
# ============================================================

def _build_account_summary(queryset, *, currency: str = "SAR") -> dict[str, Any]:
    total_current_balance = queryset.aggregate(total=Sum("current_balance"))["total"] or Decimal("0.00")
    total_opening_balance = queryset.aggregate(total=Sum("opening_balance"))["total"] or Decimal("0.00")

    return {
        "total_accounts": queryset.count(),
        "active_accounts": queryset.filter(status=TreasuryAccountStatus.ACTIVE).count(),
        "inactive_accounts": queryset.exclude(status=TreasuryAccountStatus.ACTIVE).count(),
        "cashbox_accounts": queryset.filter(account_type=TreasuryAccountType.CASHBOX).count(),
        "bank_accounts": queryset.filter(account_type=TreasuryAccountType.BANK).count(),
        "gateway_accounts": queryset.filter(account_type=TreasuryAccountType.GATEWAY).count(),
        "wallet_accounts": queryset.filter(account_type=TreasuryAccountType.WALLET).count(),
        "default_accounts": queryset.filter(is_default=True).count(),
        "negative_balance_allowed_accounts": queryset.filter(allow_negative_balance=True).count(),
        "total_opening_balance": total_opening_balance,
        "total_current_balance": total_current_balance,
        "currency": currency or "SAR",
    }


def _build_transaction_summary(queryset, *, currency: str = "SAR") -> dict[str, Any]:
    confirmed_qs = queryset.filter(status=TreasuryTransactionStatus.CONFIRMED)

    inflow_types = [
        TreasuryTransactionType.INCOME,
        TreasuryTransactionType.OPENING_BALANCE,
        TreasuryTransactionType.DEPOSIT,
        TreasuryTransactionType.ADJUSTMENT,
    ]

    outflow_types = [
        TreasuryTransactionType.EXPENSE,
        TreasuryTransactionType.WITHDRAW,
        TreasuryTransactionType.REFUND,
        TreasuryTransactionType.FEE,
    ]

    income_total = confirmed_qs.filter(
        transaction_type__in=inflow_types,
    ).aggregate(total=Sum("net_amount"))["total"] or Decimal("0.00")

    expense_total = confirmed_qs.filter(
        transaction_type__in=outflow_types,
    ).aggregate(total=Sum("net_amount"))["total"] or Decimal("0.00")

    transfer_total = confirmed_qs.filter(
        transaction_type=TreasuryTransactionType.TRANSFER,
    ).aggregate(total=Sum("net_amount"))["total"] or Decimal("0.00")

    fees_total = confirmed_qs.aggregate(total=Sum("fees_amount"))["total"] or Decimal("0.00")
    gross_total = confirmed_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    net_total = confirmed_qs.aggregate(total=Sum("net_amount"))["total"] or Decimal("0.00")

    return {
        "total_transactions": queryset.count(),
        "draft_transactions": queryset.filter(status=TreasuryTransactionStatus.DRAFT).count(),
        "confirmed_transactions": confirmed_qs.count(),
        "cancelled_transactions": queryset.filter(status=TreasuryTransactionStatus.CANCELLED).count(),
        "income_total": income_total,
        "expense_total": expense_total,
        "transfer_total": transfer_total,
        "fees_total": fees_total,
        "gross_total": gross_total,
        "net_total": net_total,
        "net_operational_amount": Decimal(income_total) - Decimal(expense_total),
        "balance_applied_transactions": queryset.filter(balance_applied=True).count(),
        "balance_reversed_transactions": queryset.filter(balance_reversed=True).count(),
        "with_journal_entry_transactions": queryset.filter(journal_entry__isnull=False).count(),
        "currency": currency or "SAR",
    }


def _choices_payload() -> dict[str, Any]:
    return {
        "account_types": [
            {"value": value, "label": label}
            for value, label in TreasuryAccountType.choices
        ],
        "account_statuses": [
            {"value": value, "label": label}
            for value, label in TreasuryAccountStatus.choices
        ],
        "transaction_types": [
            {"value": value, "label": label}
            for value, label in TreasuryTransactionType.choices
        ],
        "transaction_sources": [
            {"value": value, "label": label}
            for value, label in TreasuryTransactionSource.choices
        ],
        "transaction_statuses": [
            {"value": value, "label": label}
            for value, label in TreasuryTransactionStatus.choices
        ],
        "account_orderings": [
            {"value": value, "label": value}
            for value in ALLOWED_ACCOUNT_ORDERING.keys()
        ],
        "transaction_orderings": [
            {"value": value, "label": value}
            for value in ALLOWED_TRANSACTION_ORDERING.keys()
        ],
    }


# ============================================================
# Treasury Accounts API
# ============================================================

@csrf_exempt
@require_http_methods(["GET", "POST"])
def treasury_accounts(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        return _list_treasury_accounts(request)

    return _create_treasury_account(request)


def _list_treasury_accounts(request: HttpRequest) -> JsonResponse:
    try:
        queryset = (
            TreasuryAccount.objects.select_related("ledger_account")
            .all()
        )
        queryset = _apply_account_filters(queryset, request)

        ordering = _parse_ordering(
            request.GET.get("ordering"),
            allowed=ALLOWED_ACCOUNT_ORDERING,
            default="account_type",
        )

        if ordering.lstrip("-") == "account_type":
            queryset = queryset.order_by(ordering, "code", "id")
        else:
            queryset = queryset.order_by(ordering, "account_type", "code", "id")

        page = _get_int(request.GET.get("page"), default=DEFAULT_PAGE)
        page_size = _get_int(request.GET.get("page_size"), default=DEFAULT_PAGE_SIZE)
        page_size = max(1, min(page_size, MAX_PAGE_SIZE))

        paginator = Paginator(queryset, page_size)

        try:
            page_obj = paginator.page(page)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages)

        include_metadata = _to_bool(request.GET.get("include_metadata"), default=True)

        return _json_response(
            success=True,
            message="تم جلب حسابات الخزينة بنجاح.",
            data={
                "items": [
                    serialize_treasury_account(
                        account,
                        include_metadata=include_metadata,
                    )
                    for account in page_obj.object_list
                ],
                "pagination": _build_pagination_payload(paginator, page_obj),
                "summary": _build_account_summary(
                    queryset,
                    currency=request.GET.get("currency", "SAR") or "SAR",
                ),
                "choices": _choices_payload(),
            },
        )

    except ValidationError as exc:
        return _json_response(
            success=False,
            message="تعذر جلب حسابات الخزينة.",
            errors=_serialize_validation_error(exc),
            status=400,
        )

    except Exception as exc:
        logger.exception("Failed to list treasury accounts: %s", exc)
        return _json_response(
            success=False,
            message="حدث خطأ غير متوقع أثناء جلب حسابات الخزينة.",
            errors=str(exc),
            status=500,
        )


@transaction.atomic
def _create_treasury_account(request: HttpRequest) -> JsonResponse:
    try:
        payload = _read_json_body(request)

        name = _clean_text(payload.get("name"))
        code = _clean_text(payload.get("code"))
        account_type = _clean_text(payload.get("account_type"))
        status_value = _clean_text(payload.get("status") or TreasuryAccountStatus.ACTIVE)

        if not name:
            raise ValidationError({"name": "اسم الحساب مطلوب."})

        if not code:
            raise ValidationError({"code": "كود الحساب مطلوب."})

        _validate_choice(
            account_type,
            TreasuryAccountType.choices,
            field_name="account_type",
            message="نوع الحساب غير صحيح.",
        )
        _validate_choice(
            status_value,
            TreasuryAccountStatus.choices,
            field_name="status",
            message="حالة الحساب غير صحيحة.",
        )

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
            currency=_clean_text(payload.get("currency") or "SAR").upper(),
            bank_name=_clean_text(payload.get("bank_name")),
            account_holder_name=_clean_text(payload.get("account_holder_name")),
            account_number=_clean_text(payload.get("account_number")),
            iban=_clean_text(payload.get("iban")),
            branch_name=_clean_text(payload.get("branch_name")),
            provider_name=_clean_text(payload.get("provider_name")),
            merchant_id=_clean_text(payload.get("merchant_id")),
            settlement_days=int(payload.get("settlement_days") or 0),
            allow_negative_balance=_to_bool(
                payload.get("allow_negative_balance"),
                default=False,
            ),
            description=_clean_text(payload.get("description")),
            is_default=is_default,
            metadata=_parse_metadata(payload.get("metadata")),
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
        logger.exception("Failed to create treasury account: %s", exc)
        return _json_response(
            success=False,
            message="حدث خطأ غير متوقع أثناء إنشاء حساب الخزينة.",
            errors=str(exc),
            status=500,
        )


# ============================================================
# Cashboxes / Banks aliases
# ============================================================

@csrf_exempt
@require_http_methods(["GET", "POST"])
def treasury_cashboxes(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        query_params = request.GET.copy()
        query_params["account_type"] = TreasuryAccountType.CASHBOX
        request.GET = query_params

    if request.method == "POST":
        payload = _read_json_body(request)
        payload["account_type"] = TreasuryAccountType.CASHBOX
        request._body = json.dumps(payload).encode("utf-8")

    return treasury_accounts(request)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def treasury_banks(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        query_params = request.GET.copy()
        query_params["account_type"] = TreasuryAccountType.BANK
        request.GET = query_params

    if request.method == "POST":
        payload = _read_json_body(request)
        payload["account_type"] = TreasuryAccountType.BANK
        request._body = json.dumps(payload).encode("utf-8")

    return treasury_accounts(request)


# ============================================================
# Treasury Transactions API
# ============================================================

@csrf_exempt
@require_http_methods(["GET", "POST"])
def treasury_transactions(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        return _list_treasury_transactions(request)

    return _create_treasury_transaction(request)


def _list_treasury_transactions(request: HttpRequest) -> JsonResponse:
    try:
        queryset = (
            TreasuryTransaction.objects.select_related(
                "treasury_account",
                "treasury_account__ledger_account",
                "destination_account",
                "destination_account__ledger_account",
                "journal_entry",
                "created_by",
                "confirmed_by",
                "cancelled_by",
            )
            .all()
        )
        queryset = _apply_transaction_filters(queryset, request)

        ordering = _parse_ordering(
            request.GET.get("ordering"),
            allowed=ALLOWED_TRANSACTION_ORDERING,
            default="-transaction_date",
        )

        if ordering.lstrip("-") == "transaction_date":
            queryset = queryset.order_by(ordering, "-id")
        else:
            queryset = queryset.order_by(ordering, "-transaction_date", "-id")

        page = _get_int(request.GET.get("page"), default=DEFAULT_PAGE)
        page_size = _get_int(request.GET.get("page_size"), default=DEFAULT_PAGE_SIZE)
        page_size = max(1, min(page_size, MAX_PAGE_SIZE))

        paginator = Paginator(queryset, page_size)

        try:
            page_obj = paginator.page(page)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages)

        include_metadata = _to_bool(request.GET.get("include_metadata"), default=True)

        return _json_response(
            success=True,
            message="تم جلب حركات الخزينة بنجاح.",
            data={
                "items": [
                    serialize_treasury_transaction(
                        txn,
                        include_metadata=include_metadata,
                    )
                    for txn in page_obj.object_list
                ],
                "pagination": _build_pagination_payload(paginator, page_obj),
                "summary": _build_transaction_summary(
                    queryset,
                    currency=request.GET.get("currency", "SAR") or "SAR",
                ),
                "choices": _choices_payload(),
            },
        )

    except ValidationError as exc:
        return _json_response(
            success=False,
            message="تعذر جلب حركات الخزينة.",
            errors=_serialize_validation_error(exc),
            status=400,
        )

    except Exception as exc:
        logger.exception("Failed to list treasury transactions: %s", exc)
        return _json_response(
            success=False,
            message="حدث خطأ غير متوقع أثناء جلب حركات الخزينة.",
            errors=str(exc),
            status=500,
        )


@transaction.atomic
def _create_treasury_transaction(request: HttpRequest) -> JsonResponse:
    try:
        payload = _read_json_body(request)

        transaction_number = _clean_text(payload.get("transaction_number"))
        transaction_type = _clean_text(payload.get("transaction_type"))
        source = _clean_text(payload.get("source") or TreasuryTransactionSource.MANUAL)
        status_value = _clean_text(payload.get("status") or TreasuryTransactionStatus.DRAFT)

        transaction_date_raw = _clean_text(payload.get("transaction_date"))
        transaction_date = parse_date(transaction_date_raw) if transaction_date_raw else timezone.localdate()

        if not transaction_number:
            raise ValidationError({"transaction_number": "رقم الحركة مطلوب."})

        if TreasuryTransaction.objects.filter(transaction_number=transaction_number).exists():
            raise ValidationError({"transaction_number": "رقم الحركة مستخدم مسبقًا."})

        _validate_choice(
            transaction_type,
            TreasuryTransactionType.choices,
            field_name="transaction_type",
            message="نوع الحركة غير صحيح.",
        )
        _validate_choice(
            source,
            TreasuryTransactionSource.choices,
            field_name="source",
            message="مصدر الحركة غير صحيح.",
        )
        _validate_choice(
            status_value,
            TreasuryTransactionStatus.choices,
            field_name="status",
            message="حالة الحركة غير صحيحة.",
        )

        if transaction_date_raw and not transaction_date:
            raise ValidationError({"transaction_date": "تاريخ الحركة مطلوب بصيغة YYYY-MM-DD."})

        treasury_account = _resolve_treasury_account(
            payload.get("treasury_account_id"),
            field_name="treasury_account_id",
        )
        if not treasury_account:
            raise ValidationError({"treasury_account_id": "حساب الخزينة مطلوب."})

        destination_account = _resolve_treasury_account(
            payload.get("destination_account_id"),
            field_name="destination_account_id",
        )

        amount = _to_decimal(payload.get("amount"), field_name="amount")
        fees_amount = _to_decimal(
            payload.get("fees_amount", "0.00"),
            field_name="fees_amount",
        )
        net_amount = (
            _to_decimal(payload.get("net_amount"), field_name="net_amount")
            if payload.get("net_amount") not in (None, "")
            else None
        )

        journal_entry = _resolve_journal_entry(payload.get("journal_entry_id"))

        actor = request.user if getattr(request, "user", None) and request.user.is_authenticated else None

        txn = create_treasury_transaction(
            transaction_number=transaction_number,
            transaction_type=transaction_type,
            source=source,
            treasury_account=treasury_account,
            transaction_date=transaction_date,
            amount=amount,
            fees_amount=fees_amount,
            net_amount=net_amount,
            currency=_clean_text(payload.get("currency") or treasury_account.currency or "SAR").upper(),
            status=status_value,
            destination_account=destination_account,
            reference=_clean_text(payload.get("reference")),
            external_reference=_clean_text(payload.get("external_reference")),
            description=_clean_text(payload.get("description")),
            notes=_clean_text(payload.get("notes")),
            journal_entry=journal_entry,
            journal_entry_reference=_clean_text(
                payload.get("journal_entry_reference")
                or getattr(journal_entry, "entry_number", "")
            ),
            source_type=_clean_text(payload.get("source_type")),
            source_id=_clean_text(payload.get("source_id")),
            source_number=_clean_text(payload.get("source_number")),
            party_type=_clean_text(payload.get("party_type")),
            party_id=_clean_text(payload.get("party_id")),
            party_name=_clean_text(payload.get("party_name")),
            metadata=_parse_metadata(payload.get("metadata")),
            actor=actor,
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
        logger.exception("Failed to create treasury transaction: %s", exc)
        return _json_response(
            success=False,
            message="حدث خطأ غير متوقع أثناء إنشاء حركة الخزينة.",
            errors=str(exc),
            status=500,
        )