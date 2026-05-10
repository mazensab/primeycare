# ============================================================
# 📂 api/accounting/journal_detail.py
# 🧠 Journal Entry Detail API — Primey Care V2
# ------------------------------------------------------------
# ✅ تفاصيل قيد يومية مفرد
# ✅ متوافق مع Accounting Backend الجديد
# ✅ يرجع:
#    - بيانات القيد
#    - الفترة المالية
#    - المصدر التشغيلي
#    - بيانات العكس
#    - المستخدمين
#    - أسطر القيد
#    - الحسابات
#    - مراكز التكلفة
#    - الضرائب
#    - الطرف المرتبط
#    - الإجماليات
#    - حالة التوازن
# ✅ يدعم:
#    - include_metadata=true
# ------------------------------------------------------------
# ملاحظات:
# - هذا API قراءة فقط.
# - إنشاء/ترحيل/عكس القيود يجب أن يتم من services أو endpoint مخصص لاحقًا.
# ============================================================

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from accounting.models import JournalEntry, JournalEntryLine


logger = logging.getLogger(__name__)


# ============================================================
# 🔧 Helpers
# ============================================================

def _money(value: Decimal | int | float | str | None) -> Decimal:
    amount = Decimal(str(value or "0.00"))
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


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


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value in {None, ""}:
        return default

    raw = str(value).strip().lower()

    if raw in {"1", "true", "yes", "on"}:
        return True

    if raw in {"0", "false", "no", "off"}:
        return False

    return default


def _error_response(
    message: str,
    status: int = 400,
    extra: dict | None = None,
) -> JsonResponse:
    payload = {
        "ok": False,
        "message": message,
    }

    if extra:
        payload.update(extra)

    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )


def _success_response(data: dict[str, Any]) -> JsonResponse:
    return JsonResponse(
        {
            "ok": True,
            "data": _decimal_to_string(data),
        },
        status=200,
        json_dumps_params={"ensure_ascii": False},
    )


