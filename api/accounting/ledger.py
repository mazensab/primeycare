# ============================================================
# 📂 api/accounting/ledger.py
# 🧠 General Ledger API — Primey Care V1.3
# ------------------------------------------------------------
# ✅ دفتر الأستاذ العام
# ✅ يدعم:
#    - account_id اختياري
#    - date_from
#    - date_to
#    - posted_only
#    - include_opening
#    - page
#    - page_size
#    - ordering
# ✅ Excel Export:
#    - Ledger Excel
# ✅ يرجع:
#    - الفلاتر
#    - الرصيد الافتتاحي
#    - إجماليات الفترة
#    - الرصيد الجاري running balance
#    - الحركات مرتبة محاسبيًا
#    - بيانات التصفح pagination
# ------------------------------------------------------------
# ملاحظة:
# - يعتمد على Account.nature وليس normal_balance
#   لأن موديل المحاسبة الرسمي يستخدم nature.
# ============================================================

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO
from typing import Any

from django.core.paginator import EmptyPage, Paginator
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

from accounting.models import Account, JournalEntryLine, JournalEntryStatus


logger = logging.getLogger(__name__)


# ============================================================
# 🔧 Helpers
# ============================================================

DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 500

ALLOWED_ORDERING = {
    "entry_date": "journal_entry__entry_date",
    "-entry_date": "-journal_entry__entry_date",
    "id": "id",
    "-id": "-id",
    "created_at": "created_at",
    "-created_at": "-created_at",
    "account_code": "account__code",
    "-account_code": "-account__code",
    "debit_amount": "debit_amount",
    "-debit_amount": "-debit_amount",
    "credit_amount": "credit_amount",
    "-credit_amount": "-credit_amount",
}


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
    if value is None:
        return default

    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _parse_int(value: str | None, field_name: str) -> int | None:
    if value in {None, ""}:
        return None

    raw_value = str(value).strip()

    try:
        parsed = int(raw_value)
    except ValueError as exc:
        raise ValueError(f"قيمة {field_name} يجب أن تكون رقمًا صحيحًا.") from exc

    if parsed <= 0:
        raise ValueError(f"قيمة {field_name} يجب أن تكون أكبر من صفر.")

    return parsed


def _parse_positive_int(
    value: str | None,
    field_name: str,
    *,
    default: int,
    min_value: int = 1,
    max_value: int | None = None,
) -> int:
    if value in {None, ""}:
        parsed = default
    else:
        raw_value = str(value).strip()

        try:
            parsed = int(raw_value)
        except ValueError as exc:
            raise ValueError(f"قيمة {field_name} يجب أن تكون رقمًا صحيحًا.") from exc

    if parsed < min_value:
        raise ValueError(f"قيمة {field_name} يجب أن تكون أكبر أو تساوي {min_value}.")

    if max_value is not None and parsed > max_value:
        raise ValueError(f"قيمة {field_name} يجب ألا تتجاوز {max_value}.")

    return parsed


def _parse_date(value: str | None, field_name: str) -> date | None:
    if not value:
        return None

    raw_value = str(value).strip()

    try:
        return date.fromisoformat(raw_value)
    except ValueError as exc:
        raise ValueError(
            f"قيمة {field_name} غير صحيحة. استخدم الصيغة YYYY-MM-DD."
        ) from exc


def _parse_ordering(value: str | None, default: str = "entry_date") -> str:
    raw_value = (value or "").strip() or default

    if raw_value not in ALLOWED_ORDERING:
        allowed = ", ".join(ALLOWED_ORDERING.keys())
        raise ValueError(f"قيمة ordering غير مدعومة. القيم المسموحة: {allowed}")

    return raw_value


def _validate_date_range(date_from: date | None, date_to: date | None) -> None:
    if date_from and date_to and date_from > date_to:
        raise ValueError("لا يمكن أن يكون date_from أكبر من date_to.")


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


