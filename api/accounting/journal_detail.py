# ============================================================
# 📂 api/accounting/journal_detail.py
# 🧠 Journal Entry Detail API — Primey Care V1
# ------------------------------------------------------------
# ✅ تفاصيل قيد يومية مفرد
# ✅ يرجع:
#    - بيانات القيد
#    - أسطر القيد
#    - الإجماليات
#    - حالة التوازن
# ------------------------------------------------------------

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from accounting.models import JournalEntry


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


def _error_response(message: str, status: int = 400, extra: dict | None = None) -> JsonResponse:
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


def _resolve_account_name(account) -> str | None:
    if not account:
        return None

    return (
        _safe_attr(account, "name", None)
        or _safe_attr(account, "name_ar", None)
        or _safe_attr(account, "name_en", None)
        or f"Account #{_safe_attr(account, 'id', '')}"
    )


# ============================================================
# 📘 Journal Entry Detail API
# ============================================================

@require_GET
def accounting_journal_entry_detail_api(request, journal_entry_id: int):
    """
    تفاصيل قيد يومية مفرد.
    """
    try:
        entry = JournalEntry.objects.prefetch_related("lines__account").filter(id=journal_entry_id).first()
        if not entry:
            return _error_response("القيد المطلوب غير موجود.", status=404)

        lines = list(entry.lines.all().order_by("sort_order", "id"))

        total_debit = _money(sum((_money(_safe_attr(line, "debit_amount", "0.00")) for line in lines), Decimal("0.00")))
        total_credit = _money(sum((_money(_safe_attr(line, "credit_amount", "0.00")) for line in lines), Decimal("0.00")))

        payload = {
            "entry": {
                "id": entry.id,
                "entry_number": _safe_attr(entry, "entry_number", None),
                "entry_date": (
                    _safe_attr(entry, "entry_date", None).isoformat()
                    if _safe_attr(entry, "entry_date", None)
                    else None
                ),
                "status": _safe_attr(entry, "status", None),
                "posting_source": _safe_attr(entry, "posting_source", None),
                "reference": _safe_attr(entry, "reference", None),
                "external_reference": _safe_attr(entry, "external_reference", None),
                "description": _safe_attr(entry, "description", None),
                "notes": _safe_attr(entry, "notes", None),
                "currency": _safe_attr(entry, "currency", "SAR"),
                "posted_at": (
                    _safe_attr(entry, "posted_at", None).isoformat()
                    if _safe_attr(entry, "posted_at", None)
                    else None
                ),
                "created_at": (
                    _safe_attr(entry, "created_at", None).isoformat()
                    if _safe_attr(entry, "created_at", None)
                    else None
                ),
                "updated_at": (
                    _safe_attr(entry, "updated_at", None).isoformat()
                    if _safe_attr(entry, "updated_at", None)
                    else None
                ),
            },
            "summary": {
                "line_count": len(lines),
                "total_debit": total_debit,
                "total_credit": total_credit,
                "is_balanced": total_debit == total_credit,
            },
            "lines": [
                {
                    "id": line.id,
                    "account_id": _safe_attr(line.account, "id", None),
                    "account_code": _safe_attr(line.account, "code", None),
                    "account_name": _resolve_account_name(line.account),
                    "account_type": _safe_attr(line.account, "account_type", None),
                    "description": _safe_attr(line, "description", None),
                    "debit_amount": _money(_safe_attr(line, "debit_amount", "0.00")),
                    "credit_amount": _money(_safe_attr(line, "credit_amount", "0.00")),
                    "sort_order": _safe_attr(line, "sort_order", 0),
                    "created_at": (
                        _safe_attr(line, "created_at", None).isoformat()
                        if _safe_attr(line, "created_at", None)
                        else None
                    ),
                }
                for line in lines
            ],
        }

        return _success_response(payload)

    except Exception as exc:
        logger.exception("Failed to load journal entry detail: %s", exc)
        return _error_response(
            "تعذر تحميل تفاصيل القيد اليومية.",
            status=500,
        )