def _safe_attr(obj: Any, attr_name: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _call_display(obj: Any, method_name: str, default: Any = None) -> Any:
    try:
        method = getattr(obj, method_name, None)
        if callable(method):
            return method()
    except Exception:
        return default

    return default


def _iso_datetime(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _iso_date(value: Any) -> str | None:
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return None


def _resolve_account_name(account) -> str | None:
    if not account:
        return None

    return (
        _safe_attr(account, "name", None)
        or _safe_attr(account, "name_ar", None)
        or _safe_attr(account, "name_en", None)
        or f"Account #{_safe_attr(account, 'id', '')}"
    )


def _resolve_user_name(user) -> str:
    if not user:
        return ""

    try:
        full_name = user.get_full_name()
    except Exception:
        full_name = ""

    return (
        full_name
        or _safe_attr(user, "email", "")
        or _safe_attr(user, "username", "")
        or f"User #{_safe_attr(user, 'id', '')}"
    )


def _serialize_user(user) -> dict[str, Any] | None:
    if not user:
        return None

    return {
        "id": _safe_attr(user, "id", None),
        "name": _resolve_user_name(user),
        "email": _safe_attr(user, "email", ""),
        "username": _safe_attr(user, "username", ""),
    }


def _serialize_period(period) -> dict[str, Any] | None:
    if not period:
        return None

    fiscal_year = _safe_attr(period, "fiscal_year", None)

    return {
        "id": _safe_attr(period, "id", None),
        "name": _safe_attr(period, "name", None),
        "start_date": _iso_date(_safe_attr(period, "start_date", None)),
        "end_date": _iso_date(_safe_attr(period, "end_date", None)),
        "status": _safe_attr(period, "status", None),
        "status_label": _call_display(period, "get_status_display", _safe_attr(period, "status", None)),
        "is_adjustment_period": bool(_safe_attr(period, "is_adjustment_period", False)),
        "fiscal_year": {
            "id": _safe_attr(fiscal_year, "id", None),
            "name": _safe_attr(fiscal_year, "name", None),
            "start_date": _iso_date(_safe_attr(fiscal_year, "start_date", None)),
            "end_date": _iso_date(_safe_attr(fiscal_year, "end_date", None)),
            "status": _safe_attr(fiscal_year, "status", None),
        } if fiscal_year else None,
    }


def _serialize_entry_reference(entry: JournalEntry | None) -> dict[str, Any] | None:
    if not entry:
        return None

    return {
        "id": _safe_attr(entry, "id", None),
        "entry_number": _safe_attr(entry, "entry_number", None),
        "entry_date": _iso_date(_safe_attr(entry, "entry_date", None)),
        "status": _safe_attr(entry, "status", None),
        "status_label": _call_display(entry, "get_status_display", _safe_attr(entry, "status", None)),
        "posting_source": _safe_attr(entry, "posting_source", None),
        "posting_source_label": _call_display(
            entry,
            "get_posting_source_display",
            _safe_attr(entry, "posting_source", None),
        ),
        "reference": _safe_attr(entry, "reference", ""),
        "external_reference": _safe_attr(entry, "external_reference", ""),
        "source_type": _safe_attr(entry, "source_type", ""),
        "source_id": _safe_attr(entry, "source_id", ""),
        "source_number": _safe_attr(entry, "source_number", ""),
    }


def _serialize_account(account) -> dict[str, Any] | None:
    if not account:
        return None

    return {
        "id": _safe_attr(account, "id", None),
        "code": _safe_attr(account, "code", None),
        "name": _resolve_account_name(account),
        "name_ar": _safe_attr(account, "name", None),
        "name_en": _safe_attr(account, "name_en", ""),
        "account_type": _safe_attr(account, "account_type", None),
        "account_type_label": _call_display(
            account,
            "get_account_type_display",
            _safe_attr(account, "account_type", None),
        ),
        "nature": _safe_attr(account, "nature", None),
        "nature_label": _call_display(account, "get_nature_display", _safe_attr(account, "nature", None)),
        "level": int(_safe_attr(account, "level", 1) or 1),
        "is_group": bool(_safe_attr(account, "is_group", False)),
        "is_active": bool(_safe_attr(account, "is_active", True)),
        "allow_manual_posting": bool(_safe_attr(account, "allow_manual_posting", True)),
        "is_system": bool(_safe_attr(account, "is_system", False)),
        "currency": _safe_attr(account, "currency", "SAR"),
        "can_post": bool(
            _safe_attr(account, "is_active", True)
            and not _safe_attr(account, "is_group", False)
        ),
    }


def _serialize_cost_center(cost_center) -> dict[str, Any] | None:
    if not cost_center:
        return None

    return {
        "id": _safe_attr(cost_center, "id", None),
        "code": _safe_attr(cost_center, "code", None),
        "name": _safe_attr(cost_center, "name", None),
        "name_en": _safe_attr(cost_center, "name_en", ""),
        "level": int(_safe_attr(cost_center, "level", 1) or 1),
        "is_group": bool(_safe_attr(cost_center, "is_group", False)),
        "status": _safe_attr(cost_center, "status", None),
        "status_label": _call_display(
            cost_center,
            "get_status_display",
            _safe_attr(cost_center, "status", None),
        ),
    }


def _serialize_tax_rate(tax_rate) -> dict[str, Any] | None:
    if not tax_rate:
        return None

    return {
        "id": _safe_attr(tax_rate, "id", None),
        "code": _safe_attr(tax_rate, "code", None),
        "name": _safe_attr(tax_rate, "name", None),
        "tax_type": _safe_attr(tax_rate, "tax_type", None),
        "tax_type_label": _call_display(tax_rate, "get_tax_type_display", _safe_attr(tax_rate, "tax_type", None)),
        "rate": _money(_safe_attr(tax_rate, "rate", "0.00")),
        "is_active": bool(_safe_attr(tax_rate, "is_active", True)),
        "is_default": bool(_safe_attr(tax_rate, "is_default", False)),
    }


def _serialize_line(
    line: JournalEntryLine,
    *,
    include_metadata: bool = False,
) -> dict[str, Any]:
    debit_amount = _money(_safe_attr(line, "debit_amount", "0.00"))
    credit_amount = _money(_safe_attr(line, "credit_amount", "0.00"))
    tax_amount = _money(_safe_attr(line, "tax_amount", "0.00"))

    payload = {
        "id": _safe_attr(line, "id", None),
        "journal_entry_id": _safe_attr(line, "journal_entry_id", None),
        "account_id": _safe_attr(line, "account_id", None),
        "account_code": _safe_attr(_safe_attr(line, "account", None), "code", None),
        "account_name": _resolve_account_name(_safe_attr(line, "account", None)),
        "account_type": _safe_attr(_safe_attr(line, "account", None), "account_type", None),
        "account": _serialize_account(_safe_attr(line, "account", None)),
        "cost_center_id": _safe_attr(line, "cost_center_id", None),
        "cost_center": _serialize_cost_center(_safe_attr(line, "cost_center", None)),
        "tax_rate_id": _safe_attr(line, "tax_rate_id", None),
        "tax_rate": _serialize_tax_rate(_safe_attr(line, "tax_rate", None)),
        "description": _safe_attr(line, "description", ""),
        "debit_amount": debit_amount,
        "credit_amount": credit_amount,
        "tax_amount": tax_amount,
        "party_type": _safe_attr(line, "party_type", ""),
        "party_id": _safe_attr(line, "party_id", ""),
        "source_line_id": _safe_attr(line, "source_line_id", ""),
        "sort_order": int(_safe_attr(line, "sort_order", 0) or 0),
        "line_type": (
            "DEBIT"
            if debit_amount > Decimal("0.00")
            else "CREDIT"
            if credit_amount > Decimal("0.00")
            else "ZERO"
        ),
        "amount": debit_amount if debit_amount > Decimal("0.00") else credit_amount,
        "created_at": _iso_datetime(_safe_attr(line, "created_at", None)),
        "updated_at": _iso_datetime(_safe_attr(line, "updated_at", None)),
    }

    if include_metadata:
        payload["metadata"] = _safe_attr(line, "metadata", {}) or {}

    return payload


def _serialize_entry(
    entry: JournalEntry,
    *,
    include_metadata: bool = False,
) -> dict[str, Any]:
    total_debit = _money(_safe_attr(entry, "total_debit", "0.00"))
    total_credit = _money(_safe_attr(entry, "total_credit", "0.00"))

    payload = {
        "id": _safe_attr(entry, "id", None),
        "entry_number": _safe_attr(entry, "entry_number", None),
        "entry_date": _iso_date(_safe_attr(entry, "entry_date", None)),
        "period_id": _safe_attr(entry, "period_id", None),
        "period": _serialize_period(_safe_attr(entry, "period", None)),
        "status": _safe_attr(entry, "status", None),
        "status_label": _call_display(entry, "get_status_display", _safe_attr(entry, "status", None)),
        "posting_source": _safe_attr(entry, "posting_source", None),
        "posting_source_label": _call_display(
            entry,
            "get_posting_source_display",
            _safe_attr(entry, "posting_source", None),
        ),
        "reference": _safe_attr(entry, "reference", ""),
        "external_reference": _safe_attr(entry, "external_reference", ""),
        "source_type": _safe_attr(entry, "source_type", ""),
        "source_id": _safe_attr(entry, "source_id", ""),
        "source_number": _safe_attr(entry, "source_number", ""),
        "description": _safe_attr(entry, "description", ""),
        "notes": _safe_attr(entry, "notes", ""),
        "currency": _safe_attr(entry, "currency", "SAR"),
        "total_debit": total_debit,
        "total_credit": total_credit,
        "is_balanced": total_debit == total_credit,
        "is_zero": total_debit == Decimal("0.00") and total_credit == Decimal("0.00"),
        "is_auto_posted": bool(_safe_attr(entry, "is_auto_posted", False)),
        "reversal_of_id": _safe_attr(entry, "reversal_of_id", None),
        "reversal_of": _serialize_entry_reference(_safe_attr(entry, "reversal_of", None)),
        "reversed_entry_id": _safe_attr(entry, "reversed_entry_id", None),
        "reversed_entry": _serialize_entry_reference(_safe_attr(entry, "reversed_entry", None)),
        "created_by": _serialize_user(_safe_attr(entry, "created_by", None)),
        "posted_by": _serialize_user(_safe_attr(entry, "posted_by", None)),
        "cancelled_by": _serialize_user(_safe_attr(entry, "cancelled_by", None)),
        "posted_at": _iso_datetime(_safe_attr(entry, "posted_at", None)),
        "cancelled_at": _iso_datetime(_safe_attr(entry, "cancelled_at", None)),
        "reversed_at": _iso_datetime(_safe_attr(entry, "reversed_at", None)),
        "created_at": _iso_datetime(_safe_attr(entry, "created_at", None)),
        "updated_at": _iso_datetime(_safe_attr(entry, "updated_at", None)),
    }

    if include_metadata:
        payload["metadata"] = _safe_attr(entry, "metadata", {}) or {}

    return payload


# ============================================================
# 📘 Journal Entry Detail API
# ============================================================

@require_GET
def accounting_journal_entry_detail_api(request, journal_entry_id: int):
    """
    تفاصيل قيد يومية مفرد.
    """
    try:
        include_metadata = _parse_bool(
            request.GET.get("include_metadata"),
            default=False,
        )

        entry = (
            JournalEntry.objects.select_related(
                "period",
                "period__fiscal_year",
                "reversal_of",
                "reversed_entry",
                "created_by",
                "posted_by",
                "cancelled_by",
            )
            .prefetch_related(
                "lines",
                "lines__account",
                "lines__cost_center",
                "lines__tax_rate",
            )
            .filter(id=journal_entry_id)
            .first()
        )

        if not entry:
            return _error_response("القيد المطلوب غير موجود.", status=404)

        lines = list(
            entry.lines.select_related(
                "account",
                "cost_center",
                "tax_rate",
            ).order_by("sort_order", "id")
        )

        total_debit = _money(
            sum(
                (
                    _money(_safe_attr(line, "debit_amount", "0.00"))
                    for line in lines
                ),
                Decimal("0.00"),
            )
        )
        total_credit = _money(
            sum(
                (
                    _money(_safe_attr(line, "credit_amount", "0.00"))
                    for line in lines
                ),
                Decimal("0.00"),
            )
        )
        total_tax = _money(
            sum(
                (
                    _money(_safe_attr(line, "tax_amount", "0.00"))
                    for line in lines
                ),
                Decimal("0.00"),
            )
        )

        debit_lines_count = sum(
            1
            for line in lines
            if _money(_safe_attr(line, "debit_amount", "0.00")) > Decimal("0.00")
        )
        credit_lines_count = sum(
            1
            for line in lines
            if _money(_safe_attr(line, "credit_amount", "0.00")) > Decimal("0.00")
        )

        payload = {
            "entry": _serialize_entry(entry, include_metadata=include_metadata),
            "summary": {
                "line_count": len(lines),
                "debit_lines_count": debit_lines_count,
                "credit_lines_count": credit_lines_count,
                "total_debit": total_debit,
                "total_credit": total_credit,
                "total_tax": total_tax,
                "difference": _money(total_debit - total_credit),
                "is_balanced": total_debit == total_credit,
                "is_zero": total_debit == Decimal("0.00") and total_credit == Decimal("0.00"),
                "can_edit_lines": bool(_safe_attr(entry, "can_edit_lines", False)),
                "is_posted": bool(_safe_attr(entry, "is_posted", False)),
                "is_cancelled": bool(_safe_attr(entry, "is_cancelled", False)),
                "is_reversed": bool(_safe_attr(entry, "is_reversed", False)),
            },
            "lines": [
                _serialize_line(line, include_metadata=include_metadata)
                for line in lines
            ],
            "filters": {
                "include_metadata": include_metadata,
            },
        }

        return _success_response(payload)

    except Exception as exc:
        logger.exception("Failed to load journal entry detail: %s", exc)
        return _error_response(
            "تعذر تحميل تفاصيل القيد اليومية.",
            status=500,
        )