def _safe_sheet_title(title: str) -> str:
    invalid_chars = ["\\", "/", "*", "[", "]", ":", "?"]
    clean = title

    for char in invalid_chars:
        clean = clean.replace(char, "-")

    return clean[:31]


def _auto_fit_columns(ws) -> None:
    for column_cells in ws.columns:
        first_real_cell = None
        max_length = 0

        for cell in column_cells:
            if hasattr(cell, "column_letter"):
                first_real_cell = cell
                break

        if first_real_cell is None:
            continue

        column_letter = first_real_cell.column_letter

        for cell in column_cells:
            try:
                cell_length = len(str(cell.value or ""))
                if cell_length > max_length:
                    max_length = cell_length
            except Exception:
                continue

        ws.column_dimensions[column_letter].width = min(max(max_length + 2, 12), 40)


def _apply_header_style(cell) -> None:
    cell.font = Font(bold=True)
    cell.fill = PatternFill(fill_type="solid", fgColor="D9EAF7")
    cell.alignment = Alignment(horizontal="center", vertical="center")


def _add_meta_rows(ws, title: str, meta_rows: list[tuple[str, Any]]) -> int:
    ws.append([title])
    ws["A1"].font = Font(bold=True, size=14)
    ws["A1"].alignment = Alignment(horizontal="center")
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=6)

    current_row = 3

    for label, value in meta_rows:
        ws.cell(row=current_row, column=1, value=label)
        ws.cell(
            row=current_row,
            column=2,
            value=str(value) if value is not None else "",
        )
        ws.cell(row=current_row, column=1).font = Font(bold=True)
        current_row += 1

    return current_row + 1


def _build_excel_response(workbook: Workbook, filename: str) -> HttpResponse:
    output = BytesIO()
    workbook.save(output)
    output.seek(0)

    response = HttpResponse(
        output.read(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def _resolve_account_name(account: Account | None) -> str | None:
    if not account:
        return None

    return (
        _safe_attr(account, "name", None)
        or _safe_attr(account, "name_ar", None)
        or _safe_attr(account, "name_en", None)
        or f"Account #{account.pk}"
    )


def _resolve_account_nature(account: Account | None) -> str:
    """
    يرجع طبيعة الحساب الرسمية:
    DEBIT / CREDIT
    """
    if not account:
        return "DEBIT"

    return str(_safe_attr(account, "nature", "") or "DEBIT").upper()


def _resolve_account_nature_label(account: Account | None) -> str | None:
    if not account:
        return None

    if hasattr(account, "get_nature_display"):
        return account.get_nature_display()

    nature = _resolve_account_nature(account)

    if nature == "DEBIT":
        return "مدين"

    if nature == "CREDIT":
        return "دائن"

    return None


def _account_signed_delta(
    *,
    account_nature: str | None,
    debit_amount: Decimal,
    credit_amount: Decimal,
) -> Decimal:
    if str(account_nature or "").upper() == "CREDIT":
        return _money(credit_amount - debit_amount)

    return _money(debit_amount - credit_amount)


def _build_order_by(ordering_key: str) -> list[str]:
    field_name = ALLOWED_ORDERING[ordering_key]

    if ordering_key.startswith("-"):
        return [field_name, "-journal_entry__id", "-sort_order", "-id"]

    return [field_name, "journal_entry__id", "sort_order", "id"]


def _serialize_account(account: Account | None) -> dict[str, Any] | None:
    if not account:
        return None

    return {
        "id": account.id,
        "code": _safe_attr(account, "code", None),
        "name": _resolve_account_name(account),
        "name_ar": _safe_attr(account, "name_ar", None),
        "name_en": _safe_attr(account, "name_en", None),
        "account_type": _safe_attr(account, "account_type", None),
        "account_type_label": (
            account.get_account_type_display()
            if hasattr(account, "get_account_type_display")
            else None
        ),
        "nature": _resolve_account_nature(account),
        "nature_label": _resolve_account_nature_label(account),
        "is_group": bool(_safe_attr(account, "is_group", False)),
        "is_active": bool(_safe_attr(account, "is_active", True)),
        "parent_id": _safe_attr(account, "parent_id", None),
        "level": int(_safe_attr(account, "level", 1) or 1),
    }


def _build_ledger_payload(request) -> dict[str, Any]:
    account_id = _parse_int(request.GET.get("account_id"), "account_id")
    date_from = _parse_date(request.GET.get("date_from"), "date_from")
    date_to = _parse_date(request.GET.get("date_to"), "date_to")
    posted_only = _parse_bool(request.GET.get("posted_only"), default=True)
    include_opening = _parse_bool(request.GET.get("include_opening"), default=True)
    ordering_key = _parse_ordering(request.GET.get("ordering"), default="entry_date")

    _validate_date_range(date_from, date_to)

    selected_account: Account | None = None

    if account_id:
        selected_account = (
            Account.objects.select_related("parent")
            .filter(id=account_id)
            .first()
        )

        if not selected_account:
            raise ValueError("الحساب المطلوب غير موجود.")

    base_qs = JournalEntryLine.objects.select_related(
        "journal_entry",
        "account",
    )

    if posted_only:
        base_qs = base_qs.filter(journal_entry__status=JournalEntryStatus.POSTED)

    if selected_account:
        base_qs = base_qs.filter(account_id=selected_account.id)

    opening_qs = base_qs

    if date_from:
        opening_qs = opening_qs.filter(journal_entry__entry_date__lt=date_from)
    else:
        opening_qs = base_qs.none()

    period_qs = base_qs

    if date_from:
        period_qs = period_qs.filter(journal_entry__entry_date__gte=date_from)

    if date_to:
        period_qs = period_qs.filter(journal_entry__entry_date__lte=date_to)

    period_lines = list(period_qs.order_by(*_build_order_by(ordering_key)))

    opening_debit = _money(
        sum(
            (
                _money(_safe_attr(line, "debit_amount", "0.00"))
                for line in opening_qs
            ),
            Decimal("0.00"),
        )
    )
    opening_credit = _money(
        sum(
            (
                _money(_safe_attr(line, "credit_amount", "0.00"))
                for line in opening_qs
            ),
            Decimal("0.00"),
        )
    )

    opening_balance = Decimal("0.00")

    if include_opening:
        if selected_account:
            opening_balance = _account_signed_delta(
                account_nature=_resolve_account_nature(selected_account),
                debit_amount=opening_debit,
                credit_amount=opening_credit,
            )
        else:
            opening_balance = _money(opening_debit - opening_credit)

    total_debit = Decimal("0.00")
    total_credit = Decimal("0.00")
    running_balance = _money(opening_balance)

    transactions_all: list[dict[str, Any]] = []

    for line in period_lines:
        account = _safe_attr(line, "account", None)
        journal_entry = _safe_attr(line, "journal_entry", None)

        debit_amount = _money(_safe_attr(line, "debit_amount", "0.00"))
        credit_amount = _money(_safe_attr(line, "credit_amount", "0.00"))

        total_debit += debit_amount
        total_credit += credit_amount

        if selected_account:
            delta = _account_signed_delta(
                account_nature=_resolve_account_nature(account),
                debit_amount=debit_amount,
                credit_amount=credit_amount,
            )
        else:
            delta = _money(debit_amount - credit_amount)

        running_balance = _money(running_balance + delta)

        transactions_all.append(
            {
                "id": line.id,
                "journal_entry_id": _safe_attr(journal_entry, "id", None),
                "journal_entry_number": _safe_attr(journal_entry, "entry_number", None),
                "entry_date": (
                    _safe_attr(journal_entry, "entry_date", None).isoformat()
                    if _safe_attr(journal_entry, "entry_date", None)
                    else None
                ),
                "posting_source": _safe_attr(journal_entry, "posting_source", None),
                "reference": _safe_attr(journal_entry, "reference", None),
                "external_reference": _safe_attr(journal_entry, "external_reference", None),
                "entry_description": _safe_attr(journal_entry, "description", None),
                "account_id": _safe_attr(account, "id", None),
                "account_code": _safe_attr(account, "code", None),
                "account_name": _resolve_account_name(account),
                "account_type": _safe_attr(account, "account_type", None),
                "account_type_label": (
                    account.get_account_type_display()
                    if account and hasattr(account, "get_account_type_display")
                    else None
                ),
                "nature": _resolve_account_nature(account),
                "nature_label": _resolve_account_nature_label(account),
                "line_description": _safe_attr(line, "description", None),
                "debit_amount": debit_amount,
                "credit_amount": credit_amount,
                "movement_amount": delta,
                "running_balance": running_balance,
                "sort_order": _safe_attr(line, "sort_order", 0),
                "created_at": (
                    _safe_attr(line, "created_at", None).isoformat()
                    if _safe_attr(line, "created_at", None)
                    else None
                ),
            }
        )

    total_debit = _money(total_debit)
    total_credit = _money(total_credit)
    closing_balance = _money(running_balance)

    return {
        "filters": {
            "account_id": selected_account.id if selected_account else None,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "posted_only": posted_only,
            "include_opening": include_opening,
            "ordering": ordering_key,
        },
        "account": _serialize_account(selected_account),
        "summary": {
            "transaction_count": len(transactions_all),
            "opening_debit": opening_debit,
            "opening_credit": opening_credit,
            "opening_balance": opening_balance if include_opening else Decimal("0.00"),
            "total_debit": total_debit,
            "total_credit": total_credit,
            "closing_balance": closing_balance,
        },
        "transactions_all": transactions_all,
    }


def _build_ledger_excel(payload: dict[str, Any]) -> HttpResponse:
    workbook = Workbook()
    ws = workbook.active
    ws.title = _safe_sheet_title("Ledger")

    filters = payload["filters"]
    account = payload["account"]
    summary = payload["summary"]

    start_row = _add_meta_rows(
        ws,
        "General Ledger",
        [
            ("Account ID", filters.get("account_id")),
            ("Account Code", account.get("code") if account else None),
            ("Account Name", account.get("name") if account else None),
            ("Date From", filters.get("date_from")),
            ("Date To", filters.get("date_to")),
            ("Posted Only", filters.get("posted_only")),
            ("Include Opening", filters.get("include_opening")),
            ("Ordering", filters.get("ordering")),
            ("Opening Balance", summary.get("opening_balance")),
            ("Total Debit", summary.get("total_debit")),
            ("Total Credit", summary.get("total_credit")),
            ("Closing Balance", summary.get("closing_balance")),
            ("Transaction Count", summary.get("transaction_count")),
        ],
    )

    headers = [
        "ID",
        "Journal Entry ID",
        "Journal Entry Number",
        "Entry Date",
        "Posting Source",
        "Reference",
        "External Reference",
        "Entry Description",
        "Account ID",
        "Account Code",
        "Account Name",
        "Account Type",
        "Nature",
        "Line Description",
        "Debit Amount",
        "Credit Amount",
        "Movement Amount",
        "Running Balance",
        "Sort Order",
        "Created At",
    ]

    for col_index, header in enumerate(headers, start=1):
        cell = ws.cell(row=start_row, column=col_index, value=header)
        _apply_header_style(cell)

    current_row = start_row + 1

    for row in payload["transactions_all"]:
        ws.cell(row=current_row, column=1, value=row.get("id"))
        ws.cell(row=current_row, column=2, value=row.get("journal_entry_id"))
        ws.cell(row=current_row, column=3, value=row.get("journal_entry_number"))
        ws.cell(row=current_row, column=4, value=row.get("entry_date"))
        ws.cell(row=current_row, column=5, value=row.get("posting_source"))
        ws.cell(row=current_row, column=6, value=row.get("reference"))
        ws.cell(row=current_row, column=7, value=row.get("external_reference"))
        ws.cell(row=current_row, column=8, value=row.get("entry_description"))
        ws.cell(row=current_row, column=9, value=row.get("account_id"))
        ws.cell(row=current_row, column=10, value=row.get("account_code"))
        ws.cell(row=current_row, column=11, value=row.get("account_name"))
        ws.cell(row=current_row, column=12, value=row.get("account_type"))
        ws.cell(row=current_row, column=13, value=row.get("nature"))
        ws.cell(row=current_row, column=14, value=row.get("line_description"))
        ws.cell(row=current_row, column=15, value=float(row.get("debit_amount", 0) or 0))
        ws.cell(row=current_row, column=16, value=float(row.get("credit_amount", 0) or 0))
        ws.cell(row=current_row, column=17, value=float(row.get("movement_amount", 0) or 0))
        ws.cell(row=current_row, column=18, value=float(row.get("running_balance", 0) or 0))
        ws.cell(row=current_row, column=19, value=row.get("sort_order"))
        ws.cell(row=current_row, column=20, value=row.get("created_at"))
        current_row += 1

    _auto_fit_columns(ws)
    return _build_excel_response(workbook, "ledger.xlsx")


# ============================================================
# 📘 General Ledger API
# ============================================================

@require_GET
def accounting_general_ledger_api(request):
    """
    دفتر الأستاذ العام.
    """
    try:
        page = _parse_positive_int(
            request.GET.get("page"),
            "page",
            default=DEFAULT_PAGE,
            min_value=1,
        )
        page_size = _parse_positive_int(
            request.GET.get("page_size"),
            "page_size",
            default=DEFAULT_PAGE_SIZE,
            min_value=1,
            max_value=MAX_PAGE_SIZE,
        )

        base_payload = _build_ledger_payload(request)

        transactions_all = base_payload["transactions_all"]

        paginator = Paginator(transactions_all, page_size)

        try:
            page_obj = paginator.page(page)
        except EmptyPage:
            raise ValueError("رقم الصفحة المطلوب خارج النطاق.")

        payload = {
            "filters": base_payload["filters"],
            "account": base_payload["account"],
            "summary": base_payload["summary"],
            "pagination": {
                "page": page_obj.number,
                "page_size": page_size,
                "total_pages": paginator.num_pages,
                "total_items": paginator.count,
                "has_next": page_obj.has_next(),
                "has_previous": page_obj.has_previous(),
                "next_page": page_obj.next_page_number() if page_obj.has_next() else None,
                "previous_page": page_obj.previous_page_number() if page_obj.has_previous() else None,
            },
            "transactions": list(page_obj.object_list),
        }

        return _success_response(payload)

    except ValueError as exc:
        status = 404 if str(exc) == "الحساب المطلوب غير موجود." else 400
        return _error_response(str(exc), status=status)

    except Exception as exc:
        logger.exception("Failed to load general ledger: %s", exc)
        return _error_response(
            "تعذر تحميل دفتر الأستاذ العام.",
            status=500,
        )


@require_GET
def accounting_general_ledger_excel_api(request):
    """
    تصدير دفتر الأستاذ العام إلى Excel.
    """
    try:
        payload = _build_ledger_payload(request)
        return _build_ledger_excel(payload)

    except ValueError as exc:
        status = 404 if str(exc) == "الحساب المطلوب غير موجود." else 400
        return _error_response(str(exc), status=status)

    except Exception as exc:
        logger.exception("Failed to export general ledger excel: %s", exc)
        return _error_response(
            "تعذر تصدير دفتر الأستاذ العام إلى Excel.",
            status=500,
        )